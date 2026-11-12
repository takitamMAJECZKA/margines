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
import { deleteDictionary } from "@/db/dictionaries";
import type { Dictionary } from "@/db/types";
import { pluralizePolish } from "@/lib/utils";

interface DeleteDictionaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionary: Dictionary | null;
  wordCount: number;
  onDeleted: (id: string) => void;
}

export function DeleteDictionaryDialog({
  open,
  onOpenChange,
  dictionary,
  wordCount,
  onDeleted,
}: DeleteDictionaryDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!dictionary || deleting) return;

    setDeleting(true);

    try {
      await deleteDictionary(dictionary.id);
      toast.success(`Usunięto słownik „${dictionary.name}”`);
      onDeleted(dictionary.id);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się usunąć słownika.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć ten słownik?</AlertDialogTitle>
          <AlertDialogDescription>
            Słownik <strong className="font-medium text-foreground">{dictionary?.name}</strong>{" "}
            {wordCount > 0 ? (
              <>
                zawiera {wordCount}{" "}
                {pluralizePolish(wordCount, "słowo", "słowa", "słów")}. Wszystkie
                zostaną trwale usunięte.
              </>
            ) : (
              "zostanie trwale usunięty."
            )}{" "}
            Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : null}
            Usuń słownik
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
