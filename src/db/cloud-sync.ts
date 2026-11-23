import type { UserPreferences } from "@/lib/user-preferences";
import {
  DEFAULT_USER_PREFERENCES,
  readUserPreferences,
  replaceUserPreferences,
} from "@/lib/user-preferences";
import { createClient } from "@/lib/supabase/client";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { normalizeWord } from "@/lib/utils";
import type { Dictionary, SetWord, Word, WordSet } from "./types";

import { db } from "./index";

type DictionaryRow = Tables<"dictionaries">;
type WordRow = Tables<"words">;
type WordSetRow = Tables<"word_sets">;
type SetWordRow = Tables<"set_words">;
type PreferencesRow = Tables<"user_preferences">;

const LOCAL_OWNER_KEY = "margines:cloud-owner";
const PENDING_PREFIX = "margines:cloud-sync-pending:";
const PAGE_SIZE = 1000;

let activeUserId: string | null = null;

function pendingKey(userId: string): string {
  return `${PENDING_PREFIX}${userId}`;
}

export function setActiveCloudUser(userId: string | null): void {
  activeUserId = userId;
}

function ensureBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("Dane Supabase można zapisywać tylko w przeglądarce.");
  }
}

async function currentUserId(): Promise<string> {
  if (activeUserId) return activeUserId;
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) {
    throw new Error("Zaloguj się, aby zapisywać dane.");
  }
  activeUserId = data.session.user.id;
  return activeUserId;
}

function toDictionaryRow(
  dictionary: Dictionary,
  userId: string,
): Database["public"]["Tables"]["dictionaries"]["Insert"] {
  return {
    id: dictionary.id,
    user_id: userId,
    name: dictionary.name,
    source_language: dictionary.sourceLanguage,
    target_language: dictionary.targetLanguage,
    is_native: dictionary.isNative,
    color: dictionary.color,
    sort_order: dictionary.sortOrder ?? 0,
    created_at: new Date(dictionary.createdAt).toISOString(),
    updated_at: new Date(dictionary.updatedAt).toISOString(),
  };
}

