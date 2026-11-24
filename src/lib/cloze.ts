import type { Word } from "@/db/types";
import { escapeRegExp } from "@/lib/utils";

export interface ClozeMatch {
  /** Sentence with the matched word replaced by a blank. */
  sentence: string;
  /** Exact text that was replaced; this is the correct answer for a quiz. */
  answer: string;
}

const ARTICLE_PATTERNS: Record<string, RegExp> = {
  de: /^(?:der|die|das|den|dem|des)\s+/i,
  es: /^(?:el|la|los|las|un|una|unos|unas)\s+/i,
  fr: /^(?:le|la|les|l['’]|un|une|des)\s*/i,
};

const DEFAULT_ARTICLE_PATTERN = /^(?:a|an|the)\s+/i;

export function stripArticle(term: string, language: string): string {
  const pattern = ARTICLE_PATTERNS[language] ?? DEFAULT_ARTICLE_PATTERN;
  return term.replace(pattern, "").trim();
}

function termPattern(term: string, language: string): RegExp {
  const escaped = term
    .split(/\s+/)
    .map((part) => escapeRegExp(part))
    .join("\\s+");
  const endings = language === "de" ? "(?:e|en|er|n|s)?" : "(?:s|es)?";
  return new RegExp(
    `(?<![\\p{L}\\p{M}])${escaped}${endings}(?![\\p{L}\\p{M}])`,
    "iu",
  );
}

function replaceMatch(sentence: string, match: RegExpMatchArray): ClozeMatch {
  const index = match.index ?? 0;
  return {
    sentence: `${sentence.slice(0, index)}_____${sentence.slice(index + match[0].length)}`,
    answer: match[0],
  };
}

/**
 * Finds an exact surface form in a sentence. This is used for forms resolved
 * by the AI or stored on the word, where the spelling is already known and
 * must not be guessed from endings.
 */
export function findExactForm(sentence: string, form: string): ClozeMatch | null {
  const clean = form.trim();
  if (!clean) return null;

  const match = sentence.match(
    new RegExp(
      `(?<![\\p{L}\\p{M}])${escapeRegExp(clean)}(?![\\p{L}\\p{M}])`,
      "iu",
    ),
  );
  if (match?.index === undefined) return null;

  return replaceMatch(sentence, match);
}

/**
 * Tries to locate the dictionary term (or a regular inflection) in a sentence.
 * This is the deterministic fallback used for Tatoeba examples.
 */
export function findSurfaceForm(
  sentence: string,
  term: string,
  language: string,
): ClozeMatch | null {
  const cleaned = sentence.trim();
  const fullTerm = term.trim();
  if (!cleaned || !fullTerm) return null;

  const fullMatch = cleaned.match(termPattern(fullTerm, language));
  if (fullMatch?.index !== undefined) return replaceMatch(cleaned, fullMatch);

  const bareTerm = stripArticle(fullTerm, language);
  if (bareTerm && bareTerm !== fullTerm) {
    const bareMatch = cleaned.match(termPattern(bareTerm, language));
    if (bareMatch?.index !== undefined) return replaceMatch(cleaned, bareMatch);
  }

  // Verbs and other inflected words may not share a regular ending with the
  // dictionary form. A long-enough prefix still lets us blank the right token
  // without touching unrelated short words.
  const singleTerm = bareTerm || fullTerm;
  if (!/\s/.test(singleTerm) && singleTerm.length >= 5) {
    const prefixLength = Math.max(3, Math.ceil(singleTerm.length * 0.6));
    const prefix = singleTerm.slice(0, prefixLength);
    const stemPattern = new RegExp(
      `(?<![\\p{L}\\p{M}])${escapeRegExp(prefix)}[\\p{L}\\p{M}'’]*(?![\\p{L}\\p{M}])`,
      "iu",
    );
    const stemMatch = cleaned.match(stemPattern);
    if (stemMatch?.index !== undefined) return replaceMatch(cleaned, stemMatch);
  }

  return null;
}

/**
 * Finds the word inside its saved example sentence. A form resolved when the
 * example was created (for example by the AI) wins, because irregular verbs
 * like "go → went" cannot be found from the dictionary form alone.
 */
export function clozeForWord(word: Word, language: string): ClozeMatch | null {
  const sentence = word.exampleSentence.trim();
  if (!sentence) return null;

  const storedForm = word.exampleAnswer?.trim();
  if (storedForm) {
    const storedMatch = findExactForm(sentence, storedForm);
    if (storedMatch) return storedMatch;
  }

  return findSurfaceForm(sentence, word.originalWord, language);
}

export function clozeSentence(word: Word, language: string): string | null {
  return clozeForWord(word, language)?.sentence ?? null;
}

export function hasTatoebaExample(word: Word): boolean {
  return Boolean(word.exampleSentence.trim()) && word.exampleSource === "Tatoeba";
}
