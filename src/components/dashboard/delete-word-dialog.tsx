"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Word } from "@/db/types";
import { deleteWord } from "@/db/words";

interface DeleteWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: Word | null;
}

export function DeleteWordDialog({
  open,
  onOpenChange,
  word,
}: DeleteWordDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!word || deleting) return;

    setDeleting(true);

    try {
      await deleteWord(word.id);
      toast.success(`Usunięto „${word.originalWord}”`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się usunąć słowa.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć to słowo?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="font-medium text-foreground">
              {word?.originalWord}
            </strong>
            {word?.translation ? ` — ${word.translation}` : null} zostanie trwale
            usunięte ze słownika. Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : null}
            Usuń słowo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
