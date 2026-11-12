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
import { renameDictionary } from "@/db/dictionaries";
import { DuplicateDictionaryNameError, ValidationError } from "@/db/errors";
import type { Dictionary } from "@/db/types";
import { dictionaryTypeFormSchema } from "@/lib/validation";

interface RenameDictionaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary | null;
  onRenamed: (dictionary: Dictionary) => void;
}

export function RenameDictionaryDialog({
  open,
  onOpenChange,
  dictionary,
  onRenamed,
}: RenameDictionaryDialogProps) {
  const [name, setName] = useState(() => dictionary?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dictionary || submitting) return;

    const parsed = dictionaryTypeFormSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Wpisz poprawną nazwę.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await renameDictionary(dictionary.id, parsed.data.name);
      toast.success("Nazwa słownika została zmieniona");
      onRenamed(updated);
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof DuplicateDictionaryNameError || cause instanceof ValidationError) {
        setError(cause.message);
      } else {
        console.error(cause);
        setError("Nie udało się zmienić nazwy.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zmień nazwę</DialogTitle>
          <DialogDescription>
            Nowa nazwa pojawi się na pasku słowników.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="rename-dictionary">Nazwa słownika</Label>
            <Input
              id="rename-dictionary"
              value={name}
              maxLength={40}
              autoFocus
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
            />
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
              Zapisz nazwę
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
