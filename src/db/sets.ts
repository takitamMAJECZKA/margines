import { firstZodError, setFormSchema, type SetFormValues } from "@/lib/validation";
import { normalizeWord } from "@/lib/utils";

import { DuplicateSetNameError, ValidationError } from "./errors";
import { db } from "./index";
import type { SetWord, Word, WordSet } from "./types";

function createId(): string {
  return crypto.randomUUID();
}

function validate(draft: SetFormValues): SetFormValues {
  const result = setFormSchema.safeParse(draft);
  if (!result.success) {
    throw new ValidationError(firstZodError(result.error));
  }
  return result.data;
}

async function assertNameAvailable(
  dictionaryId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const normalizedName = normalizeWord(name);
  const sets = await db.sets.where("dictionaryId").equals(dictionaryId).toArray();
  const duplicate = sets.some(
    (set) => set.id !== exceptId && normalizeWord(set.name) === normalizedName,
  );

  if (duplicate) {
    throw new DuplicateSetNameError();
  }
}

export async function listSets(dictionaryId: string): Promise<WordSet[]> {
  return db.sets
    .where("[dictionaryId+createdAt]")
    .between(
      [dictionaryId, 0],
      [dictionaryId, Number.MAX_SAFE_INTEGER],
    )
    .toArray();
}

export async function getSet(id: string): Promise<WordSet | undefined> {
  return db.sets.get(id);
}

export async function createSet(
  dictionaryId: string,
  draft: SetFormValues,
): Promise<WordSet> {
  const values = validate(draft);
  const dictionary = await db.dictionaries.get(dictionaryId);
  if (!dictionary) throw new ValidationError("Nie znaleziono słownika.");

  await assertNameAvailable(dictionaryId, values.name);

  const now = Date.now();
  const set: WordSet = {
    id: createId(),
    dictionaryId,
    name: values.name,
    createdAt: now,
    updatedAt: now,
  };

  await db.sets.add(set);
  return set;
}

export async function renameSet(id: string, name: string): Promise<WordSet> {
  const values = validate({ name });
  const existing = await db.sets.get(id);
  if (!existing) throw new ValidationError("Nie znaleziono zestawu.");

  await assertNameAvailable(existing.dictionaryId, values.name, id);

  const updated: WordSet = {
    ...existing,
    name: values.name,
    updatedAt: Date.now(),
  };

  await db.sets.put(updated);
  return updated;
}

/** Removes the set only. The words themselves stay in the dictionary. */
export async function deleteSet(id: string): Promise<void> {
  await db.transaction("rw", db.sets, db.setWords, async () => {
    await db.setWords.where("setId").equals(id).delete();
    await db.sets.delete(id);
  });
}

/** All memberships in a dictionary, used for live counts and edit checkboxes. */
export async function listSetMemberships(
  dictionaryId: string,
): Promise<SetWord[]> {
  return db.setWords.where("dictionaryId").equals(dictionaryId).toArray();
}

export async function listSetIdsForWord(wordId: string): Promise<string[]> {
  const memberships = await db.setWords.where("wordId").equals(wordId).toArray();
  return memberships.map((membership) => membership.setId);
}

export async function listWordsForSet(setId: string): Promise<Word[]> {
  const memberships = await db.setWords.where("setId").equals(setId).toArray();
  if (memberships.length === 0) return [];

  const words = await db.words.bulkGet(
    memberships.map((membership) => membership.wordId),
  );

  return words
    .filter((word): word is Word => Boolean(word))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function addWordToSet(setId: string, wordId: string): Promise<void> {
  const [set, word] = await Promise.all([db.sets.get(setId), db.words.get(wordId)]);

  if (!set || !word || set.dictionaryId !== word.dictionaryId) {
    throw new ValidationError("Nie można dodać słowa do tego zestawu.");
  }

  await db.setWords.put({
    id: `${setId}:${wordId}`,
    setId,
    wordId,
    dictionaryId: word.dictionaryId,
    createdAt: Date.now(),
  });
}

export async function removeWordFromSet(
  setId: string,
  wordId: string,
): Promise<void> {
  await db.setWords.delete(`${setId}:${wordId}`);
}

/**
 * Replaces every membership for one word. Called inside the word write
 * transaction so a word and its sets are saved atomically.
 */
export async function replaceWordSets(
  wordId: string,
  dictionaryId: string,
  setIds: string[],
  timestamp = Date.now(),
): Promise<void> {
  const uniqueIds = [...new Set(setIds)];
  const sets =
    uniqueIds.length > 0 ? await db.sets.bulkGet(uniqueIds) : [];
  const validIds = uniqueIds.filter(
    (id, index) => sets[index]?.dictionaryId === dictionaryId,
  );

  await db.setWords.where("wordId").equals(wordId).delete();

  if (validIds.length > 0) {
    await db.setWords.bulkPut(
      validIds.map((setId) => ({
        id: `${setId}:${wordId}`,
        setId,
        wordId,
        dictionaryId,
        createdAt: timestamp,
      })),
    );
  }
}
