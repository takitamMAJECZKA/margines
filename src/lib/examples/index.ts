import "server-only";

import {
  generateAiExample,
  isAiExampleConfigured,
} from "@/lib/ai/example";
import type { ForeignLanguageCode } from "@/lib/languages";
import { serverCache } from "@/lib/server/cache";
import { issueFromError, ProviderRequestError } from "@/lib/server/errors";
import { findAuthenticExamples } from "@/lib/tatoeba/client";
import { translateText } from "@/lib/translation";
import type { ApiIssue, AuthenticExample } from "@/types/api";

// DeepL is only asked about the first few Tatoeba hits. The rest are kept as
// alternatives in the cache but the dialog only ever shows the best one.
const MAX_TRANSLATIONS = 5;
const AI_EXAMPLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface ExampleSearchResult {
  examples: AuthenticExample[];
  error: ApiIssue | null;
}

function shortHash(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function aiExampleId(word: string, sourceLanguage: ForeignLanguageCode): string {
  return `ai-${sourceLanguage}-${shortHash(word.toLocaleLowerCase("pl"))}`;
}

function toExample(
  generated: { text: string; translation: string; answer: string; model: string },
  word: string,
  sourceLanguage: ForeignLanguageCode,
): AuthenticExample {
  return {
    id: aiExampleId(word, sourceLanguage),
    text: generated.text,
    translation: generated.translation,
    source: "AI",
    sourceUrl: "",
    attribution: generated.model,
    license: "",
    hasDirectTranslation: false,
    answer: generated.answer,
  };
}

/**
 * Tatoeba sentences do not always come with a linked Polish translation.
 * Translate those through the configured provider (DeepL in practice) and drop
 * any sentence that still has no translation, because the flashcard always
 * needs both sides.
 */
async function ensurePolishTranslations(
  examples: AuthenticExample[],
  sourceLanguage: ForeignLanguageCode,
): Promise<{ examples: AuthenticExample[]; error: ApiIssue | null }> {
  const missing = examples
    .filter((example) => !example.translation.trim())
    .slice(0, MAX_TRANSLATIONS);

  if (missing.length === 0) {
    return { examples, error: null };
  }

  const translated = await Promise.allSettled(
    missing.map(async (example) => {
      const result = await translateText(example.text, sourceLanguage, "pl");
      if (!result.text) {
        throw new ProviderRequestError(
          result.error?.code ?? "UNAVAILABLE",
          result.error?.message ?? "Nie udało się przetłumaczyć zdania.",
        );
      }
      return { id: example.id, translation: result.text };
    }),
  );

  const translations = new Map<string, string>();
  let firstError: unknown = null;

  for (const result of translated) {
    if (result.status === "fulfilled") {
      translations.set(result.value.id, result.value.translation);
    } else if (!firstError) {
      firstError = result.reason;
    }
  }

  const withTranslations = examples
    .map((example) => {
      const translation = translations.get(example.id);
      return translation ? { ...example, translation } : example;
    })
    .filter((example) => example.translation.trim());

  return {
    examples: withTranslations,
    error: firstError
      ? issueFromError(firstError, "Nie udało się przetłumaczyć zdania.")
      : null,
  };
}

async function findAiFallback(
  word: string,
  sourceLanguage: ForeignLanguageCode,
): Promise<{ example: AuthenticExample | null; error: ApiIssue | null }> {
  if (!isAiExampleConfigured()) {
    return { example: null, error: null };
  }

  const cacheKey = `ai-example:${sourceLanguage}:${word
    .normalize("NFC")
    .toLocaleLowerCase("pl")}`;
  const cached = serverCache.get<AuthenticExample>(cacheKey);
  if (cached) return { example: cached, error: null };

  try {
    const generated = await generateAiExample(word, sourceLanguage);
    // DeepL is the preferred translator for example sentences. The model also
    // returns a Polish translation, which becomes the fallback when DeepL is
    // not configured or temporarily unavailable.
    const translated = await translateText(generated.text, sourceLanguage, "pl");
    const example = toExample(
      {
        ...generated,
        translation: translated.text?.trim() || generated.translation,
      },
      word,
      sourceLanguage,
    );
    serverCache.set(cacheKey, example, AI_EXAMPLE_CACHE_TTL_MS);
    return { example, error: null };
  } catch (error) {
    return {
      example: null,
      error: issueFromError(error, "Nie udało się wygenerować przykładowego zdania."),
    };
  }
}

/**
 * Every flashcard gets an example with a Polish translation:
 * 1. Tatoeba sentences, translated through DeepL when the corpus lacks Polish,
 * 2. a short AI-generated sentence (Gemma 4) when Tatoeba has nothing usable.
 */
export async function findExamples(
  word: string,
  sourceLanguage: ForeignLanguageCode,
  excludeIds: string[] = [],
): Promise<ExampleSearchResult> {
  const authentic = await findAuthenticExamples(word, sourceLanguage, excludeIds);
  const translated = await ensurePolishTranslations(
    authentic.examples,
    sourceLanguage,
  );

  if (translated.examples.length > 0) {
    return { examples: translated.examples, error: null };
  }

  const fallback = await findAiFallback(word, sourceLanguage);
  if (fallback.example) {
    return { examples: [fallback.example], error: null };
  }

  return {
    examples: [],
    error:
      authentic.error ??
      translated.error ??
      fallback.error,
  };
}
