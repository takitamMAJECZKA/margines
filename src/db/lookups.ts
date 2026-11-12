import type { EnrichResponse } from "@/types/api";

import { db } from "./index";

export const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;

export function lookupKey(
  sourceLanguage: string,
  targetLanguage: string,
  normalizedWord: string,
): string {
  return `${sourceLanguage}:${targetLanguage}:${normalizedWord}`;
}

export async function getCachedLookup(
  key: string,
): Promise<EnrichResponse | null> {
  const entry = await db.lookups.get(key);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > LOOKUP_TTL_MS) {
    await db.lookups.delete(key);
    return null;
  }

  // Payloads cached while the example service was failing have no sentences.
  // Treat them as stale so retrying an add can fetch examples again.
  if (entry.payload.examples.length === 0) {
    await db.lookups.delete(key);
    return null;
  }

  return entry.payload;
}

export async function saveLookup(
  key: string,
  dictionaryId: string,
  payload: EnrichResponse,
): Promise<void> {
  // Don't cache failed translations — the user may configure a provider later.
  if (!payload.translation.text) return;

  // Don't cache lookups without examples either; a retry should get a fresh
  // chance instead of being stuck for a day with an empty example list.
  if (payload.examples.length === 0) return;

  await db.lookups.put({
    key,
    dictionaryId,
    payload,
    createdAt: Date.now(),
  });
}

export async function clearLookupCache(): Promise<void> {
  await db.lookups.clear();
}
