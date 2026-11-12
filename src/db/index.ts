import Dexie, { type Table } from "dexie";

import { normalizeWord } from "@/lib/utils";

import type {
  Dictionary,
  LookupCacheEntry,
  MetaEntry,
  SetWord,
  Word,
  WordSet,
} from "./types";

class MarginesDatabase extends Dexie {
  dictionaries!: Table<Dictionary, string>;
  words!: Table<Word, string>;
  meta!: Table<MetaEntry, string>;
  lookups!: Table<LookupCacheEntry, string>;
  sets!: Table<WordSet, string>;
  setWords!: Table<SetWord, string>;

  constructor() {
    super("margines");

    // v1 — initial store, shipped with the first public version of Margines.
    this.version(1).stores({
      dictionaries: "id, name, sourceLanguage, createdAt",
      words: "id, dictionaryId, createdAt",
      meta: "key",
    });

    // v2 — faster per-dictionary queries, review metadata and local lookup cache.
    this.version(2)
      .stores({
        dictionaries: "id, name, sourceLanguage, createdAt",
        words:
          "id, dictionaryId, [dictionaryId+normalizedWord], [dictionaryId+createdAt], createdAt",
        meta: "key",
        lookups: "key, createdAt",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Word>("words")
          .toCollection()
          .modify((word) => {
            word.normalizedWord = normalizeWord(word.originalWord ?? "");
            word.exampleType ??= "manual";
            word.exampleSourceUrl ??= "";
            word.exampleAttribution ??= "";
            word.reviewCount ??= 0;
            word.lastReviewedAt ??= null;
            word.lastReviewKnown ??= null;
            word.updatedAt ??= word.createdAt;
          });
      });

    // v3 — user-created word sets and many-to-many memberships.
    this.version(3).stores({
      dictionaries: "id, name, sourceLanguage, createdAt",
      words:
        "id, dictionaryId, [dictionaryId+normalizedWord], [dictionaryId+createdAt], createdAt",
      meta: "key",
      lookups: "key, createdAt",
      sets: "id, dictionaryId, [dictionaryId+createdAt], createdAt",
      setWords: "id, setId, wordId, dictionaryId, [setId+createdAt]",
    });

    // v4 — keep the user's custom dictionary tab order across reloads.
    this.version(4)
      .stores({
        dictionaries: "id, name, sourceLanguage, createdAt, sortOrder",
        words:
          "id, dictionaryId, [dictionaryId+normalizedWord], [dictionaryId+createdAt], createdAt",
        meta: "key",
        lookups: "key, createdAt",
        sets: "id, dictionaryId, [dictionaryId+createdAt], createdAt",
        setWords: "id, setId, wordId, dictionaryId, [setId+createdAt]",
      })
      .upgrade(async (transaction) => {
        const dictionaries = await transaction
          .table<Dictionary>("dictionaries")
          .orderBy("createdAt")
          .toArray();
        await transaction.table<Dictionary>("dictionaries").bulkPut(
          dictionaries.map((dictionary, sortOrder) => ({
            ...dictionary,
            sortOrder,
          })),
        );
      });

    // v5 — knowledge score and last flashcard appearance for daily reviews.
    this.version(5)
      .stores({
        dictionaries: "id, name, sourceLanguage, createdAt, sortOrder",
        words:
          "id, dictionaryId, [dictionaryId+normalizedWord], [dictionaryId+createdAt], createdAt",
        meta: "key",
        lookups: "key, createdAt",
        sets: "id, dictionaryId, [dictionaryId+createdAt], createdAt",
        setWords: "id, setId, wordId, dictionaryId, [setId+createdAt]",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<Word>("words")
          .toCollection()
          .modify((word) => {
            word.knowledgeScore ??= word.lastReviewKnown
              ? Math.min(5, 1 + Math.floor((word.reviewCount ?? 0) / 2))
              : 0;
            word.lastAppearedAt ??= word.lastReviewedAt ?? null;
          });
      });
  }
}

export const db = new MarginesDatabase();

export type {
  Dictionary,
  LookupCacheEntry,
  MetaEntry,
  SetWord,
  Word,
  WordSet,
};
