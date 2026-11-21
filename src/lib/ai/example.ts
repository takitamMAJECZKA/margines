import "server-only";

import { z } from "zod";

import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { ProviderRequestError } from "@/lib/server/errors";
import { fetchWithTimeout, readJson } from "@/lib/server/http";

const AI_TIMEOUT_MS = 25_000;
const GOOGLE_MODEL_TIMEOUT_MS = 10_000;
const GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GOOGLE_MODEL = "gemma-4-31b-it";
// Google occasionally answers with 503 when the newest Gemma is under heavy
// load. The smaller Gemma 4 model produces the same kind of example, so the
// feature keeps working instead of failing the whole add-word flow.
const DEFAULT_GOOGLE_FALLBACK_MODEL = "gemma-4-26b-a4b-it";
// Last resort when the whole Gemma pool is busy. A tiny Gemini model still
// returns a short sentence in the same JSON shape.
const DEFAULT_GOOGLE_EMERGENCY_MODEL = "gemini-3.1-flash-lite";

const aiResponseSchema = z.object({
  sentence: z.string().trim().min(8).max(500),
  translation: z.string().trim().min(1).max(500),
});

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

interface GeminiPart {
  text?: string;
  /** Gemma 4 exposes its chain-of-thought in separate parts. */
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { code?: number; message?: string; status?: string };
}

export interface GeneratedExample {
  text: string;
  translation: string;
  model: string;
}

type AiProvider =
  | { kind: "google"; apiKey: string; models: string[] }
  | {
      kind: "openai";
      apiKey: string;
      baseUrl: string;
      model: string;
    };

function resolveProvider(): AiProvider | null {
  const googleKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_AI_API_KEY ??
    ""
  ).trim();

  if (googleKey) {
    const primary =
      process.env.GEMINI_MODEL?.trim() || DEFAULT_GOOGLE_MODEL;
    const fallback =
      process.env.GEMINI_FALLBACK_MODEL?.trim() ||
      DEFAULT_GOOGLE_FALLBACK_MODEL;
    const emergency =
      process.env.GEMINI_EMERGENCY_MODEL?.trim() ||
      DEFAULT_GOOGLE_EMERGENCY_MODEL;
    const models = Array.from(
      new Set([primary, fallback, emergency].filter(Boolean)),
    );

    return { kind: "google", apiKey: googleKey, models };
  }

  const openAiKey = process.env.AI_API_KEY?.trim();
  if (!openAiKey) return null;

  return {
    kind: "openai",
    apiKey: openAiKey,
    baseUrl: (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
      /\/+$/,
      "",
    ),
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function isAiExampleConfigured(): boolean {
  return resolveProvider() !== null;
}

function examplePrompt(word: string, sourceLanguage: LanguageCode): string {
  const language = LANGUAGES[sourceLanguage].name;

  return [
    "You create short, natural language-learning examples.",
    `Create one original example sentence in ${language} that uses the exact word or phrase: "${word}".`,
    "The sentence should be natural, between 8 and 18 words, and suitable for an adult learner.",
    "Also provide an accurate Polish translation of that sentence.",
    "Do not explain your reasoning. Do not use markdown.",
    'Return exactly one JSON object and nothing else: {"sentence": "...", "translation": "..."}',
  ].join("\n");
}

/**
 * Collect every JSON object in a model response and return the last one that
 * looks like the requested shape. Gemma often prints a short reasoning trace
 * (sometimes containing sample JSON) before the final answer, so the first
 * opening brace is not reliable.
 */
function extractJson(content: string): unknown {
  const candidates: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          candidates.push(JSON.parse(content.slice(start, index + 1)));
        } catch {
          // Not valid JSON yet; keep scanning for another object.
        }
        start = -1;
      }
    }
  }

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (
      candidate &&
      typeof candidate === "object" &&
      "sentence" in candidate &&
      "translation" in candidate
    ) {
      return candidate;
    }
  }

  return null;
}

