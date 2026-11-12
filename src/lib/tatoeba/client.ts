import "server-only";

import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { ProviderRequestError } from "@/lib/server/errors";
import { serverCache } from "@/lib/server/cache";
import { fetchWithTimeout, readJson } from "@/lib/server/http";
import type { ApiIssue, AuthenticExample } from "@/types/api";

const TATOEBA_API = "https://api.tatoeba.org/v1/sentences";
const TATOEBA_REQUEST_TIMEOUT_MS = 25_000;
// Both searches run in parallel, so the whole lookup should finish in roughly
// the time of one request. This hard deadline also covers slow body reads and
// is deliberately generous: examples load in the background and never block
// the translation preview.
const TATOEBA_TOTAL_DEADLINE_MS = 30_000;
const EXAMPLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Empty answers are cached briefly so repeated lookups do not hammer Tatoeba,
// while failures are never cached — an immediate retry must be able to succeed.
const EXAMPLE_EMPTY_CACHE_TTL_MS = 2 * 60 * 1000;
// Keep several examples in cache so editing a word can offer an alternative
// without immediately repeating the same Tatoeba sentence.
const MAX_EXAMPLES = 8;

interface TatoebaTranslation {
  id: number;
  text: string;
  lang: string;
  license?: string;
  owner?: string | null;
  is_unapproved?: boolean;
  is_direct?: boolean;
}

interface TatoebaSentence {
  id: number;
  text: string;
  lang: string;
  license?: string;
  owner?: string | null;
  is_unapproved?: boolean;
  translations?: TatoebaTranslation[];
}

interface TatoebaResponse {
  data?: TatoebaSentence[];
}

export interface TatoebaSearchResult {
  examples: AuthenticExample[];
  error: ApiIssue | null;
}

function isUsefulSentence(sentence: string): boolean {
  const clean = sentence.trim();
  if (clean.length < 8 || clean.length > 180) return false;
  if (clean.split(/\s+/).length < 2) return false;
  return true;
}

function pickTranslation(sentence: TatoebaSentence): {
  translation: string;
  direct: boolean;
} {
  const translations = (sentence.translations ?? []).filter(
    (translation) =>
      translation.lang === "pol" &&
      !translation.is_unapproved &&
      translation.text?.trim(),
  );

  if (translations.length === 0) {
    return { translation: "", direct: false };
  }

  const sorted = [...translations].sort((a, b) => {
    if (Boolean(b.is_direct) !== Boolean(a.is_direct)) {
      return Number(b.is_direct) - Number(a.is_direct);
    }
    return a.text.length - b.text.length;
  });

  return {
    translation: sorted[0].text.trim(),
    direct: Boolean(sorted[0].is_direct),
  };
}

function mapSentence(sentence: TatoebaSentence): AuthenticExample | null {
  if (sentence.is_unapproved) return null;

  const text = sentence.text?.trim();
  if (!text) return null;

  const picked = pickTranslation(sentence);
  const attributionParts = [sentence.owner?.trim(), sentence.license?.trim()].filter(
    Boolean,
  );

  return {
    id: String(sentence.id),
    text,
    translation: picked.translation,
    source: "Tatoeba",
    sourceUrl: `https://tatoeba.org/pl/sentences/show/${sentence.id}`,
    attribution: attributionParts.join(" · "),
    license: sentence.license ?? "",
    hasDirectTranslation: picked.direct,
  };
}

async function searchTatoeba(
  word: string,
  sourceLanguage: LanguageCode,
  withPolishTranslation: boolean,
  signal: AbortSignal,
): Promise<TatoebaSentence[]> {
  const params = new URLSearchParams({
    lang: LANGUAGES[sourceLanguage].tatoeba,
    q: word,
    sort: "relevance",
    limit: "20",
  });

  if (withPolishTranslation) {
    params.set("trans:lang", "pol");
    params.set("showtrans", "matching");
  }

  const response = await fetchWithTimeout(`${TATOEBA_API}?${params.toString()}`, {
    timeoutMs: TATOEBA_REQUEST_TIMEOUT_MS,
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "Margines/1.0 (personal vocabulary PWA)",
    },
  });

  if (response.status === 429) {
    throw new ProviderRequestError(
      "RATE_LIMITED",
      "Tatoeba chwilowo ograniczyła liczbę zapytań. Spróbuj ponownie za chwilę.",
    );
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie udało się pobrać przykładów z Tatoeba.",
    );
  }

  const data = await readJson<TatoebaResponse>(response, signal);
  return data.data ?? [];
}

