export const LANGUAGE_CODES = ["es", "en", "de", "pl"] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Languages that are translated into Polish and can use Tatoeba examples. */
export const FOREIGN_LANGUAGE_CODES = ["es", "en", "de"] as const;

export type ForeignLanguageCode = (typeof FOREIGN_LANGUAGE_CODES)[number];

type LanguageInfo = {
  name: string;
  adjective: string;
  short: string;
  deepl: string;
  tatoeba: string;
};

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  es: {
    name: "hiszpański",
    adjective: "hiszpańsku",
    short: "ES",
    deepl: "ES",
    tatoeba: "spa",
  },
  en: {
    name: "angielski",
    adjective: "angielsku",
    short: "EN",
    deepl: "EN",
    tatoeba: "eng",
  },
  de: {
    name: "niemiecki",
    adjective: "niemiecku",
    short: "DE",
    deepl: "DE",
    tatoeba: "deu",
  },
  pl: {
    name: "polski",
    adjective: "polsku",
    short: "PL",
    deepl: "PL",
    tatoeba: "pol",
  },
};

export function isForeignLanguage(
  code: LanguageCode,
): code is ForeignLanguageCode {
  return code !== "pl";
}

export const DICTIONARY_COLORS = [
  "amber",
  "emerald",
  "sky",
  "rose",
  "violet",
  "stone",
] as const;

export type DictionaryColor = (typeof DICTIONARY_COLORS)[number];

export const DICTIONARY_COLOR_HEX: Record<DictionaryColor, string> = {
  amber: "#d97706",
  emerald: "#059669",
  sky: "#0284c7",
  rose: "#e11d48",
  violet: "#7c3aed",
  stone: "#78716c",
};

export const DICTIONARY_COLOR_LABELS: Record<DictionaryColor, string> = {
  amber: "Miód",
  emerald: "Las",
  sky: "Błękit",
  rose: "Róża",
  violet: "Fiołek",
  stone: "Kamień",
};

export const DEFAULT_DICTIONARY_META: Record<
  LanguageCode,
  { name: string; color: DictionaryColor }
> = {
  pl: { name: "Polski", color: "emerald" },
  es: { name: "Hiszpański", color: "amber" },
  en: { name: "Angielski", color: "sky" },
  de: { name: "Niemiecki", color: "violet" },
};

export function languagePairLabel(
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  isNative: boolean,
): string {
  if (isNative || sourceLanguage === targetLanguage) {
    return "Słownik ojczysty";
  }

  return `${LANGUAGES[sourceLanguage].short} → ${LANGUAGES[targetLanguage].short}`;
}

export function studyLanguageLabel(sourceLanguage: LanguageCode): string {
  return `Po ${LANGUAGES[sourceLanguage].adjective}`;
}
