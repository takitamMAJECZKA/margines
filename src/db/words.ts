import { firstZodError, wordDraftSchema, type WordDraftValues } from "@/lib/validation";
import { normalizeWord } from "@/lib/utils";

import { DuplicateWordError, ValidationError } from "./errors";
import { db } from "./index";
import { replaceWordSets } from "./sets";
import type { Word } from "./types";
import type { AuthenticExample } from "@/types/api";

function createId(): string {
  return crypto.randomUUID();
}

function validate(draft: WordDraftValues): WordDraftValues {
  const result = wordDraftSchema.safeParse(draft);
  if (!result.success) {
    throw new ValidationError(firstZodError(result.error));
  }
  return result.data;
}

function sanitizeExample(draft: WordDraftValues): WordDraftValues {
  const hasExample = draft.exampleSentence.length > 0;

  if (!hasExample) {
    return {
      ...draft,
      exampleSentence: "",
      exampleTranslation: "",
      exampleAnswer: "",
      exampleSource: "",
      exampleSourceUrl: "",
      exampleAttribution: "",
      exampleType: "manual",
    };
  }

  if (draft.exampleType === "manual") {
    return {
      ...draft,
      exampleAnswer: "",
      exampleSource: "",
      exampleSourceUrl: "",
      exampleAttribution: "",
    };
  }

  return { ...draft, exampleAnswer: draft.exampleAnswer ?? "" };
}

async function assertUniqueWord(
  dictionaryId: string,
  normalized: string,
  exceptId?: string,
): Promise<void> {
  const duplicate = await db.words
    .where("[dictionaryId+normalizedWord]")
    .equals([dictionaryId, normalized])
    .first();

  if (duplicate && duplicate.id !== exceptId) {
    throw new DuplicateWordError();
  }
}

export async function listWords(dictionaryId: string): Promise<Word[]> {
  return db.words
    .where("[dictionaryId+createdAt]")
    .between([dictionaryId, 0], [dictionaryId, Number.MAX_SAFE_INTEGER])
    .reverse()
    .toArray();
}

export async function countWords(dictionaryId: string): Promise<number> {
  return db.words.where("dictionaryId").equals(dictionaryId).count();
}

export async function findWordByText(
  dictionaryId: string,
  originalWord: string,
): Promise<Word | undefined> {
  return db.words
    .where("[dictionaryId+normalizedWord]")
    .equals([dictionaryId, normalizeWord(originalWord)])
    .first();
}

