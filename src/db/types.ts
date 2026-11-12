import type { DictionaryColor, LanguageCode } from "@/lib/languages";

export type ExampleType = "authentic" | "ai" | "manual";

export interface Dictionary {
  id: string;
  name: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  isNative: boolean;
  color: DictionaryColor;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Word {
  id: string;
  dictionaryId: string;
  originalWord: string;
  /** Lower-cased lookup key, indexed together with dictionaryId. */
  normalizedWord: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
  exampleSource: string;
  exampleSourceUrl: string;
  exampleAttribution: string;
  exampleType: ExampleType;
  /** Review metadata is intentionally lightweight. It gives a future SRS layer something to build on. */
  reviewCount: number;
  lastReviewedAt: number | null;
  /** Whether the latest flashcard answer was "known". Feeds a future SRS scheduler. */
  lastReviewKnown: boolean | null;
  /** User's familiarity rating, clamped to the 0–5 daily review scale. */
  knowledgeScore: number;
  /** Last time this word was shown on a flashcard. */
  lastAppearedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WordSet {
  id: string;
  dictionaryId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Many-to-many link between a word and a user-created set. */
export interface SetWord {
  /** `${setId}:${wordId}` keeps a single membership per pair. */
  id: string;
  setId: string;
  wordId: string;
  dictionaryId: string;
  createdAt: number;
}

export interface MetaEntry {
  key: string;
  value: string | number;
}

export interface LookupCacheEntry {
  key: string;
  dictionaryId: string;
  payload: import("@/types/api").EnrichResponse;
  createdAt: number;
}

export type DictionaryDraft = Pick<
  Dictionary,
  "name" | "sourceLanguage" | "targetLanguage" | "isNative" | "color"
>;

export type WordDraft = Pick<
  Word,
  | "originalWord"
  | "translation"
  | "exampleSentence"
  | "exampleTranslation"
  | "exampleSource"
  | "exampleSourceUrl"
  | "exampleAttribution"
  | "exampleType"
>;
