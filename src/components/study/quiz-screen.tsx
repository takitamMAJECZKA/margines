"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ListChecks,
  RotateCcw,
  X,
} from "lucide-react";

import { StudyScopeSelector } from "@/components/study/scope-selector";
import { StudyHeader } from "@/components/study/study-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary, Word, WordSet } from "@/db/types";
import { recordReview } from "@/db/words";
import { LANGUAGES, languagePairLabel } from "@/lib/languages";
import {
  buildQuizQuestions,
  quizCandidateWords,
  type QuizQuestion,
} from "@/lib/quiz";
import { isRecentSetId } from "@/lib/study-scope";
import { cn, normalizeWord, pluralizePolish } from "@/lib/utils";

interface QuizResult {
  word: Word;
  correct: boolean;
  selected: string;
  answer: string;
}

interface QuizSession {
  questions: QuizQuestion[];
  index: number;
  selected: string | null;
  answered: boolean;
  results: QuizResult[];
  finished: boolean;
}

interface QuizScreenProps {
  dictionary: Dictionary;
  wordSet: WordSet | null;
  words: Word[];
  dictionaryWords: Word[];
  sets: WordSet[];
  onChangeScope: (id: string) => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function QuizScreen({
  dictionary,
  wordSet,
  words,
  dictionaryWords,
  sets,
  onChangeScope,
}: QuizScreenProps) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const lockRef = useRef(false);

  const candidates = useMemo(
    () => quizCandidateWords(words, dictionary.sourceLanguage),
    [words, dictionary.sourceLanguage],
  );
  const uniqueDictionaryWords = useMemo(
    () =>
      new Set(dictionaryWords.map((word) => normalizeWord(word.originalWord)))
        .size,
    [dictionaryWords],
  );
  const canStart = candidates.length > 0 && uniqueDictionaryWords >= 4;
  const contextName = wordSet?.name ?? dictionary.name;

  function start() {
    const questions = buildQuizQuestions(
      words,
      dictionaryWords,
      dictionary.sourceLanguage,
    );
    if (questions.length === 0) return;

    lockRef.current = false;
    setSession({
      questions,
      index: 0,
      selected: null,
      answered: false,
      results: [],
      finished: false,
    });
  }

  function answer(option: string) {
    if (!session || session.answered || lockRef.current) return;
    const question = session.questions[session.index];
    if (!question) return;

    lockRef.current = true;
    const correct = option === question.answer;
    void recordReview(question.word.id, correct, false).catch((error: unknown) => {
      console.error("Nie udało się zapisać odpowiedzi ABCD", error);
    });

    setSession({
      ...session,
      selected: option,
      answered: true,
      results: [
        ...session.results,
        {
          word: question.word,
          correct,
          selected: option,
          answer: question.answer,
        },
      ],
    });
  }

  function next() {
    if (!session || !session.answered) return;
    lockRef.current = false;

    if (session.index + 1 >= session.questions.length) {
      setSession({ ...session, finished: true });
      return;
    }

    setSession({
      ...session,
      index: session.index + 1,
      selected: null,
      answered: false,
    });
  }

  function changeScope(id: string) {
    setSession(null);
    lockRef.current = false;
    onChangeScope(id);
  }

