"use client";

import { useState } from "react";
import { Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientValue } from "@/hooks/use-client-value";

export function InstallHint() {
  const [open, setOpen] = useState(false);
  const isIos = useClientValue(
    () =>
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    false,
  );
  const isStandalone = useClientValue(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    false,
  );

  if (!isIos || isStandalone) return null;

  return (
    <>
      <Button
        type="button"
        variant="link"
        onClick={() => setOpen(true)}
        className="h-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
      >
        Jak zainstalować na iPhone?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Margines na ekranie początkowym</DialogTitle>
            <DialogDescription>
              Aplikacja działa jak zwykła aplikacja i po pierwszym otwarciu
              udostępnia zapisane słówka także offline.
            </DialogDescription>
          </DialogHeader>

          <ol className="grid gap-4">
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                1
              </span>
              <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                Otwórz Margines w przeglądarce <strong className="text-foreground">Safari</strong>.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                2
              </span>
              <p className="flex flex-wrap items-center gap-1.5 pt-1 text-sm leading-relaxed text-muted-foreground">
                Dotknij przycisku
                <Share className="inline size-4 text-foreground" aria-label="Udostępnij" />
                <strong className="text-foreground">Udostępnij</strong> na dole ekranu.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                3
              </span>
              <p className="flex flex-wrap items-center gap-1.5 pt-1 text-sm leading-relaxed text-muted-foreground">
                Wybierz
                <SquarePlus className="inline size-4 text-foreground" aria-hidden="true" />
                <strong className="text-foreground">Dodaj do ekranu początkowego</strong>
                i potwierdź.
              </p>
            </li>
          </ol>

          <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            Instalacja wymaga połączenia z internetem. Twoje słówka pozostają w
            pamięci przeglądarki na tym urządzeniu.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
