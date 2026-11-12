import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { ProviderRequestError } from "@/lib/server/errors";
import { fetchWithTimeout, readJson } from "@/lib/server/http";

import type { TranslationProvider } from "./types";
import { TRANSLATION_TIMEOUT_MS } from "./types";

interface DeepLResponse {
  translations?: Array<{ text?: string; detected_source_language?: string }>;
  message?: string;
}

function endpointFor(key: string): string {
  const configured = process.env.DEEPL_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  return key.trim().endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
}

export function createDeepLProvider(apiKey: string): TranslationProvider {
  const url = `${endpointFor(apiKey)}/v2/translate`;

  return {
    name: "deepl",
    async translate(text: string, source: LanguageCode, target: LanguageCode) {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        timeoutMs: TRANSLATION_TIMEOUT_MS,
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          text: [text],
          source_lang: LANGUAGES[source].deepl,
          target_lang: LANGUAGES[target].deepl,
          preserve_formatting: true,
        }),
      });

      if (response.status === 403) {
        throw new ProviderRequestError(
          "INVALID_CREDENTIALS",
          "DeepL odrzucił klucz API. Sprawdź DEEPL_AUTH_KEY.",
        );
      }

      if (response.status === 429) {
        throw new ProviderRequestError(
          "RATE_LIMITED",
          "Limit zapytań DeepL został osiągnięty. Spróbuj później.",
        );
      }

      if (response.status === 456) {
        throw new ProviderRequestError(
          "QUOTA_EXCEEDED",
          "Wykorzystano limit znaków w DeepL.",
        );
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null) as DeepLResponse | null;
        console.error("[deepl]", response.status, data?.message);
        throw new ProviderRequestError(
          "UNAVAILABLE",
          "DeepL nie mógł przetłumaczyć tego tekstu.",
        );
      }

      const data = await readJson<DeepLResponse>(response);
      const translated = data.translations?.[0]?.text?.trim();

      if (!translated) {
        throw new ProviderRequestError(
          "UNAVAILABLE",
          "DeepL nie zwrócił tłumaczenia.",
        );
      }

      return translated;
    },
  };
}
