"use client";

import { useCallback, useMemo, useState } from "react";

import type { Dictionary } from "@/db/types";

export const SELECTED_DICTIONARY_KEY = "margines:selected-dictionary";

export function readSelectedDictionaryId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(SELECTED_DICTIONARY_KEY);
  } catch {
    return null;
  }
}

export function persistSelectedDictionaryId(id: string): void {
  try {
    window.localStorage.setItem(SELECTED_DICTIONARY_KEY, id);
  } catch {
    // Private mode / blocked storage: selection still works for this session.
  }
}

export function useDictionarySelection(
  dictionaries: Dictionary[] | undefined,
  preferredId?: string | null,
) {
  // Read the stored selection once, on mount, instead of syncing it in an effect.
  const [explicitId, setExplicitId] = useState<string | null>(() =>
    readSelectedDictionaryId(),
  );

  const selected = useMemo(() => {
    if (!dictionaries || dictionaries.length === 0) return null;

    if (preferredId) {
      const preferred = dictionaries.find((dictionary) => dictionary.id === preferredId);
      if (preferred) return preferred;
    }

    if (explicitId) {
      const match = dictionaries.find((dictionary) => dictionary.id === explicitId);
      if (match) return match;
    }

    // Deleted or missing selection: fall back to the first dictionary.
    return dictionaries[0] ?? null;
  }, [dictionaries, explicitId, preferredId]);

  const select = useCallback((id: string) => {
    setExplicitId(id);
    persistSelectedDictionaryId(id);
  }, []);

  return {
    selected,
    select,
    selectedId: selected?.id ?? null,
  };
}
