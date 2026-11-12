import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Brak połączenia",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark />
        <span className="font-display text-2xl font-semibold">Margines</span>
      </div>

      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
        <WifiOff className="size-6" aria-hidden="true" />
      </div>

      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">
        Jesteś offline
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Ta strona nie zdążyła zostać zapisana w pamięci podręcznej. Twoje słówka
        są bezpieczne na urządzeniu — wróć do słownika, aby z nich korzystać.
      </p>

      <Button asChild className="mt-7">
        <Link href="/">Wróć do słownika</Link>
      </Button>
    </main>
  );
}
