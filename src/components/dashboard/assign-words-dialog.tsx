"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Loader2, ListPlus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Dictionary, Word, WordSet } from "@/db/types";
import { assignWordsToSet } from "@/db/sets";
import { foldForSearch } from "@/lib/utils";

interface AssignWordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary;
  wordSet: WordSet;
  words: Word[];
  assignedWordIds: string[];
}

export function AssignWordsDialog({
  open,
  onOpenChange,
  dictionary,
  wordSet,
  words,
  assignedWordIds,
}: AssignWordsDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(assignedWordIds),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredWords = useMemo(() => {
    const normalized = foldForSearch(query.trim());
    if (!normalized) return words;

    return words.filter((word) =>
      [word.originalWord, word.translation, word.exampleSentence].some((value) =>
        foldForSearch(value).includes(normalized),
      ),
    );
  }, [query, words]);

  const everyVisibleSelected =
    filteredWords.length > 0 &&
    filteredWords.every((word) => selectedIds.has(word.id));

  function toggleWord(wordId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  function toggleVisibleWords() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const word of filteredWords) {
        if (everyVisibleSelected) next.delete(word.id);
        else next.add(word.id);
      }
      return next;
    });
  }

  async function saveAssignments() {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      await assignWordsToSet(wordSet.id, dictionary.id, [...selectedIds]);
      toast.success(`Zapisano słowa w zestawie „${wordSet.name}”`);
      onOpenChange(false);
    } catch (cause) {
      console.error(cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "Nie udało się przypisać słów do zestawu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle>Przypisz słowa</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={
                everyVisibleSelected
                  ? "Odznacz wszystkie widoczne słowa"
                  : "Zaznacz wszystkie widoczne słowa"
              }
              title={
                everyVisibleSelected
                  ? "Odznacz wszystkie widoczne słowa"
                  : "Zaznacz wszystkie widoczne słowa"
              }
              onClick={toggleVisibleWords}
              disabled={filteredWords.length === 0}
            >
              <CheckCheck aria-hidden="true" />
            </Button>
          </div>
          <DialogDescription>
            Wybierz słowa ze słownika „{dictionary.name}”, które mają należeć do
            zestawu „{wordSet.name}”.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj w całym słowniku…"
            aria-label="Szukaj słowa w całym słowniku"
            className="pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
          Zaznaczono {selectedIds.size} z {words.length} słów
          {query.trim() ? ` · widoczne ${filteredWords.length}` : ""}
        </p>

        <div className="max-h-[42dvh] overflow-y-auto overscroll-contain rounded-xl border border-border/80">
          {filteredWords.length > 0 ? (
            <ul aria-label="Słowa z całego słownika" className="divide-y divide-border/60">
              {filteredWords.map((word) => (
                <li key={word.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(word.id)}
                      onChange={() => toggleWord(word.id)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {word.originalWord}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {word.translation || "Brak tłumaczenia"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {words.length === 0
                ? "W tym słowniku nie ma jeszcze słów."
                : "Nie znaleziono słów pasujących do wyszukiwania."}
            </p>
          )}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Anuluj
          </Button>
          <Button type="button" onClick={saveAssignments} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <ListPlus />}
            Zapisz przypisanie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
