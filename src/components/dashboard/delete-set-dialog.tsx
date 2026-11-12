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
import type { WordSet } from "@/db/types";
import { deleteSet } from "@/db/sets";
import { pluralizePolish } from "@/lib/utils";

interface DeleteSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordSet: WordSet | null;
  wordCount: number;
  onDeleted: (id: string) => void;
}

export function DeleteSetDialog({
  open,
  onOpenChange,
  wordSet,
  wordCount,
  onDeleted,
}: DeleteSetDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!wordSet || deleting) return;

    setDeleting(true);

    try {
      await deleteSet(wordSet.id);
      toast.success(`Usunięto zestaw „${wordSet.name}”`);
      onDeleted(wordSet.id);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się usunąć zestawu.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć ten zestaw?</AlertDialogTitle>
          <AlertDialogDescription>
            Zestaw{" "}
            <strong className="font-medium text-foreground">{wordSet?.name}</strong>{" "}
            {wordCount > 0 ? (
              <>
                zawiera {wordCount}{" "}
                {pluralizePolish(wordCount, "słowo", "słowa", "słów")}.{" "}
              </>
            ) : null}
            Usunięcie zestawu nie usuwa słów ze słownika — zniknie tylko to
            pogrupowanie.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : null}
            Usuń zestaw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
