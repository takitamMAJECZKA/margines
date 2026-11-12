import "server-only";

import { z } from "zod";

import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { ProviderRequestError } from "@/lib/server/errors";
import { fetchWithTimeout, readJson } from "@/lib/server/http";

const AI_TIMEOUT_MS = 25_000;

const aiResponseSchema = z.object({
  sentence: z.string().trim().min(8).max(500),
  translation: z.string().trim().min(1).max(500),
});

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export interface GeneratedExample {
  text: string;
  translation: string;
  model: string;
}

export function isAiExampleConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

function extractJson(content: string): unknown {
  const cleaned = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Optional AI-generated example. It is never presented as an authentic corpus
 * sentence and the feature stays disabled unless AI_API_KEY is configured.
 */
export async function generateAiExample(
  word: string,
  sourceLanguage: LanguageCode,
): Promise<GeneratedExample> {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderRequestError(
      "NOT_CONFIGURED",
      "Generator przykładów AI nie jest skonfigurowany.",
    );
  }

  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  const language = LANGUAGES[sourceLanguage].name;

  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    timeoutMs: AI_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You create short, natural language-learning examples. Reply with JSON only, no markdown.",
        },
        {
          role: "user",
          content: [
            `Create one original example sentence in ${language} that uses the exact word or phrase: "${word}".`,
            "The sentence should be natural, between 8 and 18 words, and suitable for an adult learner.",
            "Also provide an accurate Polish translation of that sentence.",
            'Return exactly this JSON shape: {"sentence": "...", "translation": "..."}',
          ].join("\n"),
        },
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

  const parsed = aiResponseSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Odpowiedź AI miała nieprawidłowy format. Spróbuj ponownie.",
    );
  }

  if (!parsed.data.sentence.toLocaleLowerCase("pl").includes(word.toLocaleLowerCase("pl"))) {
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