export async function createWord(
  dictionaryId: string,
  rawDraft: WordDraftValues,
  setIds: string[] = [],
): Promise<Word> {
  const draft = sanitizeExample(validate(rawDraft));
  const dictionary = await db.dictionaries.get(dictionaryId);
  if (!dictionary) throw new ValidationError("Nie znaleziono słownika.");

  const normalized = normalizeWord(draft.originalWord);
  await assertUniqueWord(dictionaryId, normalized);

  const now = Date.now();
  const word: Word = {
    ...draft,
    id: createId(),
    dictionaryId,
    normalizedWord: normalized,
    reviewCount: 0,
    lastReviewedAt: null,
    lastReviewKnown: null,
    knowledgeScore: 0,
    lastAppearedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // The compound index protects against a race between the duplicate check and add.
    await db.transaction("rw", db.words, db.setWords, db.sets, async () => {
      await db.words.add(word);
      await replaceWordSets(word.id, dictionaryId, setIds, now);
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ConstraintError") {
      throw new DuplicateWordError();
    }
    throw error;
  }

  return word;
}

export async function updateWord(
  id: string,
  rawDraft: WordDraftValues,
  setIds?: string[],
): Promise<Word> {
  const draft = sanitizeExample(validate(rawDraft));
  const existing = await db.words.get(id);
  if (!existing) throw new ValidationError("Nie znaleziono słowa.");

  const normalized = normalizeWord(draft.originalWord);
  await assertUniqueWord(existing.dictionaryId, normalized, id);

  const updated: Word = {
    ...existing,
    ...draft,
    normalizedWord: normalized,
    updatedAt: Date.now(),
  };

  try {
    await db.transaction("rw", db.words, db.setWords, db.sets, async () => {
      await db.words.put(updated);
      if (setIds) {
        await replaceWordSets(id, existing.dictionaryId, setIds, updated.updatedAt);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ConstraintError") {
      throw new DuplicateWordError();
    }
    throw error;
  }

  return updated;
}

/** Add an asynchronously found example without replacing user edits. */
export async function attachExampleIfEmpty(
  id: string,
  example: AuthenticExample,
): Promise<void> {
  await db.transaction("rw", db.words, async () => {
    const existing = await db.words.get(id);
    if (!existing || existing.exampleSentence) return;

    await db.words.update(id, {
      exampleSentence: example.text,
      exampleTranslation: example.translation,
      exampleAnswer: example.answer?.trim() ?? "",
      exampleSource: example.source,
      exampleSourceUrl: example.sourceUrl,
      exampleAttribution: example.attribution,
      exampleType: example.source === "AI" ? "ai" : "authentic",
      updatedAt: Date.now(),
    });
  });
}

export async function deleteWord(id: string): Promise<void> {
  await db.transaction("rw", db.words, db.setWords, async () => {
    await db.setWords.where("wordId").equals(id).delete();
    await db.words.delete(id);
  });
}

/**
 * Restores a word removed by a swipe, including its set memberships. The
 * original record is reused so the word keeps its id, review history and
 * creation date.
 */
export async function restoreWord(
  word: Word,
  setIds: string[] = [],
): Promise<void> {
  const dictionary = await db.dictionaries.get(word.dictionaryId);
  if (!dictionary) throw new ValidationError("Nie znaleziono słownika.");

  try {
    await db.transaction(
      "rw",
      db.words,
      db.setWords,
      db.sets,
      async () => {
        await assertUniqueWord(word.dictionaryId, word.normalizedWord, word.id);
        await db.words.put(word);
        await replaceWordSets(
          word.id,
          word.dictionaryId,
          setIds,
          word.updatedAt,
        );
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ConstraintError") {
      throw new DuplicateWordError();
    }
    throw error;
  }
}

/** Review metadata needed to restore a word after an accidental swipe. */
export interface WordProgress {
  reviewCount: number;
  lastReviewedAt: number | null;
  lastReviewKnown: boolean | null;
  knowledgeScore: number;
}

function readProgress(word: Word): WordProgress {
  return {
    reviewCount: word.reviewCount ?? 0,
    lastReviewedAt: word.lastReviewedAt ?? null,
    lastReviewKnown: word.lastReviewKnown ?? null,
    knowledgeScore: word.knowledgeScore ?? 0,
  };
}

/**
 * Saves an answer and returns the progress values from just before it, so an
 * undone swipe can put the word back exactly where it was.
 */
export async function recordReview(
  id: string,
  known: boolean,
  updateKnowledgeScore = false,
): Promise<WordProgress | null> {
  const word = await db.words.get(id);
  if (!word) return null;

  const previous = readProgress(word);

  await db.words.update(id, {
    reviewCount: previous.reviewCount + 1,
    lastReviewedAt: Date.now(),
    lastReviewKnown: known,
    ...(updateKnowledgeScore
      ? {
          knowledgeScore: Math.max(
            0,
            Math.min(5, previous.knowledgeScore + (known ? 1 : -1)),
          ),
        }
      : {}),
    updatedAt: Date.now(),
  });

  return previous;
}

/** Reverts a review saved by {@link recordReview}. */
export async function restoreWordProgress(
  id: string,
  progress: WordProgress,
): Promise<void> {
  await db.words.update(id, { ...progress, updatedAt: Date.now() });
}

export async function markWordAppeared(id: string): Promise<void> {
  const now = Date.now();
  await db.words.update(id, { lastAppearedAt: now, updatedAt: now });
}