  useEffect(() => {
    if (!session || session.finished) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select") ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!session?.answered) {
        const key = event.key.toLowerCase();
        const index =
          key >= "1" && key <= "4"
            ? Number(key) - 1
            : ["a", "b", "c", "d"].indexOf(key);
        const option = session?.questions[session.index]?.options[index];
        if (option) {
          event.preventDefault();
          answer(option);
        }
        return;
      }

      if (event.key === "Enter" || event.code === "Space") {
        event.preventDefault();
        next();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // answer/next use the current session; the listener re-binds on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col">
        <StudyHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            ABCD
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
            Uzupełnij zdanie
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Wybierz brakujące słowo w zdaniu z Tatoeba. Ten tryb nie zmienia
            gwiazdek znajomości — służy do szybkiej powtórki ze zdań.
          </p>

          <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card">
            <StudyScopeSelector
              sets={sets}
              value={wordSet?.id ?? ""}
              onChange={changeScope}
            />

            <div className="mt-5 flex items-center gap-3.5 border-t border-dashed border-border pt-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ListChecks className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl font-medium">
                  {contextName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {candidates.length}{" "}
                  {pluralizePolish(
                    candidates.length,
                    "pytanie",
                    "pytania",
                    "pytań",
                  )}{" "}
                  z zapisanych zdań
                  {wordSet && isRecentSetId(wordSet.id)
                    ? " · grupa automatyczna"
                    : ""}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                A–D
              </Badge>
            </div>
          </div>

          {canStart ? (
            <Button
              type="button"
              size="lg"
              onClick={start}
              className="mt-4 h-13 w-full text-[0.95rem]"
            >
              <ListChecks />
              Rozpocznij ABCD
            </Button>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-600/20 bg-amber-500/[0.07] p-4 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">
                Brak gotowych pytań ABCD
              </p>
              <p className="mt-1">
                {candidates.length === 0
                  ? "W tym zakresie nie ma słów z zapisanym zdaniem z Tatoeba. Otwórz edycję słowa i pobierz przykładowe zdanie."
                  : "Do czterech odpowiedzi potrzebujesz co najmniej 4 różnych słów w tym słowniku."}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link href="/" className="underline decoration-border underline-offset-4 hover:text-foreground">
              Wróć do słownika
            </Link>
            <span className="h-3 w-px bg-border" />
            <Link
              href={{
                pathname: "/study",
                query: {
                  dictionary: dictionary.id,
                  ...(wordSet ? { set: wordSet.id } : {}),
                },
              }}
              className="underline decoration-border underline-offset-4 hover:text-foreground"
            >
              Przejdź do fiszek
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (session.finished) {
    return (
      <QuizSummary
        session={session}
        contextName={contextName}
        onRestart={start}
        onChangeScope={() => setSession(null)}
        dictionaryId={dictionary.id}
      />
    );
  }

  const question = session.questions[session.index];
  if (!question) return null;

  const total = session.questions.length;
  const correctCount = session.results.filter((result) => result.correct).length;
  const progress = Math.round((session.results.length / total) * 100);
  const isLast = session.index + 1 >= total;
  const answeredCorrectly = session.selected === question.answer;

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-9">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium text-foreground">
            {contextName}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {session.index + 1} / {total} · {correctCount} poprawnych
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Postęp quizu ABCD"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={session.results.length}
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-7 rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 sm:px-6">
            <Badge variant="outline" className="tracking-[0.12em]">
              {LANGUAGES[dictionary.sourceLanguage].short} →{" "}
              {LANGUAGES[dictionary.targetLanguage].short}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {languagePairLabel(
                dictionary.sourceLanguage,
                dictionary.targetLanguage,
                dictionary.isNative,
              )}
            </span>
          </div>

          <div className="px-5 py-7 text-center sm:px-7 sm:py-9">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Uzupełnij zdanie
            </p>
            <p className="mx-auto mt-3 max-w-full text-balance font-display text-[clamp(1.25rem,4.8vw,1.9rem)] leading-[1.35] font-medium tracking-[-0.025em] whitespace-pre-line break-words">
              „{question.sentence}”
            </p>
            {question.translation ? (
              <p className="mx-auto mt-4 max-w-md border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
                {question.translation}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2.5 border-t border-border/60 p-4 sm:grid-cols-2 sm:p-5">
            {question.options.map((option, index) => {
              const isCorrect = option === question.answer;
              const isSelected = session.selected === option;
              const state = !session.answered
                ? "idle"
                : isCorrect
                  ? "correct"
                  : isSelected
                    ? "wrong"
                    : "muted";

              return (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  onClick={() => answer(option)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    state === "idle" &&
                      "border-border bg-background hover:border-primary/35 hover:bg-secondary/50",
                    state === "correct" &&
                      "border-emerald-600/35 bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-300",
                    state === "wrong" &&
                      "border-destructive/40 bg-destructive/[0.07] text-destructive",
                    state === "muted" &&
                      "border-border/60 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold",
                      state === "correct" &&
                        "border-emerald-600/30 bg-emerald-600/10",
                      state === "wrong" &&
                        "border-destructive/30 bg-destructive/10",
                      state === "idle" && "border-border bg-secondary/60",
                      state === "muted" && "border-border/60",
                    )}
                  >
                    {OPTION_LETTERS[index]}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{option}</span>
                  {session.answered && isCorrect ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                  {session.answered && isSelected && !isCorrect ? (
                    <X className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border/60 p-4 sm:p-5">
            {session.answered ? (
              <div className="grid gap-3">
                <p
                  role="status"
                  className={cn(
                    "text-sm font-medium",
                    answeredCorrectly
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-destructive",
                  )}
                >
                  {answeredCorrectly
                    ? "Dobrze!"
                    : `Poprawna odpowiedź: ${question.answer}`}
                </p>
                <Button type="button" size="lg" onClick={next} className="w-full">
                  {isLast ? "Zakończ" : "Następne pytanie"}
                  <ArrowRight />
                </Button>
              </div>
            ) : (
              <p className="text-center text-[11px] text-muted-foreground">
                Wybierz jedną z czterech odpowiedzi. Klawisze 1–4 lub A–D też
                działają.
              </p>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          ABCD nie dodaje ani nie odejmuje gwiazdek znajomości słowa.
        </p>
      </main>
    </div>
  );
}

function QuizSummary({
  session,
  contextName,
  onRestart,
  onChangeScope,
  dictionaryId,
}: {
  session: QuizSession;
  contextName: string;
  onRestart: () => void;
  onChangeScope: () => void;
  dictionaryId: string;
}) {
  const total = session.questions.length;
  const correct = session.results.filter((result) => result.correct).length;
  const wrong = session.results.filter((result) => !result.correct);
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <StudyHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="size-7" aria-hidden="true" />
          </div>
          <p className="mt-6 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {contextName}
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">
            ABCD ukończone
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Wybrano {correct} z {total} poprawnych odpowiedzi. Gwiazdki
            znajomości pozostały bez zmian.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card py-4 shadow-card">
          <div className="px-3 text-center">
            <p className="font-display text-2xl font-medium">{total}</p>
            <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
              {pluralizePolish(total, "pytanie", "pytania", "pytań")}
            </p>
          </div>
          <div className="px-3 text-center">
            <p className="font-display text-2xl font-medium">{correct}</p>
            <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
              poprawne
            </p>
          </div>
          <div className="px-3 text-center">
            <p className="font-display text-2xl font-medium">{percent}%</p>
            <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
              wynik
            </p>
          </div>
        </div>

        {wrong.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
            <h2 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Do powtórki
            </h2>
            <ul className="mt-3 divide-y divide-border/70">
              {wrong.map((result) => (
                <li
                  key={result.word.id}
                  className="flex items-start justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{result.word.originalWord}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {result.word.translation}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    wybrano: {result.selected}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-emerald-600/15 bg-emerald-600/[0.055] px-4 py-3.5 text-center text-sm text-emerald-800 dark:text-emerald-300">
            Wszystkie odpowiedzi poprawne. Świetnie!
          </p>
        )}

        <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
          <Button type="button" size="lg" onClick={onRestart}>
            <RotateCcw />
            Zagraj ponownie
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={onChangeScope}
          >
            Zmień zakres
          </Button>
        </div>

        <div className="mt-5 text-center">
          <Link
            href={{ pathname: "/study", query: { dictionary: dictionaryId } }}
            className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Wróć do fiszek
          </Link>
        </div>
      </main>
    </div>
  );
}
