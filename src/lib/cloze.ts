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
 * Finds the word inside its saved example sentence. Tatoeba often returns an
 * inflected form, so after an exact match we also try the word without its
 * article and finally a conservative prefix match.
 */
export function clozeForWord(word: Word, language: string): ClozeMatch | null {
  const sentence = word.exampleSentence.trim();
  if (!sentence) return null;

  const fullTerm = word.originalWord.trim();
  if (!fullTerm) return null;

  const fullMatch = sentence.match(termPattern(fullTerm, language));
  if (fullMatch?.index !== undefined) return replaceMatch(sentence, fullMatch);

  const bareTerm = stripArticle(fullTerm, language);
  if (bareTerm && bareTerm !== fullTerm) {
    const bareMatch = sentence.match(termPattern(bareTerm, language));
    if (bareMatch?.index !== undefined) return replaceMatch(sentence, bareMatch);
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
    const stemMatch = sentence.match(stemPattern);
    if (stemMatch?.index !== undefined) return replaceMatch(sentence, stemMatch);
  }

  return null;
}

export function clozeSentence(word: Word, language: string): string | null {
  return clozeForWord(word, language)?.sentence ?? null;
}

export function hasTatoebaExample(word: Word): boolean {
  return Boolean(word.exampleSentence.trim()) && word.exampleSource === "Tatoeba";
}