function rankExamples(examples: AuthenticExample[]): AuthenticExample[] {
  return [...examples].sort((a, b) => {
    if (Boolean(b.translation) !== Boolean(a.translation)) {
      return Number(Boolean(b.translation)) - Number(Boolean(a.translation));
    }

    if (a.hasDirectTranslation !== b.hasDirectTranslation) {
      return Number(b.hasDirectTranslation) - Number(a.hasDirectTranslation);
    }

    const idealLength = (text: string) =>
      Math.abs(text.length - 65);
    return idealLength(a.text) - idealLength(b.text);
  });
}

function collectExamples(
  sentences: TatoebaSentence[],
  seen: Set<string>,
  target: AuthenticExample[],
): void {
  for (const sentence of sentences) {
    // Tatoeba stems searches for English, Spanish, French and German. Its `q`
    // results can therefore contain valid inflections (e.g. perros for perro,
    // or went for go). Requiring the literal headword here discarded those
    // results, so trust the language-filtered search and only apply quality
    // checks to the returned sentence.
    if (!isUsefulSentence(sentence.text ?? "")) continue;
    const mapped = mapSentence(sentence);
    if (!mapped) continue;

    const key = mapped.text.toLocaleLowerCase("pl");
    if (seen.has(key)) continue;

    seen.add(key);
    target.push(mapped);
  }
}

function issueFromTatoebaError(error: unknown): ApiIssue | null {
  if (!error) return null;

  return {
    code: error instanceof ProviderRequestError ? error.code : "UNAVAILABLE",
    message:
      error instanceof ProviderRequestError
        ? error.message
        : "Nie udało się pobrać przykładów z Tatoeba.",
  };
}

export async function findAuthenticExamples(
  word: string,
  sourceLanguage: LanguageCode,
  excludeIds: string[] = [],
): Promise<TatoebaSearchResult> {
  const cacheKey = `tatoeba:${sourceLanguage}:${word.normalize("NFC").toLocaleLowerCase("pl")}`;
  const cached = serverCache.get<TatoebaSearchResult>(cacheKey);
  if (cached) {
    const examples = cached.examples
      .filter((example) => !excludeIds.includes(example.id))
      .slice(0, MAX_EXAMPLES);
    if (examples.length > 0) {
      return { ...cached, examples };
    }
  }

  const deadline = new AbortController();
  const deadlineTimer = setTimeout(
    () => deadline.abort(),
    TATOEBA_TOTAL_DEADLINE_MS,
  );

  try {
    // Run both searches at once: Tatoeba needs several seconds per query, so
    // doing them sequentially was the main reason the add-word dialog timed
    // out. The translated query is ranked first; the plain query only fills
    // the remaining slots.
    const [translated, fallback] = await Promise.allSettled([
      searchTatoeba(word, sourceLanguage, true, deadline.signal),
      searchTatoeba(word, sourceLanguage, false, deadline.signal),
    ]);

    const seen = new Set<string>();
    const examples: AuthenticExample[] = [];

    if (translated.status === "fulfilled") {
      collectExamples(translated.value, seen, examples);
    }

    if (examples.length < MAX_EXAMPLES && fallback.status === "fulfilled") {
      collectExamples(fallback.value, seen, examples);
    }

    const ranked = rankExamples(examples)
      .filter((example) => !excludeIds.includes(example.id))
      .slice(0, MAX_EXAMPLES);
    const firstError =
      ranked.length === 0
        ? ([translated, fallback].find(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )?.reason ?? null)
        : null;

    const result: TatoebaSearchResult = {
      examples: ranked,
      error: issueFromTatoebaError(firstError),
    };

    // Never pin a failure for hours: the user may retry and a transient
    // Tatoeba timeout must not block the next attempt.
    if (ranked.length > 0) {
      serverCache.set(cacheKey, result, EXAMPLE_CACHE_TTL_MS);
    } else if (!result.error) {
      serverCache.set(cacheKey, result, EXAMPLE_EMPTY_CACHE_TTL_MS);
    }

    return result;
  } finally {
    clearTimeout(deadlineTimer);
  }
}
