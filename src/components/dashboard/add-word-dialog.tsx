"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCachedLookup, lookupKey, saveLookup } from "@/db/lookups";
import type { Dictionary } from "@/db/types";
import { attachExampleIfEmpty, findWordByText } from "@/db/words";
import { ApiClientError, fetchArticle, fetchDefinition, fetchEnrichment, fetchExamples } from "@/lib/api-client";
import type { ForeignLanguageCode } from "@/lib/languages";
import { normalizeWord } from "@/lib/utils";
import { wordTextSchema } from "@/lib/validation";
import type { EnrichResponse } from "@/types/api";

import { WordPreviewForm } from "./word-preview-form";

function manualEnrichment(word: string): EnrichResponse {
  return {
    word,
    translation: { text: null, provider: null, error: null },
    examples: [],
    examplesError: null,
    aiAvailable: false,
    fetchedAt: Date.now(),
  };
}

function failedEnrichment(word: string, message: string): EnrichResponse {
  return {
    word,
    translation: {
      text: null,
      provider: null,
      error: { code: "UNAVAILABLE", message },
    },
    examples: [],
    examplesError: null,
    aiAvailable: false,
    fetchedAt: Date.now(),
  };
}

interface AddWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary;
  /** Prefills the word field, e.g. from a search with no results. */
  initialWord?: string;
  /** Sets the new word is automatically added to. */
  setIds?: string[];
  onAdded?: () => void;
}