function fromDictionaryRow(row: DictionaryRow): Dictionary {
  return {
    id: row.id,
    name: row.name,
    sourceLanguage: row.source_language as Dictionary["sourceLanguage"],
    targetLanguage: row.target_language as Dictionary["targetLanguage"],
    isNative: row.is_native,
    color: row.color as Dictionary["color"],
    sortOrder: row.sort_order,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

function toWordRow(
  word: Word,
  userId: string,
): Database["public"]["Tables"]["words"]["Insert"] {
  return {
    id: word.id,
    user_id: userId,
    dictionary_id: word.dictionaryId,
    original_word: word.originalWord,
    normalized_word: word.normalizedWord,
    translation: word.translation,
    example_sentence: word.exampleSentence,
    example_translation: word.exampleTranslation,
    example_source: word.exampleSource,
    example_source_url: word.exampleSourceUrl,
    example_attribution: word.exampleAttribution,
    example_type: word.exampleType,
    review_count: word.reviewCount,
    last_reviewed_at: word.lastReviewedAt,
    last_review_known: word.lastReviewKnown,
    knowledge_score: word.knowledgeScore,
    last_appeared_at: word.lastAppearedAt,
    created_at: word.createdAt,
    updated_at: word.updatedAt,
  };
}

function fromWordRow(row: WordRow): Word {
  return {
    id: row.id,
    dictionaryId: row.dictionary_id,
    originalWord: row.original_word,
    normalizedWord: row.normalized_word,
    translation: row.translation,
    exampleSentence: row.example_sentence,
    exampleTranslation: row.example_translation,
    exampleSource: row.example_source,
    exampleSourceUrl: row.example_source_url,
    exampleAttribution: row.example_attribution,
    exampleType: row.example_type as Word["exampleType"],
    reviewCount: row.review_count,
    lastReviewedAt: row.last_reviewed_at,
    lastReviewKnown: row.last_review_known,
    knowledgeScore: row.knowledge_score,
    lastAppearedAt: row.last_appeared_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWordSetRow(
  set: WordSet,
  userId: string,
): Database["public"]["Tables"]["word_sets"]["Insert"] {
  return {
    id: set.id,
    user_id: userId,
    dictionary_id: set.dictionaryId,
    name: set.name,
    created_at: set.createdAt,
    updated_at: set.updatedAt,
  };
}

function fromWordSetRow(row: WordSetRow): WordSet {
  return {
    id: row.id,
    dictionaryId: row.dictionary_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSetWordRow(
  item: SetWord,
  userId: string,
): Database["public"]["Tables"]["set_words"]["Insert"] {
  return {
    set_id: item.setId,
    word_id: item.wordId,
    dictionary_id: item.dictionaryId,
    user_id: userId,
    created_at: item.createdAt,
  };
}

function fromSetWordRow(row: SetWordRow): SetWord {
  return {
    id: `${row.set_id}:${row.word_id}`,
    setId: row.set_id,
    wordId: row.word_id,
    dictionaryId: row.dictionary_id,
    createdAt: row.created_at,
  };
}

async function fetchAll<K extends "dictionaries" | "words" | "word_sets" | "set_words" | "user_preferences">(
  table: K,
): Promise<Tables<K>[]> {
  const supabase = createClient();
  const rows: Tables<K>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data as Tables<K>[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

function toPreferenceRow(
  userId: string,
  preferences: UserPreferences,
): Database["public"]["Tables"]["user_preferences"]["Insert"] {
  return {
    user_id: userId,
    theme: preferences.theme,
    default_word_input_language: preferences.defaultWordInputLanguage,
    updated_at: new Date().toISOString(),
  };
}

/** One-time merge of the old device-only database into this account. */
async function importLegacyLocalData(userId: string, markImported = true): Promise<void> {
  const supabase = createClient();
  const [localDictionaries, localWords, localSets, localMemberships, remoteDictionaries, remoteWords, remoteSets] =
    await Promise.all([
      db.dictionaries.toArray(),
      db.words.toArray(),
      db.sets.toArray(),
      db.setWords.toArray(),
      fetchAll("dictionaries"),
      fetchAll("words"),
      fetchAll("word_sets"),
    ]);

  const dictionaryIdMap = new Map<string, string>();
  const remoteDictionaryByLanguage = new Map(remoteDictionaries.map((row) => [row.source_language, row]));
  const importedDictionaryIds = new Set<string>();
  const dictionaryRows = localDictionaries.flatMap((dictionary) => {
    const existing = remoteDictionaryByLanguage.get(dictionary.sourceLanguage);
    const priorId = Array.from(dictionaryIdMap.entries()).find(([localId]) =>
      localDictionaries.find((item) => item.id === localId)?.sourceLanguage === dictionary.sourceLanguage,
    )?.[1];
    const id = existing?.id ?? priorId ?? dictionary.id;
    dictionaryIdMap.set(dictionary.id, id);
    if (importedDictionaryIds.has(id)) return [];
    importedDictionaryIds.add(id);
    return {
      ...toDictionaryRow(dictionary, userId),
      id,
      ...(existing ? { name: existing.name, sort_order: existing.sort_order } : {}),
    };
  });
  if (dictionaryRows.length) {
    const { error } = await supabase.from("dictionaries").upsert(dictionaryRows, { onConflict: "id" });
    if (error) throw error;
  }

  const remoteWordByKey = new Map(remoteWords.map((row) => [`${row.dictionary_id}\u0000${row.normalized_word}`, row]));
  const wordIdMap = new Map<string, string>();
  const importedWordIds = new Set<string>();
  const localWordIdByKey = new Map<string, string>();
  const wordRows = localWords.flatMap((word) => {
    const dictionaryId = dictionaryIdMap.get(word.dictionaryId) ?? word.dictionaryId;
    const key = `${dictionaryId}\u0000${word.normalizedWord}`;
    const existing = remoteWordByKey.get(key);
    const id = existing?.id ?? localWordIdByKey.get(key) ?? word.id;
    wordIdMap.set(word.id, id);
    localWordIdByKey.set(key, id);
    if (importedWordIds.has(id)) return [];
    importedWordIds.add(id);
    return [{ ...toWordRow(word, userId), id, dictionary_id: dictionaryId }];
  });
  if (wordRows.length) {
    const { error } = await supabase.from("words").upsert(wordRows, { onConflict: "id" });
    if (error) throw error;
  }

  const remoteSetByKey = new Map(
    remoteSets.map((row) => [`${row.dictionary_id}\u0000${normalizeWord(row.name)}`, row]),
  );
  const setIdMap = new Map<string, string>();
  const localSetIdByKey = new Map<string, string>();
  const importedSetIds = new Set<string>();
  const setRows = localSets.flatMap((set) => {
    const dictionaryId = dictionaryIdMap.get(set.dictionaryId) ?? set.dictionaryId;
    const key = `${dictionaryId}\u0000${normalizeWord(set.name)}`;
    const existing = remoteSetByKey.get(key);
    const id = existing?.id ?? localSetIdByKey.get(key) ?? set.id;
    setIdMap.set(set.id, id);
    localSetIdByKey.set(key, id);
    if (importedSetIds.has(id)) return [];
    importedSetIds.add(id);
    return {
      ...toWordSetRow(set, userId),
      id,
      dictionary_id: dictionaryId,
      ...(existing ? { name: existing.name } : {}),
    };
  });
  if (setRows.length) {
    const { error } = await supabase.from("word_sets").upsert(setRows, { onConflict: "id" });
    if (error) throw error;
  }

  const membershipKeys = new Set<string>();
  const membershipRows = localMemberships.flatMap((membership) => {
    const setId = setIdMap.get(membership.setId);
    const wordId = wordIdMap.get(membership.wordId);
    if (!setId || !wordId) return [];
    const key = `${setId}\u0000${wordId}`;
    if (membershipKeys.has(key)) return [];
    membershipKeys.add(key);
    return [{
      ...toSetWordRow(membership, userId),
      set_id: setId,
      word_id: wordId,
      dictionary_id: dictionaryIdMap.get(membership.dictionaryId) ?? membership.dictionaryId,
    }];
  });
  if (membershipRows.length) {
    const { error } = await supabase.from("set_words").upsert(membershipRows, { onConflict: "set_id,word_id" });
    if (error) throw error;
  }

  const localOnboardingComplete = Boolean(await db.meta.get("onboarding-completed-at"));
  const now = new Date().toISOString();
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  const preferenceUpdate: Database["public"]["Tables"]["user_preferences"]["Update"] = {
    ...readUserPreferencesRow(userId),
    onboarding_completed_at: preferences?.onboarding_completed_at ?? (localOnboardingComplete || localDictionaries.length > 0 ? now : null),
    updated_at: now,
  };
  if (markImported) preferenceUpdate.legacy_imported_at = now;
  const { error: preferenceError } = await supabase
    .from("user_preferences")
    .update(preferenceUpdate)
    .eq("user_id", userId);
  if (preferenceError) throw preferenceError;
}

function readUserPreferencesRow(userId: string): Database["public"]["Tables"]["user_preferences"]["Update"] {
  const preferences = readUserPreferences();
  return {
    user_id: userId,
    theme: preferences.theme,
    default_word_input_language: preferences.defaultWordInputLanguage,
  };
}

async function withPendingSync(
  userId: string,
  operation: () => Promise<void>,
): Promise<void> {
  localStorage.setItem(pendingKey(userId), "1");
  await operation();
  localStorage.removeItem(pendingKey(userId));
}

export async function syncDictionaries(ids?: string[]): Promise<void> {
  const userId = await currentUserId();
  const dictionaries = ids
    ? await db.dictionaries.bulkGet(ids)
    : await db.dictionaries.toArray();
  const rows = dictionaries
    .filter((dictionary): dictionary is NonNullable<typeof dictionary> => Boolean(dictionary))
    .map((dictionary) => toDictionaryRow(dictionary, userId));
  if (!rows.length) return;
  await withPendingSync(userId, async () => {
    const { error } = await createClient().from("dictionaries").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  });
}

export async function syncWord(id: string): Promise<void> {
  const userId = await currentUserId();
  const word = await db.words.get(id);
  if (!word) return;
  const memberships = await db.setWords.where("wordId").equals(id).toArray();
  await withPendingSync(userId, async () => {
    const supabase = createClient();
    const { error } = await supabase.from("words").upsert(toWordRow(word, userId), { onConflict: "id" });
    if (error) throw error;
    const { error: deleteError } = await supabase.from("set_words").delete().eq("word_id", id).eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (memberships.length) {
      const { error: membershipError } = await supabase
        .from("set_words")
        .upsert(memberships.map((item) => toSetWordRow(item, userId)), { onConflict: "set_id,word_id" });
      if (membershipError) throw membershipError;
    }
  });
}

export async function syncWordSet(id: string): Promise<void> {
  const userId = await currentUserId();
  const set = await db.sets.get(id);
  if (!set) return;
  const memberships = await db.setWords.where("setId").equals(id).toArray();
  await withPendingSync(userId, async () => {
    const supabase = createClient();
    const { error } = await supabase.from("word_sets").upsert(toWordSetRow(set, userId), { onConflict: "id" });
    if (error) throw error;
    const { error: deleteError } = await supabase.from("set_words").delete().eq("set_id", id).eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (memberships.length) {
      const { error: membershipError } = await supabase
        .from("set_words")
        .upsert(memberships.map((item) => toSetWordRow(item, userId)), { onConflict: "set_id,word_id" });
      if (membershipError) throw membershipError;
    }
  });
}

export async function syncLocalSnapshot(userId?: string): Promise<void> {
  ensureBrowser();
  const ownerId = userId ?? (await currentUserId());
  activeUserId = ownerId;
  await withPendingSync(ownerId, () => importLegacyLocalData(ownerId, false));
}

async function clearLocalUserData(): Promise<void> {
  await db.transaction(
    "rw",
    db.dictionaries,
    db.words,
    db.sets,
    db.setWords,
    async () => {
      await Promise.all([
        db.dictionaries.clear(),
        db.words.clear(),
        db.sets.clear(),
        db.setWords.clear(),
      ]);
    },
  );
  await Promise.all([db.meta.clear(), db.lookups.clear()]);
}

async function hasLocalData(): Promise<boolean> {
  const [dictionaries, words, sets] = await Promise.all([
    db.dictionaries.count(),
    db.words.count(),
    db.sets.count(),
  ]);
  return dictionaries + words + sets > 0;
}

async function hasRemoteData(userId: string): Promise<boolean> {
  const supabase = createClient();
  const tables = ["dictionaries", "words", "word_sets"] as const;
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function replaceLocalFromCloud(userId: string): Promise<void> {
  const supabase = createClient();
  const [dictionaries, words, sets, memberships, preferences] = await Promise.all([
    fetchAll("dictionaries"),
    fetchAll("words"),
    fetchAll("word_sets"),
    fetchAll("set_words"),
    fetchAll("user_preferences"),
  ]);

  await db.transaction(
    "rw",
    db.dictionaries,
    db.words,
    db.sets,
    db.setWords,
    async () => {
      await Promise.all([
        db.dictionaries.clear(),
        db.words.clear(),
        db.sets.clear(),
        db.setWords.clear(),
      ]);
      if (dictionaries.length) await db.dictionaries.bulkPut(dictionaries.map((row) => fromDictionaryRow(row as DictionaryRow)));
      if (words.length) await db.words.bulkPut(words.map((row) => fromWordRow(row as WordRow)));
      if (sets.length) await db.sets.bulkPut(sets.map((row) => fromWordSetRow(row as WordSetRow)));
      if (memberships.length) await db.setWords.bulkPut(memberships.map((row) => fromSetWordRow(row as SetWordRow)));
    },
  );
  await Promise.all([db.meta.clear(), db.lookups.clear()]);

  const preferencesRow = (preferences as PreferencesRow[]).find((row) => row.user_id === userId);
  if (preferencesRow?.onboarding_completed_at || dictionaries.length > 0) {
    await db.meta.put({ key: "onboarding-completed-at", value: Date.now() });
  }
  if (preferencesRow) {
    replaceUserPreferences({
      theme: preferencesRow.theme as UserPreferences["theme"],
      defaultWordInputLanguage: preferencesRow.default_word_input_language as UserPreferences["defaultWordInputLanguage"],
      showStudyExamples: DEFAULT_USER_PREFERENCES.showStudyExamples,
    });
  } else {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(toPreferenceRow(userId, DEFAULT_USER_PREFERENCES), { onConflict: "user_id" });
    if (error) throw error;
    replaceUserPreferences(DEFAULT_USER_PREFERENCES);
  }
}

const cloudInitializationByUser = new Map<string, Promise<void>>();

export function initializeCloudData(userId: string): Promise<void> {
  const activeInitialization = cloudInitializationByUser.get(userId);
  if (activeInitialization) return activeInitialization;

  const initialization = initializeCloudDataOnce(userId).finally(() => {
    if (cloudInitializationByUser.get(userId) === initialization) {
      cloudInitializationByUser.delete(userId);
    }
  });
  cloudInitializationByUser.set(userId, initialization);
  return initialization;
}

async function initializeCloudDataOnce(userId: string): Promise<void> {
  ensureBrowser();
  activeUserId = userId;
  const ownerId = localStorage.getItem(LOCAL_OWNER_KEY);
  if (ownerId && ownerId !== userId) {
    await clearLocalUserData();
    replaceUserPreferences(DEFAULT_USER_PREFERENCES);
  }

  const [localHasData, onboardingEntry, preferenceResult, remoteHasData] = await Promise.all([
    hasLocalData(),
    db.meta.get("onboarding-completed-at"),
    createClient().from("user_preferences").select("legacy_imported_at, onboarding_completed_at").eq("user_id", userId).maybeSingle(),
    hasRemoteData(userId),
  ]);
  if (preferenceResult.error) throw preferenceResult.error;
  const preference = preferenceResult.data;

  if (!ownerId && localHasData && !preference?.legacy_imported_at) {
    await importLegacyLocalData(userId);
  } else if (localStorage.getItem(pendingKey(userId)) === "1") {
    await syncLocalSnapshot(userId);
  }

  if (!preference?.onboarding_completed_at && onboardingEntry) {
    await syncOnboardingCompletion(userId);
  } else if (!preference?.onboarding_completed_at && remoteHasData) {
    await syncOnboardingCompletion(userId);
  }

  await replaceLocalFromCloud(userId);
  localStorage.setItem(LOCAL_OWNER_KEY, userId);
}

export async function deleteCloudRecord(
  table: "dictionaries" | "words" | "word_sets",
  id: string,
): Promise<void> {
  const userId = await currentUserId();
  await withPendingSync(userId, async () => {
    const { error } = await createClient().from(table).delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  });
}

export async function replaceCloudMembershipsForSet(
  setId: string,
  rows: SetWord[],
): Promise<void> {
  const userId = await currentUserId();
  const supabase = createClient();
  await withPendingSync(userId, async () => {
    const { error: deleteError } = await supabase.from("set_words").delete().eq("set_id", setId).eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error } = await supabase.from("set_words").upsert(rows.map((row) => toSetWordRow(row, userId)), { onConflict: "set_id,word_id" });
    if (error) throw error;
  });
}

export async function replaceCloudMembershipsForWord(
  wordId: string,
  rows: SetWord[],
): Promise<void> {
  const userId = await currentUserId();
  const supabase = createClient();
  await withPendingSync(userId, async () => {
    const { error: deleteError } = await supabase.from("set_words").delete().eq("word_id", wordId).eq("user_id", userId);
    if (deleteError) throw deleteError;
    if (!rows.length) return;
    const { error } = await supabase.from("set_words").upsert(rows.map((row) => toSetWordRow(row, userId)), { onConflict: "set_id,word_id" });
    if (error) throw error;
  });
}

export async function syncPreferences(preferences: UserPreferences): Promise<void> {
  if (!activeUserId || typeof window === "undefined") return;
  const userId = activeUserId;
  await withPendingSync(userId, async () => {
    const { error } = await createClient()
      .from("user_preferences")
      .upsert(toPreferenceRow(userId, preferences), { onConflict: "user_id" });
    if (error) throw error;
  });
}

export async function syncOnboardingCompletion(userId = activeUserId ?? undefined): Promise<void> {
  if (!userId || typeof window === "undefined") return;
  const now = new Date().toISOString();
  const { error } = await createClient()
    .from("user_preferences")
    .update({ onboarding_completed_at: now, updated_at: now })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearCloudUserCache(): Promise<void> {
  activeUserId = null;
  await clearLocalUserData();
  replaceUserPreferences(DEFAULT_USER_PREFERENCES);
}
