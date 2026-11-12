import type { LanguageCode } from "@/lib/languages";
import type { TranslationProviderName } from "@/types/api";

export interface TranslationProvider {
  name: TranslationProviderName;
  translate(text: string, source: LanguageCode, target: LanguageCode): Promise<string>;
}

export const TRANSLATION_TIMEOUT_MS = 10_000;
export const TRANSLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
