import type { LanguageCode } from "@/lib/languages";
import { ProviderRequestError } from "@/lib/server/errors";
import { fetchWithTimeout, readJson } from "@/lib/server/http";

import type { TranslationProvider } from "./types";
import { TRANSLATION_TIMEOUT_MS } from "./types";

interface LibreTranslateResponse {
  translatedText?: string;
  error?: string;
}

export function createLibreTranslateProvider(
  baseUrl: string,
  apiKey?: string,
): TranslationProvider {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/translate`;

  return {
    name: "libretranslate",
    async translate(text: string, source: LanguageCode, target: LanguageCode) {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        timeoutMs: TRANSLATION_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
          ...(apiKey ? { api_key: apiKey } : {}),
        }),
      });

      if (response.status === 403 || response.status === 401) {
        throw new ProviderRequestError(
          "INVALID_CREDENTIALS",
          "LibreTranslate odrzucił dane dostępowe.",
        );
      }

      if (response.status === 429) {
        throw new ProviderRequestError(
          "RATE_LIMITED",
          "Limit zapytań LibreTranslate został osiągnięty. Spróbuj później.",
        );
      }

      if (!response.ok) {
        throw new ProviderRequestError(
          "UNAVAILABLE",
          "LibreTranslate nie mógł przetłumaczyć tego tekstu.",
        );
      }

      const data = await readJson<LibreTranslateResponse>(response);
      const translated = data.translatedText?.trim();

      if (!translated) {
        throw new ProviderRequestError(
          "UNAVAILABLE",
          data.error || "LibreTranslate nie zwrócił tłumaczenia.",
        );
      }

      return translated;
    },
  };
}
