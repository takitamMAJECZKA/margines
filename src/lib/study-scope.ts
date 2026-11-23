import type { Dictionary, Word, WordSet } from "@/db/types";

/** Virtual set shown in every dictionary. It is never stored in the sets table. */
export const RECENT_SET_ID = "recent-30";
export const RECENT_SET_NAME = "30 ostatnio dodanych";
export const RECENT_SET_LIMIT = 30;

export function isRecentSetId(id: string | null | undefined): boolean {
  return id === RECENT_SET_ID;
}

export function makeRecentSet(dictionary: Pick<Dictionary, "id">): WordSet {
  return {
    id: RECENT_SET_ID,
    dictionaryId: dictionary.id,
    name: RECENT_SET_NAME,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function recentWords(words: Word[]): Word[] {
  return words.slice(0, RECENT_SET_LIMIT);
}

/**
 * Resolves either a real set or the virtual "30 recently added" group.
 */
export function resolveStudySet(
  sets: WordSet[] | undefined,
  id: string | null,
  dictionary: Dictionary | null,
): WordSet | null {
  if (!id || !dictionary) return null;
  if (isRecentSetId(id)) return makeRecentSet(dictionary);
  return sets?.find((set) => set.id === id) ?? null;
}
