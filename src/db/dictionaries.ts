import {
  DICTIONARY_COLORS,
  DEFAULT_DICTIONARY_META,
  type LanguageCode,
} from "@/lib/languages";
import {
  dictionaryFormSchema,
  firstZodError,
  type DictionaryFormValues,
} from "@/lib/validation";
import { normalizeWord } from "@/lib/utils";

import { DuplicateDictionaryNameError, ValidationError } from "./errors";
import { db } from "./index";
import type { Dictionary } from "./types";

function createId(): string {
  return crypto.randomUUID();
}

function validate(draft: DictionaryFormValues): DictionaryFormValues {
  const result = dictionaryFormSchema.safeParse(draft);
  if (!result.success) {
    throw new ValidationError(firstZodError(result.error));
  }
  return result.data;
}

async function assertNameAvailable(name: string, exceptId?: string): Promise<void> {
  const normalizedName = normalizeWord(name);
  const dictionaries = await db.dictionaries.toArray();
  const duplicate = dictionaries.some(
    (dictionary) =>
      dictionary.id !== exceptId && normalizeWord(dictionary.name) === normalizedName,
  );

  if (duplicate) {
    throw new DuplicateDictionaryNameError();
  }
}

async function assertLanguageAvailable(
  sourceLanguage: LanguageCode,
  exceptId?: string,
): Promise<void> {
  const duplicate = await db.dictionaries
    .where("sourceLanguage")
    .equals(sourceLanguage)
    .filter((dictionary) => dictionary.id !== exceptId)
    .first();

  if (duplicate) {
    throw new ValidationError("Masz już słownik dla tego języka.");
  }
}

export async function listDictionaries(): Promise<Dictionary[]> {
  const dictionaries = await db.dictionaries.toArray();
  return dictionaries.sort(
    (left, right) =>
      (left.sortOrder ?? left.createdAt) - (right.sortOrder ?? right.createdAt),
  );
}

export async function reorderDictionaries(ids: string[]): Promise<void> {
  await db.transaction("rw", db.dictionaries, async () => {
    const dictionaries = await db.dictionaries.toArray();
    const byId = new Map(dictionaries.map((dictionary) => [dictionary.id, dictionary]));
    const ordered = ids.map((id) => byId.get(id)).filter((item) => item !== undefined);
    const included = new Set(ordered.map((dictionary) => dictionary.id));
    ordered.push(...dictionaries.filter((dictionary) => !included.has(dictionary.id)));
    await db.dictionaries.bulkPut(
      ordered.map((dictionary, sortOrder) => ({ ...dictionary, sortOrder })),
    );
  });
}

export async function getDictionary(id: string): Promise<Dictionary | undefined> {
  return db.dictionaries.get(id);
}

/**
 * Create the dictionaries chosen on the first-run onboarding screen. Polish is
 * created as the native, monolingual dictionary; the others translate to
 * Polish.
 */
export async function createInitialDictionaries(
  languages: LanguageCode[],
): Promise<Dictionary[]> {
  const unique = Array.from(new Set(languages));

  if (unique.length === 0) {
    throw new ValidationError("Wybierz co najmniej jeden słownik.");
  }

  const existing = await db.dictionaries.toArray();
  if (unique.some((code) => existing.some((dictionary) => dictionary.sourceLanguage === code))) {
    throw new ValidationError("Możesz utworzyć tylko jeden słownik dla każdego języka.");
  }
  const names = new Set(existing.map((dictionary) => normalizeWord(dictionary.name)));
  const usedColors = new Set(existing.map((dictionary) => dictionary.color));
  const now = Date.now();

  const dictionaries = unique.map((code, index) => {
    const meta = DEFAULT_DICTIONARY_META[code];
    const preferredColor = meta.color;
    const color = usedColors.has(preferredColor)
      ? (DICTIONARY_COLORS.find((candidate) => !usedColors.has(candidate)) ??
        preferredColor)
      : preferredColor;

    let name = meta.name;
    let suffix = 2;
    while (names.has(normalizeWord(name))) {
      name = `${meta.name} ${suffix}`;
      suffix += 1;
    }

    names.add(normalizeWord(name));
    usedColors.add(color);

    const values = validate({
      name,
      sourceLanguage: code,
      targetLanguage: "pl",
      isNative: code === "pl",
      color,
    });

    return {
      ...values,
      id: createId(),
      sortOrder: existing.length + index,
      createdAt: now + index,
      updatedAt: now + index,
    } satisfies Dictionary;
  });

  await db.dictionaries.bulkAdd(dictionaries);
  return dictionaries;
}

export async function createDictionary(
  draft: DictionaryFormValues,
): Promise<Dictionary> {
  const values = validate(draft);

  const now = Date.now();
  let dictionary: Dictionary = {
    ...values,
    id: createId(),
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction("rw", db.dictionaries, async () => {
    await assertLanguageAvailable(values.sourceLanguage);
    await assertNameAvailable(values.name);
    const dictionaries = await db.dictionaries.toArray();
    dictionary = {
      ...dictionary,
      sortOrder:
        Math.max(-1, ...dictionaries.map((item) => item.sortOrder ?? -1)) + 1,
    };
    await db.dictionaries.add(dictionary);
  });
  return dictionary;
}

export async function updateDictionary(
  id: string,
  draft: DictionaryFormValues,
): Promise<Dictionary> {
  const values = validate(draft);
  const existing = await db.dictionaries.get(id);
  if (!existing) throw new ValidationError("Nie znaleziono słownika.");

  await assertNameAvailable(values.name, id);

  const updated: Dictionary = {
    ...existing,
    ...values,
    updatedAt: Date.now(),
  };

  await db.dictionaries.put(updated);
  return updated;
}

export async function renameDictionary(id: string, name: string): Promise<Dictionary> {
  const existing = await db.dictionaries.get(id);
  if (!existing) throw new ValidationError("Nie znaleziono słownika.");

  return updateDictionary(id, { ...existing, name });
}

export async function deleteDictionary(id: string): Promise<void> {
  await db.transaction(
    "rw",
    db.dictionaries,
    db.words,
    db.sets,
    db.setWords,
    async () => {
      await db.setWords.where("dictionaryId").equals(id).delete();
      await db.sets.where("dictionaryId").equals(id).delete();
      await db.words.where("dictionaryId").equals(id).delete();
      await db.dictionaries.delete(id);
    },
  );
}
