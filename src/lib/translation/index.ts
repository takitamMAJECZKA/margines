import "server-only";

import type { LanguageCode } from "@/lib/languages";
import { issueFromError } from "@/lib/server/errors";
import { serverCache } from "@/lib/server/cache";
import type { TranslationResult } from "@/types/api";

import { createDeepLProvider } from "./deepl";
import { createLibreTranslateProvider } from "./libretranslate";
import type { TranslationProvider } from "./types";
import { TRANSLATION_CACHE_TTL_MS } from "./types";

export type TranslationProviderChoice = "deepl" | "libretranslate" | "none";

function configuredChoice(): TranslationProviderChoice {
  const explicit = process.env.TRANSLATION_PROVIDER?.trim().toLowerCase();

  if (explicit === "none") return "none";
  if (explicit === "deepl") return "deepl";
  if (explicit === "libretranslate") return "libretranslate";

  if (process.env.DEEPL_AUTH_KEY?.trim()) return "deepl";
  if (process.env.LIBRETRANSLATE_URL?.trim()) return "libretranslate";
  return "none";
}

export function getTranslationProvider(): TranslationProvider | null {
  const choice = configuredChoice();

  if (choice === "deepl") {
    const key = process.env.DEEPL_AUTH_KEY?.trim();
    return key ? createDeepLProvider(key) : null;
  }

  if (choice === "libretranslate") {
    const baseUrl = process.env.LIBRETRANSLATE_URL?.trim();
    return baseUrl
      ? createLibreTranslateProvider(baseUrl, process.env.LIBRETRANSLATE_API_KEY?.trim())
      : null;
  }

  return null;
}

export function isTranslationConfigured(): boolean {
  return getTranslationProvider() !== null;
}

export async function translateText(
  text: string,
  source: LanguageCode,
  target: LanguageCode,
): Promise<TranslationResult> {
  const provider = getTranslationProvider();

  if (!provider) {
    return {
      text: null,
      provider: null,
      error: {
        code: "NOT_CONFIGURED",
        message:
          "Automatyczne tłumaczenie nie jest skonfigurowane. Wpisz tłumaczenie ręcznie.",
      },
    };
  }

  const cacheKey = `translation:${provider.name}:${source}:${target}:${text
    .normalize("NFC")
    .toLocaleLowerCase("pl")}`;

  const cached = serverCache.get<string>(cacheKey);
  if (cached) {
    return { text: cached, provider: provider.name, error: null };
  }

  try {
    const translated = await provider.translate(text, source, target);
    serverCache.set(cacheKey, translated, TRANSLATION_CACHE_TTL_MS);
    return { text: translated, provider: provider.name, error: null };
  } catch (error) {
    return {
      text: null,
      provider: provider.name,
      error: issueFromError(error, "Nie udało się pobrać tłumaczenia."),
    };
  }
}