export function AddWordDialog({
  open,
  onOpenChange,
  dictionary,
  initialWord = "",
  setIds = [],
  onAdded,
}: AddWordDialogProps) {
  const [phase, setPhase] = useState<"input" | "preview">("input");
  const [word, setWord] = useState(initialWord);
  const [inputError, setInputError] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichResponse | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [nativeLookupPending, setNativeLookupPending] = useState(false);

  const enrichmentRef = useRef<EnrichResponse | null>(null);
  const examplesAbortRef = useRef<AbortController | null>(null);
  const examplesRequestRef = useRef(0);
  const savedWordIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);

  const sourceLanguage: ForeignLanguageCode | null = dictionary.isNative
    ? null
    : (dictionary.sourceLanguage as ForeignLanguageCode);

  function setCurrentEnrichment(next: EnrichResponse | null) {
    enrichmentRef.current = next;
    setEnrichment(next);
  }

  function cancelExamples() {
    examplesRequestRef.current += 1;
    examplesAbortRef.current?.abort();
    examplesAbortRef.current = null;
    setExamplesLoading(false);
  }

  async function loadExamples(text: string, key: string) {
    if (!sourceLanguage) return;

    cancelExamples();
    const requestId = examplesRequestRef.current;
    const controller = new AbortController();
    examplesAbortRef.current = controller;
    setExamplesLoading(true);

    try {
      const result = await fetchExamples(text, sourceLanguage, controller.signal);
      if (examplesRequestRef.current !== requestId) return;

      const current = enrichmentRef.current;
      if (!current || (current.baseWord ?? current.word) !== text) return;

      const merged: EnrichResponse = {
        ...current,
        examples: result.examples,
        examplesError: result.examplesError,
      };
      setCurrentEnrichment(merged);

      const savedWordId = savedWordIdRef.current;
      const firstExample = result.examples[0];
      if (savedWordId && firstExample) {
        await attachExampleIfEmpty(savedWordId, firstExample);
      }

      if (merged.examples.length > 0) {
        try {
          await saveLookup(key, dictionary.id, merged);
        } catch (error) {
          console.error(error);
        }
      }
    } catch (error) {
      if (examplesRequestRef.current !== requestId || controller.signal.aborted) {
        return;
      }

      const current = enrichmentRef.current;
      if (!current || (current.baseWord ?? current.word) !== text) return;

      setCurrentEnrichment({
        ...current,
        examples: [],
        examplesError: {
          code:
            error instanceof ApiClientError && error.code === "TIMEOUT"
              ? "TIMEOUT"
              : "UNAVAILABLE",
          message:
            error instanceof ApiClientError
              ? error.message
              : "Nie udało się pobrać przykładów. Spróbuj ponownie.",
        },
      });
    } finally {
      if (examplesRequestRef.current === requestId) {
        examplesAbortRef.current = null;
        setExamplesLoading(false);
      }
    }
  }

  const lookupMutation = useMutation({
    mutationFn: async ({ text, force }: { text: string; force: boolean }) => {
      if (!sourceLanguage) {
        throw new ApiClientError("Ten słownik nie obsługuje automatycznego wyszukiwania.");
      }

      const key = lookupKey(
        dictionary.sourceLanguage,
        dictionary.targetLanguage,
        normalizeWord(text),
      );

      if (!force) {
        const cached = await getCachedLookup(key);
        if (cached) return { response: cached, key };
      }

      const [translated, article] = await Promise.all([
        fetchEnrichment(text, sourceLanguage),
        fetchArticle(text, sourceLanguage).catch(() => null),
      ]);
      const response = article?.applied
        ? { ...translated, word: article.word, baseWord: text, articleApplied: true }
        : translated;
      return { response, key };
    },
  });

  async function runLookup(force: boolean) {
    const parsedWord = wordTextSchema.safeParse(word);
    if (!parsedWord.success) {
      setInputError(parsedWord.error.issues[0]?.message ?? "Wpisz poprawne słowo.");
      return;
    }

    const text = parsedWord.data;
    setInputError(null);

    try {
      const duplicate = await findWordByText(dictionary.id, text);
      if (duplicate) {
        setInputError(
          `Słowo „${duplicate.originalWord}” już istnieje w tym słowniku.`,
        );
        return;
      }
    } catch (error) {
      console.error(error);
      setInputError("Nie udało się sprawdzić duplikatów. Spróbuj ponownie.");
      return;
    }

    cancelExamples();

    if (!sourceLanguage) {
      setNativeLookupPending(true);
      try {
        const result = await fetchDefinition(text);
        setCurrentEnrichment({
          ...manualEnrichment(text),
          translation: {
            text: result.definitions.map((entry, index) => `${index + 1}. ${entry.text}`).join("\n"),
            provider: "wiktionary",
            error: result.error,
          },
          definitions: result.definitions,
        });
      } catch (error) {
        setCurrentEnrichment(failedEnrichment(text, error instanceof ApiClientError ? error.message : "Nie udało się pobrać definicji."));
      } finally {
        setNativeLookupPending(false);
      }
      setPhase("preview");
      return;
    }

    try {
      const { response, key } = await lookupMutation.mutateAsync({ text, force });
      setCurrentEnrichment(response);
      setPhase("preview");

      if (response.examples.length === 0) {
        void loadExamples(text, key);
      }
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Nie udało się pobrać danych. Wpisz tłumaczenie ręcznie.";
      setCurrentEnrichment(failedEnrichment(text, message));
      setPhase("preview");

      const key = lookupKey(
        dictionary.sourceLanguage,
        dictionary.targetLanguage,
        normalizeWord(text),
      );
      void loadExamples(text, key);
    }
  }

  function retryExamples() {
    const current = enrichmentRef.current;
    if (!current || !sourceLanguage) return;

    const key = lookupKey(
      dictionary.sourceLanguage,
      dictionary.targetLanguage,
      normalizeWord(current.word),
    );
    void loadExamples(current.word, key);
  }

  useEffect(() => {
    if (!open || !initialWord.trim() || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void runLookup(false);
    // This dialog is keyed by dictionary and initialWord; the first render
    // already contains the exact lookup value that should be submitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWord, open]);

  const lookupPending = lookupMutation.isPending || nativeLookupPending;

  function handleInputSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lookupPending) return;
    void runLookup(false);
  }

  function handleClose() {
    if (!savedWordIdRef.current) cancelExamples();
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (!savedWordIdRef.current) cancelExamples();
      if (phase === "preview") {
        setPhase("input");
        if (!savedWordIdRef.current) setCurrentEnrichment(null);
      }
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {phase === "input" || !enrichment ? (
          <>
            <DialogHeader>
              <DialogTitle>Dodaj słowo</DialogTitle>
              <DialogDescription>
                {sourceLanguage
                  ? "Wpisz słowo z książki. Pobierzemy tłumaczenie i przykładowe zdanie, a Ty zdecydujesz, co zapisać."
                  : "Wpisz słowo i tłumaczenie. W słowniku ojczystym wszystko dodajesz ręcznie."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInputSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="new-word">Słowo</Label>
                <Input
                  id="new-word"
                  value={word}
                  onChange={(event) => {
                    setWord(event.target.value);
                    setInputError(null);
                  }}
                  placeholder={
                    sourceLanguage === "es"
                      ? "np. asombroso"
                      : sourceLanguage === "en"
                        ? "np. wholesome"
                        : "np. słowo"
                  }
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="search"
                  maxLength={80}
                  disabled={lookupPending}
                  aria-invalid={Boolean(inputError)}
                  className="h-14 text-lg"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {sourceLanguage
                    ? "Sprawdzimy tłumaczenie oraz przykładowe zdanie. Przed zapisem możesz poprawić tłumaczenie."
                    : "Możesz dodać słowo z tłumaczeniem."}
                </p>
              </div>

              {inputError ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {inputError}
                </p>
              ) : null}

              {lookupPending ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Szukam tłumaczenia…
                </div>
              ) : null}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={lookupPending}>
                    Anuluj
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={lookupPending}>
                  {lookupPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Search />
                  )}
                  Sprawdź słowo
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <WordPreviewForm
            key={enrichment.fetchedAt}
            dictionary={dictionary}
            enrichment={enrichment}
            setIds={setIds}
            retrying={lookupMutation.isPending}
            examplesLoading={examplesLoading}
            onRetry={() => {
              void runLookup(true);
            }}
            onRetryExamples={retryExamples}
            onBack={() => {
              cancelExamples();
              setPhase("input");
              setCurrentEnrichment(null);
            }}
            onClose={handleClose}
            onSaved={(savedWord) => {
              savedWordIdRef.current = savedWord.id;
              const firstExample = enrichmentRef.current?.examples[0];
              if (firstExample && !savedWord.exampleSentence) {
                void attachExampleIfEmpty(savedWord.id, firstExample);
              }
              onAdded?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
