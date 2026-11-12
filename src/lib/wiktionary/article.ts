import "server-only";

import type { ForeignLanguageCode } from "@/lib/languages";

import { extractLanguageSection, fetchWiktionaryPage } from "./client";

const LANGUAGE_SECTIONS: Record<ForeignLanguageCode, string> = {
  es: "Spanish",
  en: "English",
  de: "German",
};

const GERMAN_ARTICLES: Record<string, string> = {
  m: "der",
  f: "die",
  n: "das",
};

// Feminine Spanish nouns beginning with a stressed /a/ take "el" in the
// singular ("el agua"), even though the Wiktionary gender stays feminine.
const SPANISH_EL_FEMININE = new Set([
  "agua",
  "águila",
  "alma",
  "ancla",
  "ánfora",
  "arca",
  "arpa",
  "asa",
  "asta",
  "aula",
  "aura",
  "ave",
  "área",
  "arte",
  "asma",
  "hacha",
  "hada",
  "hambre",
]);

export interface ArticleLookup {
  /** Headword with the article prepended, or the input when none was found. */
  word: string;
  article: string | null;
  applied: boolean;
}

function firstTemplateParameter(section: string, template: string): string | null {
  const pattern = new RegExp(`\\{\\{${template}\\s*\\|([^}]*)\\}\\}`, "gi");

  for (const match of section.matchAll(pattern)) {
    const first = match[1]?.split("|")[0]?.trim();
    if (first) return first;
  }

  return null;
}

function genderFromHeadTemplate(
  section: string,
  language: ForeignLanguageCode,
): string | null {
  for (const match of section.matchAll(/\{\{head\s*\|([^}]*)\}\}/gi)) {
    const params = match[1].split("|").map((part) => part.trim());
    if (params[0]?.toLowerCase() !== language) continue;
    if (!params.slice(1).some((part) => part.toLowerCase() === "noun")) continue;

    const genderParam = params.find((part) => /^g\s*=/i.test(part));
    const gender = genderParam?.split("=")[1]?.trim();
    if (gender) return gender;
  }

  return null;
}

function germanArticle(section: string): string | null {
  const gender =
    firstTemplateParameter(section, "de-noun") ??
    genderFromHeadTemplate(section, "de");

  if (!gender) return null;
  return GERMAN_ARTICLES[gender.charAt(0).toLowerCase()] ?? null;
}

function spanishArticle(section: string, headword: string): string | null {
  const raw =
    firstTemplateParameter(section, "es-noun") ??
    genderFromHeadTemplate(section, "es");

  if (!raw) return null;

  const gender = raw.toLocaleLowerCase("es");
  const plural = gender.includes("-p");
  const pluralOnly = gender.includes("p") && !gender.includes("-");

  if (gender === "?" || gender === "mf" || gender === "mfb" || gender.includes("/")) {
    return null;
  }

  if (gender.startsWith("m")) {
    return plural || pluralOnly ? "los" : "el";
  }

  if (gender.startsWith("f")) {
    if (plural || pluralOnly) return "las";
    if (SPANISH_EL_FEMININE.has(headword.toLocaleLowerCase("es"))) return "el";
    return "la";
  }

  return null;
}

function englishArticle(word: string): string {
  const lower = word.toLocaleLowerCase("en");

  // Acronyms and letter names: an MRI, an FBI agent, an X-ray, a UFO.
  if (/^[A-Z]{2,}/.test(word)) {
    return /^[AEFHILMNORSX]/.test(word) ? "an" : "a";
  }

  if (/^[AEFHILMNORSX](?![a-z])/.test(word)) return "an";

  // Silent h and consonant-sounding vowels.
  if (/^(hour|honest|honor|honour|heir|herb)/.test(lower)) return "an";
  if (/^(uni|use|usu|uti|ure|uro|ubi|eu|ewe|one|once|ouija)/.test(lower)) {
    return "a";
  }

  return /^[aeiou]/.test(lower) ? "an" : "a";
}

function isEnglishNoun(section: string): boolean {
  return (
    /\{\{en-noun\b/i.test(section) ||
    /\{\{head\s*\|\s*en\s*\|\s*noun\b/i.test(section)
  );
}

function hasArticle(word: string, language: ForeignLanguageCode): boolean {
  if (language === "de") {
    return /^(der|die|das|den|dem|des)\s+/i.test(word);
  }

  if (language === "es") {
    return /^(el|la|los|las|un|una|unos|unas)\s+/i.test(word);
  }

  return /^(a|an|the)\s+/i.test(word);
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toLocaleUpperCase("de") + value.slice(1);
}

/**
 * Look up whether an entered foreign word is a noun in Wiktionary and, if so,
 * choose its article. The article is appended to the saved headword so the
 * user does not have to remember German or Spanish gender while reading.
 */
export async function findArticle(
  baseWord: string,
  language: ForeignLanguageCode,
): Promise<ArticleLookup> {
  const input = baseWord.trim();

  // Multi-word phrases and words that already contain an article are left
  // untouched; adding a second article would be wrong.
  if (!input || input.includes(" ") || hasArticle(input, language)) {
    return { word: input, article: null, applied: false };
  }

  // German nouns are capitalised in Wiktionary, so try the canonical form
  // first even when the reader typed a lowercase word.
  const lookupTitle = language === "de" ? capitalizeFirst(input) : input;
  const page = await fetchWiktionaryPage("en", lookupTitle);

  if (!page.wikitext) {
    return { word: input, article: null, applied: false };
  }

  const section = extractLanguageSection(
    page.wikitext,
    LANGUAGE_SECTIONS[language],
  );
  if (!section) {
    return { word: input, article: null, applied: false };
  }

  const headword = page.title || input;
  let article: string | null = null;

  if (language === "de") {
    article = germanArticle(section);
  } else if (language === "es") {
    article = spanishArticle(section, headword);
  } else if (isEnglishNoun(section)) {
    article = englishArticle(headword);
  }

  if (!article) {
    return { word: input, article: null, applied: false };
  }

  return {
    word: `${article} ${headword}`,
    article,
    applied: true,
  };
}
