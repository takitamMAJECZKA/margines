"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useTheme } from "next-themes";
import { ArrowDown, ArrowLeft, ArrowUp, Languages, Palette } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { listDictionaries, reorderDictionaries } from "@/db/dictionaries";
import type { Dictionary } from "@/db/types";
import { useDatabaseReady } from "@/hooks/use-database-ready";
import { LANGUAGES } from "@/lib/languages";
import {
  readDefaultWordInputLanguage,
  saveUserPreferences,
  subscribeUserPreferences,
  type DefaultWordInputLanguage,
  type ThemePreference,
} from "@/lib/user-preferences";

export function SettingsScreen() {
  const { ready } = useDatabaseReady();
  const dictionaries = useLiveQuery(() => listDictionaries(), []);
  const { theme, setTheme } = useTheme();
  const inputLanguage = useSyncExternalStore(
    subscribeUserPreferences,
    readDefaultWordInputLanguage,
    () => "dictionary" as DefaultWordInputLanguage,
  );
  const [reordering, setReordering] = useState(false);

  async function moveDictionary(index: number, direction: -1 | 1) {
    if (!dictionaries || reordering) return;
    const target = index + direction;
    if (target < 0 || target >= dictionaries.length) return;

    const ids = dictionaries.map((dictionary) => dictionary.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setReordering(true);
    try {
      await reorderDictionaries(ids);
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się zmienić kolejności słowników.");
    } finally {
      setReordering(false);
    }
  }

  function changeInputLanguage(value: DefaultWordInputLanguage) {
    saveUserPreferences({ defaultWordInputLanguage: value });
  }

  function changeTheme(value: ThemePreference) {
    setTheme(value);
    saveUserPreferences({ theme: value });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Wróć do słownika
          </Link>
        </Button>
        <p className="mt-7 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Margines
        </p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-[-0.03em]">
          Ustawienia
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Dostosuj wygląd i sposób dodawania słów. Ustawienia są przygotowane
          tak, by później można je było synchronizować z kontem.
        </p>

        <div className="mt-8 grid gap-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Palette className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-medium">Motyw</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Wybierz jasny, ciemny albo dopasowany do urządzenia.
                </p>
                <select
                  value={theme ?? "system"}
                  onChange={(event) =>
                    changeTheme(event.target.value as ThemePreference)
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:max-w-xs"
                  aria-label="Motyw aplikacji"
                >
                  <option value="system">Zgodny z urządzeniem</option>
                  <option value="light">Jasny</option>
                  <option value="dark">Ciemny</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Languages className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-medium">
                  Domyślny język wpisywania
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Możesz zmienić ten wybór osobno podczas dodawania słowa.
                </p>
                <select
                  value={inputLanguage}
                  onChange={(event) =>
                    changeInputLanguage(
                      event.target.value as DefaultWordInputLanguage,
                    )
                  }
                  className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:max-w-xs"
                  aria-label="Domyślny język wpisywania słów"
                >
                  <option value="dictionary">Język wybranego słownika</option>
                  <option value="polish">Polski</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ArrowUp className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-medium">
                  Kolejność słowników
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Użyj strzałek, aby zmienić kolejność zakładek.
                </p>
                {!ready || dictionaries === undefined ? (
                  <p className="mt-4 text-sm text-muted-foreground">Wczytuję słowniki…</p>
                ) : dictionaries.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nie masz jeszcze żadnych słowników.
                  </p>
                ) : (
                  <ol className="mt-3 divide-y divide-border/70">
                    {dictionaries.map((dictionary, index) => (
                      <DictionaryOrderRow
                        key={dictionary.id}
                        dictionary={dictionary}
                        index={index}
                        total={dictionaries.length}
                        disabled={reordering}
                        onMove={moveDictionary}
                      />
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function DictionaryOrderRow({
  dictionary,
  index,
  total,
  disabled,
  onMove,
}: {
  dictionary: Dictionary;
  index: number;
  total: number;
  disabled: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-5 text-xs tabular-nums text-muted-foreground">
        {index + 1}.
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{dictionary.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          {LANGUAGES[dictionary.sourceLanguage].name}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Przesuń słownik ${dictionary.name} wyżej`}
        onClick={() => onMove(index, -1)}
        disabled={disabled || index === 0}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Przesuń słownik ${dictionary.name} niżej`}
        onClick={() => onMove(index, 1)}
        disabled={disabled || index === total - 1}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
    </li>
  );
}
