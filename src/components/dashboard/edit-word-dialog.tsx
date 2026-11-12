"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { DuplicateWordError, ValidationError } from "@/db/errors";
import type { Word, WordSet } from "@/db/types";
import { updateWord } from "@/db/words";
import { fetchExamples, ApiClientError } from "@/lib/api-client";
import type { ForeignLanguageCode } from "@/lib/languages";
import { firstZodError, wordDraftSchema } from "@/lib/validation";
import type { AuthenticExample } from "@/types/api";

interface EditWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: Word | null;
  sets?: WordSet[];
  initialSetIds?: string[];
  sourceLanguage: ForeignLanguageCode | null;
}

export function EditWordDialog({
  open,
  onOpenChange,
  word,
  sets = [],
  initialSetIds = [],
  sourceLanguage,
}: EditWordDialogProps) {
  const [originalWord, setOriginalWord] = useState(word?.originalWord ?? "");
  const [translation, setTranslation] = useState(word?.translation ?? "");
  const [alternativeExample, setAlternativeExample] = useState<AuthenticExample | null>(null);
  const [searchedExampleIds, setSearchedExampleIds] = useState<string[]>([]);
  const [searchingExample, setSearchingExample] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);
  const [selectedSetIds, setSelectedSetIds] = useState(initialSetIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayedExample = alternativeExample?.text ?? word?.exampleSentence ?? "";

  async function searchAnotherExample() {
    if (!word || !sourceLanguage || searchingExample) return;

    const searchWord = originalWord.trim().replace(
      sourceLanguage === "de"
        ? /^(?:der|die|das|den|dem|des)\s+/i
        : sourceLanguage === "es"
          ? /^(?:el|la|los|las|un|una|unos|unas)\s+/i
          : sourceLanguage === "fr"
            ? /^(?:le|la|les|l['’]|un|une|des)\s*/i
            : /^(?:a|an|the)\s+/i,
      "",
    );
    if (!searchWord) return;

    const currentId = /\/show\/(\d+)/.exec(word.exampleSourceUrl)?.[1];
    const excluded = Array.from(
      new Set([
        ...(currentId ? [currentId] : []),
        ...searchedExampleIds,
        ...(alternativeExample ? [alternativeExample.id] : []),
      ]),
    );

    setSearchingExample(true);
    setExampleError(null);
    try {
      const result = await fetchExamples(searchWord, sourceLanguage, undefined, excluded);
      const next = result.examples.find(
        (example) =>
          example.text.toLocaleLowerCase() !== word.exampleSentence.toLocaleLowerCase() &&
          example.text.toLocaleLowerCase() !== displayedExample.toLocaleLowerCase(),
      );
      if (!next) {
        setExampleError(
          result.examplesError?.message ?? "Nie znaleziono innego przykładu w Tatoeba.",
        );
        return;
      }
      setAlternativeExample(next);
      setSearchedExampleIds((current) => [...current, next.id]);
    } catch (cause) {
      setExampleError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się pobrać zdania z Tatoeba.",
      );
    } finally {
      setSearchingExample(false);
    }
  }

  function toggleSet(setId: string) {
    setSelectedSetIds((current) =>
      current.includes(setId)
        ? current.filter((id) => id !== setId)
        : [...current, setId],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!word || saving) return;

    const draft = {
      originalWord,
      translation,
      exampleSentence: alternativeExample?.text ?? word.exampleSentence,
      exampleTranslation: alternativeExample?.translation ?? word.exampleTranslation,
      exampleType: alternativeExample ? "authentic" : word.exampleType,
      exampleSource: alternativeExample ? "Tatoeba" : word.exampleSource,
      exampleSourceUrl: alternativeExample?.sourceUrl ?? word.exampleSourceUrl,
      exampleAttribution: alternativeExample?.attribution ?? word.exampleAttribution,
    };

    const parsed = wordDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(firstZodError(parsed.error));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateWord(word.id, parsed.data, selectedSetIds);
      toast.success("Zmiany zostały zapisane");
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof DuplicateWordError || cause instanceof ValidationError) {
        setError(cause.message);
      } else {
        console.error(cause);
        setError("Nie udało się zapisać zmian.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj słowo</DialogTitle>
          <DialogDescription>
            Popraw słowo i tłumaczenie. Przykład możesz zmienić, wybierając inne zdanie z Tatoeba.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="edit-original">Słowo</Label>
            <Input
              id="edit-original"
              value={originalWord}
              onChange={(event) => {
                setOriginalWord(event.target.value);
                setError(null);
              }}
              maxLength={80}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-translation">Tłumaczenie</Label>
            <Textarea
              id="edit-translation"
              value={translation}
              onChange={(event) => {
                setTranslation(event.target.value);
                setError(null);
              }}
              rows={2}
              className="min-h-16"
            />
          </div>

          <div className="grid gap-3 rounded-xl border border-border/80 bg-card/40 p-3.5">
            <Label>Przykładowe zdanie</Label>
            {displayedExample ? (
              <blockquote className="border-l-2 border-border/90 pl-3">
                <p className="text-sm leading-relaxed text-foreground/85">
                  „{displayedExample}”
                </p>
                {(alternativeExample?.translation ?? word?.exampleTranslation) ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {alternativeExample?.translation ?? word?.exampleTranslation}
                  </p>
                ) : null}
                {alternativeExample ? (
                  <p className="mt-1 text-[10px] font-medium text-primary">Nowe zdanie z Tatoeba</p>
                ) : null}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">Brak przykładu.</p>
            )}
            {sourceLanguage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void searchAnotherExample()}
                disabled={searchingExample}
              >
                {searchingExample ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {word?.exampleSentence || alternativeExample
                  ? "Szukaj innego zdania z Tatoeba"
                  : "Szukaj zdania w Tatoeba"}
              </Button>
            ) : null}
            {exampleError ? (
              <p role="status" className="text-xs leading-relaxed text-muted-foreground">
                {exampleError}
              </p>
            ) : null}
          </div>

          <fieldset className="grid gap-2.5 rounded-xl border border-border/80 bg-card/40 p-3.5">
            <legend className="px-1 text-sm font-medium">Zestawy</legend>
            {sets.length > 0 ? (
              <>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Zaznacz zestawy, w których ma pojawić się to słowo.
                </p>
                <div className="grid gap-0.5">
                  {sets.map((set) => (
                    <label
                      key={set.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSetIds.includes(set.id)}
                        onChange={() => toggleSet(set.id)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {set.name}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Nie masz jeszcze zestawów. Utwórz je na stronie głównej, aby
                grupować słowa.
              </p>
            )}
          </fieldset>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Anuluj
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
