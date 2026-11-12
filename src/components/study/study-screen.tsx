"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  FolderOpen,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { OfflineBadge } from "@/components/offline-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Skeleton } from "@/components/ui/skeleton";
import { listDictionaries } from "@/db/dictionaries";
import { listSets, listWordsForSet } from "@/db/sets";
import type { Word, WordSet } from "@/db/types";
import { recordReview, listWords } from "@/db/words";
import { useDatabaseReady } from "@/hooks/use-database-ready";
import { useDictionarySelection } from "@/hooks/use-dictionary-selection";
import {
  DICTIONARY_COLOR_HEX,
  LANGUAGES,
  languagePairLabel,
} from "@/lib/languages";
import { pluralizePolish, wordCountLabel } from "@/lib/utils";

import { studyReducer } from "./session-reducer";
import { SwipeableCard } from "./swipeable-card";

function translationSizeClass(text: string): string {
  const length = text.length;
  if (length < 45) return "text-[clamp(2rem,9vw,3.5rem)]";
  if (length < 105) return "text-[clamp(1.55rem,6.5vw,2.5rem)]";
  if (length < 220) return "text-lg sm:text-xl";
  return "text-base sm:text-lg";
}

function clozeSentence(word: Word, language: string): string | null {
  let term = word.originalWord.trim();
  const articlePattern =
    language === "de"
      ? /^(?:der|die|das|den|dem|des)\s+/i
      : language === "es"
        ? /^(?:el|la|los|las|un|una|unos|unas)\s+/i
        : /^(?:a|an|the)\s+/i;
  term = term.replace(articlePattern, "").trim();
  if (!term) return null;

  const escaped = term
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const endings = language === "de" ? "(?:e|en|er|n|s)?" : "(?:s|es)?";
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{M}])${escaped}${endings}(?![\\p{L}\\p{M}])`,
    "iu",
  );
  const cloze = word.exampleSentence.replace(pattern, "_____");
  return cloze === word.exampleSentence ? null : cloze;
}

function StudyHeader() {
  return (
    <header className="border-b border-border/60 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft />
            Słownik
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <OfflineBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function StudyEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card">
        <BookOpen className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button asChild className="mt-7">
        <Link href="/">Wróć do słownika</Link>
      </Button>
    </main>
  );
}

export function StudyScreenFallback() {
  return (
    <div className="flex min-h-dvh flex-col">
      <StudyHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4">
        <Skeleton className="h-[26rem] w-full rounded-3xl" />
      </main>
    </div>
  );
}

export function StudyScreen() {
  const searchParams = useSearchParams();
  const initialSetId = searchParams.get("set");
  const initialDictionaryId = searchParams.get("dictionary");

  return (
    <StudyScreenContent
      key={`${initialDictionaryId ?? "selected"}:${initialSetId ?? "all"}`}
      initialSetId={initialSetId}
      initialDictionaryId={initialDictionaryId}
    />
  );
}

function StudyScreenContent({
  initialSetId,
  initialDictionaryId,
}: {
  initialSetId: string | null;
  initialDictionaryId: string | null;
}) {
  const { ready } = useDatabaseReady();
  const dictionaries = useLiveQuery(() => listDictionaries(), []);
  const { selected } = useDictionarySelection(dictionaries, initialDictionaryId);

  const sets = useLiveQuery(
    () => (selected ? listSets(selected.id) : Promise.resolve([] as WordSet[])),
    [selected?.id],
  );

  const [scopeId, setScopeId] = useState<string | null>(initialSetId);
  const scopedSet = useMemo(
    () => (scopeId ? (sets?.find((set) => set.id === scopeId) ?? null) : null),
    [scopeId, sets],
  );

  const words = useLiveQuery(
    () =>
      selected && sets
        ? scopedSet
          ? listWordsForSet(scopedSet.id)
          : listWords(selected.id)
        : undefined,
    [selected?.id, sets, scopedSet?.id],
  );

  const [session, dispatch] = useReducer(studyReducer, null);

  function startSession() {
    if (!words || words.length === 0) return;
    dispatch({ type: "start", words });
  }

  function changeScope(id: string) {
    setScopeId(id || null);
    dispatch({ type: "reset" });
  }

  function answer(known: boolean) {
    if (!session?.current) return;

    const { id } = session.current;
    dispatch({ type: "answer", known });
    void recordReview(id, known).catch((error) => {
      console.error("Could not save review", error);
    });
  }

  useEffect(() => {
    if (!session || session.finished) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, button, a") ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!session?.revealed && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        dispatch({ type: "reveal" });
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        answer(false);
      }

      if (event.key === "2") {
        event.preventDefault();
        answer(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // answer is derived from the current session; the listener is re-bound on each state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!ready || dictionaries === undefined || sets === undefined) {
    return <StudyScreenFallback />;
  }

  if (!selected) {
    return (
      <div className="flex min-h-dvh flex-col">
        <StudyHeader />
        <StudyEmpty
          title="Brak słowników"
          description="Utwórz najpierw słownik i dodaj do niego słowa, aby rozpocząć naukę."
        />
      </div>
    );
  }

  if (words === undefined) {
    return <StudyScreenFallback />;
  }

  if (words.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <StudyHeader />
        {scopedSet ? (
          <StudyEmpty
            title="Ten zestaw jest pusty"
            description={`Dodaj słowa do zestawu „${scopedSet.name}” na stronie głównej, aby uczyć się ich fiszkami.`}
          />
        ) : (
          <StudyEmpty
            title="Ten słownik jest pusty"
            description={`Dodaj słowa do słownika „${selected.name}”, aby uczyć się ich fiszkami.`}
          />
        )}
      </div>
    );
  }

  const total = session?.cards.length ?? words.length;
  const knownCount = session?.knownIds.length ?? 0;
  const progress = total === 0 ? 0 : Math.round((knownCount / total) * 100);
  const clozePrompt =
    session?.current && !selected.isNative && session.current.exampleSentence
      ? clozeSentence(session.current, selected.sourceLanguage)
      : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyHeader />

      {!session ? (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Tryb nauki
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
            Gotowy na powtórkę?
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Na przodzie widzisz polskie tłumaczenie. Odsłoń słowo w języku obcym,
            oceń, czy je znasz, a trudne fiszki wrócą w tej sesji jeszcze raz.
          </p>

          <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card">
            {sets.length > 0 ? (
              <div className="mb-5 grid gap-2">
                <Label htmlFor="study-scope">Zakres nauki</Label>
                <NativeSelect
                  id="study-scope"
                  value={scopedSet?.id ?? ""}
                  onChange={(event) => changeScope(event.target.value)}
                >
                  <option value="">Wszystkie słowa</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            <div className="flex items-center gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {scopedSet ? (
                  <FolderOpen className="size-5" aria-hidden="true" />
                ) : (
                  <Layers className="size-5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: DICTIONARY_COLOR_HEX[selected.color],
                    }}
                  />
                  <p className="truncate font-display text-xl font-medium">
                    {scopedSet?.name ?? selected.name}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {languagePairLabel(
                    selected.sourceLanguage,
                    selected.targetLanguage,
                    selected.isNative,
                  )}{" "}
                  · {wordCountLabel(words.length)}
                  {scopedSet ? " · tylko ten zestaw" : ""}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {words.length}{" "}
                {pluralizePolish(words.length, "fiszka", "fiszki", "fiszek")}
              </Badge>
            </div>

            <div className="mt-5 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Front pokazuje polskie tłumaczenie. Przesuń fiszkę w lewo, jeśli nie
              znasz słowa, albo w prawo, jeśli je znasz — bez odwracania karty.
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={startSession}
            className="mt-4 h-13 w-full text-[0.95rem]"
          >
            <Play />
            Rozpocznij sesję
          </Button>

          <div className="mt-5 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
                Spacja
              </kbd>
              odsłania
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
                1
              </kbd>
              /{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
                2
              </kbd>
              ocenia
            </span>
            <Link href="/" className="underline decoration-border underline-offset-4 hover:text-foreground">
              Wróć do słownika
            </Link>
          </div>
        </main>
      ) : session.finished ? (
        <StudySummary
          session={session}
          contextName={scopedSet?.name ?? selected.name}
          onRestart={startSession}
          onChangeScope={() => dispatch({ type: "reset" })}
        />
      ) : (
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-9">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-foreground">
              {scopedSet?.name ?? selected.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {knownCount} / {total} opanowane
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Postęp sesji"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={knownCount}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {session.current ? (
            <div
              key={`${session.current.id}-${session.attempts}`}
              className="mt-7 animate-in duration-200 fade-in-0 slide-in-from-bottom-1"
            >
              <SwipeableCard
                enabled
                onAnswer={answer}
                className="rounded-3xl border border-border bg-card shadow-card"
              >
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 sm:px-6">
                <Badge variant="outline" className="tracking-[0.12em]">
                  {LANGUAGES[selected.sourceLanguage].short} →{" "}
                  {LANGUAGES[selected.targetLanguage].short}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Pozostało {session.queue.length}
                </span>
              </div>

              {!session.revealed ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "reveal" })}
                  className="flex min-h-[21rem] w-full flex-col items-center justify-center px-6 py-10 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:min-h-[25rem]"
                >
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {LANGUAGES[selected.targetLanguage].name}
                  </span>
                  {clozePrompt ? (
                    <div className="mt-5 max-h-56 w-full max-w-full overflow-y-auto overscroll-contain px-1">
                      <p className="mb-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        {LANGUAGES[selected.sourceLanguage].name} · uzupełnij słowo
                      </p>
                      <p className={`font-display leading-[1.15] font-medium tracking-[-0.025em] whitespace-pre-line break-words ${translationSizeClass(clozePrompt)}`}>
                        „{clozePrompt}”
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 max-h-56 w-full max-w-full overflow-y-auto overscroll-contain px-1">
                      <p className={`font-display leading-[1.12] font-medium tracking-[-0.03em] whitespace-pre-line break-words ${translationSizeClass(session.current.translation)}`}>
                        {session.current.translation}
                      </p>
                    </div>
                  )}
                  {clozePrompt ? (
                    <div className="mt-4 max-h-20 max-w-full overflow-y-auto px-2">
                      <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                        Po polsku
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                        {session.current.translation}
                      </p>
                    </div>
                  ) : null}
                  <span className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="size-3.5" aria-hidden="true" />
                    Dotknij, aby odsłonić · przesuń, aby ocenić
                  </span>
                </button>
              ) : (
                <div className="flex min-h-[21rem] flex-col items-center px-6 py-10 text-center duration-200 animate-in fade-in-0 slide-in-from-bottom-1 sm:min-h-[25rem]">
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {LANGUAGES[selected.sourceLanguage].name}
                  </span>
                  <p className={`mt-4 max-h-48 max-w-full overflow-y-auto font-display leading-[1.1] font-medium tracking-[-0.03em] whitespace-pre-line break-words ${translationSizeClass(session.current.originalWord)}`}>
                    {session.current.originalWord}
                  </p>
                  <div className="my-5 h-px w-14 bg-border" />
                  <p className="text-sm text-muted-foreground">
                    {session.current.translation}
                  </p>

                  {session.current.exampleSentence ? (
                    <blockquote className="mx-auto mt-7 max-w-md border-t border-border/70 pt-5">
                      <p className="text-sm leading-relaxed text-foreground/85">
                        „{session.current.exampleSentence}”
                      </p>
                      {session.current.exampleTranslation ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {session.current.exampleTranslation}
                        </p>
                      ) : null}
                    </blockquote>
                  ) : null}
                </div>
              )}

              <div
                data-swipe-ignore
                className="border-t border-border/60 p-4 sm:p-5"
              >
                {!session.revealed ? (
                  <Button
                    type="button"
                    onClick={() => dispatch({ type: "reveal" })}
                    className="h-12 w-full"
                  >
                    <Eye />
                    Pokaż słowo
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => answer(false)}
                      aria-keyshortcuts="1"
                      className="h-12 border-destructive/25 text-destructive hover:bg-destructive/[0.06] hover:text-destructive"
                    >
                      <RotateCcw />
                      Nie znam
                      <kbd className="ml-1 hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 sm:inline">
                        1
                      </kbd>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => answer(true)}
                      aria-keyshortcuts="2"
                      className="h-12"
                    >
                      <Check />
                      Znam
                      <kbd className="ml-1 hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 sm:inline">
                        2
                      </kbd>
                    </Button>
                  </div>
                )}
              </div>
              </SwipeableCard>
            </div>
          ) : null}

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            Przesuń fiszkę w lewo, aby powtórzyć, albo w prawo, aby oznaczyć ją jako
            znaną. „Nie znam” wraca na koniec sesji.
          </p>
        </main>
      )}
    </div>
  );
}

function StudySummary({
  session,
  contextName,
  onRestart,
  onChangeScope,
}: {
  session: NonNullable<ReturnType<typeof studyReducer>>;
  contextName: string;
  onRestart: () => void;
  onChangeScope: () => void;
}) {
  const total = session.cards.length;
  const firstTry = session.firstTryKnownIds.length;
  const firstTryPercent = total > 0 ? Math.round((firstTry / total) * 100) : 0;
  const missedWords = session.cards
    .filter((word) => (session.misses[word.id] ?? 0) > 0)
    .sort((a, b) => (session.misses[b.id] ?? 0) - (session.misses[a.id] ?? 0));

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {contextName}
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">
          Sesja ukończona
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Wszystkie fiszki z tej sesji są już oznaczone jako znane.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card py-4 shadow-card">
        <div className="px-3 text-center">
          <p className="font-display text-2xl font-medium">{total}</p>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            {pluralizePolish(total, "słowo", "słowa", "słów")}
          </p>
        </div>
        <div className="px-3 text-center">
          <p className="font-display text-2xl font-medium">{session.attempts}</p>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            {pluralizePolish(session.attempts, "odpowiedź", "odpowiedzi", "odpowiedzi")}
          </p>
        </div>
        <div className="px-3 text-center">
          <p className="font-display text-2xl font-medium">{firstTryPercent}%</p>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            za 1. razem
          </p>
        </div>
      </div>

      {missedWords.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
          <h2 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Wymagały powtórki
          </h2>
          <ul className="mt-3 divide-y divide-border/70">
            {missedWords.map((word) => (
              <li
                key={word.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{word.originalWord}</span>
                  <span className="text-muted-foreground"> — {word.translation}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {session.misses[word.id]}×
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-emerald-600/15 bg-emerald-600/[0.055] px-4 py-3.5 text-center text-sm text-emerald-800 dark:text-emerald-300">
          Wszystkie słowa znałeś od pierwszego razu. Świetnie!
        </p>
      )}

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        <Button type="button" size="lg" onClick={onRestart}>
          <RotateCcw />
          Ucz się ponownie
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onChangeScope}>
          Zmień zakres
        </Button>
      </div>

      <div className="mt-5 text-center">
        <Link
          href="/"
          className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          Wróć do słownika
        </Link>
      </div>
    </main>
  );
}
