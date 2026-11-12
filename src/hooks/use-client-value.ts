"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True after hydration. Useful when server and client markup must match while
 * still allowing browser-only values (theme, standalone mode) to be read.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Reads a stable, client-only value without setting state in an effect.
 * `serverSnapshot` is used during SSR and the hydration pass.
 */
export function useClientValue<T>(getSnapshot: () => T, serverSnapshot: T): T {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
