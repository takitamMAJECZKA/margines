import type { ForeignLanguageCode } from "@/lib/languages";
import type {
  AiExampleResponse,
  ArticleResponse,
  DefinitionResponse,
  EnrichResponse,
  ExamplesResponse,
} from "@/types/api";

const CLIENT_TIMEOUT_MS = 35_000;
const EXAMPLES_TIMEOUT_MS = 40_000;
// Article lookup is a single MediaWiki request and runs alongside translation.
// A shorter timeout keeps the add-word preview responsive when Wiktionary is
// slow; the word is still saved without an article.
const ARTICLE_TIMEOUT_MS = 12_000;

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
  timeoutMs = CLIENT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;
      throw new ApiClientError(
        data?.error || "Żądanie nie powiodło się. Spróbuj ponownie.",
        data?.code,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError(
        "Usługa odpowiedziała zbyt wolno. Spróbuj ponownie.",
        "TIMEOUT",
      );
    }

    throw new ApiClientError(
      "Brak połączenia z internetem lub usługa jest chwilowo niedostępna.",
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchEnrichment(
  word: string,
  sourceLanguage: ForeignLanguageCode,
  signal?: AbortSignal,
): Promise<EnrichResponse> {
  return postJson<EnrichResponse>(
    "/api/enrich",
    { word, sourceLanguage, targetLanguage: "pl" },
    signal,
  );
}

export async function fetchExamples(
  word: string,
  sourceLanguage: ForeignLanguageCode,
  signal?: AbortSignal,
  excludeIds: string[] = [],
): Promise<ExamplesResponse> {
  return postJson<ExamplesResponse>(
    "/api/examples",
    { word, sourceLanguage, excludeIds },
    signal,
    EXAMPLES_TIMEOUT_MS,
  );
}

export async function fetchAiExample(
  word: string,
  sourceLanguage: ForeignLanguageCode,
): Promise<AiExampleResponse> {
  return postJson<AiExampleResponse>("/api/ai-example", {
    word,
    sourceLanguage,
  });
}

/** Monolingual Polish definitions for the native dictionary. */
export async function fetchDefinition(
  word: string,
  signal?: AbortSignal,
): Promise<DefinitionResponse> {
  return postJson<DefinitionResponse>("/api/definition", { word }, signal);
}

/** Wiktionary gender/article enrichment for foreign nouns. */
export async function fetchArticle(
  word: string,
  sourceLanguage: ForeignLanguageCode,
  signal?: AbortSignal,
): Promise<ArticleResponse> {
  return postJson<ArticleResponse>(
    "/api/article",
    { word, sourceLanguage },
    signal,
    ARTICLE_TIMEOUT_MS,
  );
}
