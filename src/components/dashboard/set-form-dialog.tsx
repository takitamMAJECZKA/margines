"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { Dictionary, WordSet } from "@/db/types";
import { DuplicateSetNameError, ValidationError } from "@/db/errors";
import { createSet, renameSet } from "@/db/sets";
import { setFormSchema } from "@/lib/validation";

interface SetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary;
  /** Null creates a new set; a set renames the existing one. */
  wordSet: WordSet | null;
  onSaved: (set: WordSet) => void;
}

export function SetFormDialog({
  open,
  onOpenChange,
  dictionary,
  wordSet,
  onSaved,
}: SetFormDialogProps) {
  const [name, setName] = useState(() => wordSet?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(wordSet);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = setFormSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Wpisz poprawną nazwę.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const saved = wordSet
        ? await renameSet(wordSet.id, parsed.data.name)
        : await createSet(dictionary.id, parsed.data);

      toast.success(
        editing
          ? "Nazwa zestawu została zmieniona"
          : `Utworzono zestaw „${saved.name}”`,
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof DuplicateSetNameError || cause instanceof ValidationError) {
        setError(cause.message);
      } else {
        console.error(cause);
        setError(
          editing ? "Nie udało się zmienić nazwy." : "Nie udało się utworzyć zestawu.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Zmień nazwę zestawu" : "Nowy zestaw"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Nowa nazwa pojawi się na kafelku zestawu."
              : `Pogrupuj słowa ze słownika „${dictionary.name}” w zestaw, np. według rozdziału lub tematu.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="set-name">Nazwa zestawu</Label>
            <Input
              id="set-name"
              value={name}
              maxLength={40}
              autoFocus
              autoComplete="off"
              placeholder="np. Rozdział 1"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nazwa „Wszystkie” jest zarezerwowana dla widoku całego słownika.
            </p>
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
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Anuluj
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Zapisz nazwę" : "Utwórz zestaw"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