function readGeminiText(data: GeminiResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const answer = parts
    .filter((part) => !part.thought && part.text?.trim())
    .map((part) => part.text)
    .join("\n")
    .trim();

  return answer || null;
}

async function generateWithGoogle(
  provider: Extract<AiProvider, { kind: "google" }>,
  prompt: string,
): Promise<{ content: string; model: string }> {
  let lastError: unknown = null;

  for (const model of provider.models) {
    try {
      const response = await fetchWithTimeout(
        `${GOOGLE_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          timeoutMs: GOOGLE_MODEL_TIMEOUT_MS,
          headers: {
            "x-goog-api-key": provider.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        throw new ProviderRequestError(
          "INVALID_CREDENTIALS",
          "Dostawca AI odrzucił klucz API.",
        );
      }

      if (response.status === 429) {
        lastError = new ProviderRequestError(
          "RATE_LIMITED",
          "Limit zapytań do dostawcy AI został osiągnięty.",
        );
        continue;
      }

      if (!response.ok) {
        lastError = new ProviderRequestError(
          "UNAVAILABLE",
          response.status === 503
            ? "Model AI jest chwilowo przeciążony. Spróbuj ponownie."
            : "Nie udało się wygenerować przykładu AI.",
        );
        continue;
      }

      const data = await readJson<GeminiResponse>(response);
      const content = readGeminiText(data);
      if (!content) {
        lastError = new ProviderRequestError(
          "UNAVAILABLE",
          "Dostawca AI nie zwrócił treści.",
        );
        continue;
      }

      return { content, model };
    } catch (error) {
      lastError = error;

      if (
        error instanceof ProviderRequestError &&
        error.code === "INVALID_CREDENTIALS"
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof ProviderRequestError
    ? lastError
    : new ProviderRequestError("UNAVAILABLE", "Nie udało się wygenerować przykładu AI.");
}

async function generateWithOpenAi(
  provider: Extract<AiProvider, { kind: "openai" }>,
  prompt: string,
): Promise<{ content: string; model: string }> {
  const response = await fetchWithTimeout(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    timeoutMs: AI_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.7,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You create short, natural language-learning examples. Reply with JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new ProviderRequestError(
      "INVALID_CREDENTIALS",
      "Dostawca AI odrzucił klucz API.",
    );
  }

  if (response.status === 429) {
    throw new ProviderRequestError(
      "RATE_LIMITED",
      "Limit zapytań do dostawcy AI został osiągnięty.",
    );
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie udało się wygenerować przykładu AI.",
    );
  }

  const data = await readJson<ChatCompletionResponse>(response);
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ProviderRequestError("UNAVAILABLE", "Dostawca AI nie zwrócił treści.");
  }

  return { content, model: provider.model };
}

/**
 * AI-generated example used when Tatoeba has no usable sentence. It is always
 * labelled as AI, never presented as an authentic corpus sentence.
 */
export async function generateAiExample(
  word: string,
  sourceLanguage: LanguageCode,
): Promise<GeneratedExample> {
  const provider = resolveProvider();

  if (!provider) {
    throw new ProviderRequestError(
      "NOT_CONFIGURED",
      "Generator przykładów AI nie jest skonfigurowany.",
    );
  }

  const prompt = examplePrompt(word, sourceLanguage);
  const { content, model } =
    provider.kind === "google"
      ? await generateWithGoogle(provider, prompt)
      : await generateWithOpenAi(provider, prompt);

  const parsed = aiResponseSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Odpowiedź AI miała nieprawidłowy format. Spróbuj ponownie.",
    );
  }

  if (
    !parsed.data.sentence
      .toLocaleLowerCase("pl")
      .includes(word.toLocaleLowerCase("pl"))
  ) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Wygenerowane zdanie nie zawiera podanego słowa. Spróbuj ponownie.",
    );
  }

  return {
    text: parsed.data.sentence,
    translation: parsed.data.translation,
    model,
  };
}
