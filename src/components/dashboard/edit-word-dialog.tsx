"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
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
import { firstZodError, wordDraftSchema } from "@/lib/validation";

interface EditWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: Word | null;
  sets?: WordSet[];
  initialSetIds?: string[];
}

export function EditWordDialog({
  open,
  onOpenChange,
  word,
  sets = [],
  initialSetIds = [],
}: EditWordDialogProps) {
  const [originalWord, setOriginalWord] = useState(word?.originalWord ?? "");
  const [translation, setTranslation] = useState(word?.translation ?? "");
  const [selectedSetIds, setSelectedSetIds] = useState(initialSetIds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      exampleSentence: word.exampleSentence,
      exampleTranslation: word.exampleTranslation,
      exampleType: word.exampleType,
      exampleSource: word.exampleSource,
      exampleSourceUrl: word.exampleSourceUrl,
      exampleAttribution: word.exampleAttribution,
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
            Popraw słowo i tłumaczenie. Przykład zdania jest tylko do odczytu.
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
            <Label>Przykład zdania</Label>
            {word?.exampleSentence ? (
              <blockquote className="border-l-2 border-border/90 pl-3">
                <p className="text-sm leading-relaxed text-foreground/85">
                  „{word.exampleSentence}”
                </p>
                {word.exampleTranslation ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {word.exampleTranslation}
                  </p>
                ) : null}
              </blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">Brak przykładu.</p>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Przykładu zdania nie można edytować.
            </p>
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
