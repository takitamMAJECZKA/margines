import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Stable key used for duplicate detection. Keeps diacritics because they are
 * meaningful in Spanish, but normalises case, width and whitespace.
 */
export function normalizeWord(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl");
}

/** Accent-insensitive text used only for searching the user's own list. */
export function foldForSearch(value: string): string {
  return normalizeWord(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function formatAddedDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (dayDifference === 0) return "dzisiaj";
  if (dayDifference === 1) return "wczoraj";

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function pluralizePolish(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count === 1) return one;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function wordCountLabel(count: number): string {
  return `${count} ${pluralizePolish(count, "słowo", "słowa", "słów")}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
