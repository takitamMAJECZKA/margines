import Link from "next/link";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

// Konta są tymczasowo wyłączone. Strona zastępuje formularz logowania i
// rejestracji, dopóki dane są przechowywane wyłącznie w przeglądarce.
export function AccountsDisabled() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <Brand />
      <div>
        <h1 className="font-display text-2xl font-medium">
          Konta są tymczasowo wyłączone
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Margines zapisuje słowniki, słowa i postęp lokalnie w tej przeglądarce.
          Nie musisz się logować.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Wróć do słownika</Link>
      </Button>
    </main>
  );
}
