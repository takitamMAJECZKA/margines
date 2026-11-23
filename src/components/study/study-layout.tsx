import Link from "next/link";
import { ArrowLeft, BookOpen, Settings2 } from "lucide-react";

import { OfflineBadge } from "@/components/offline-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function StudyHeader() {
  return (
    <header className="border-b border-border/60 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft />
            Słownik
          </Link>
        </Button>
        <div className="flex items-center gap-1.5">
          <OfflineBadge />
          <Button asChild variant="ghost" size="icon" aria-label="Ustawienia" title="Ustawienia" className="text-muted-foreground hover:text-foreground">
            <Link href="/settings"><Settings2 aria-hidden="true" /></Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function StudyEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card">
        <BookOpen className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button asChild className="mt-7">
        <Link href="/">Wróć do słownika</Link>
      </Button>
    </main>
  );
}

export function StudyScreenFallback() {
  return (
    <div className="flex min-h-dvh flex-col">
      <StudyHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4">
        <Skeleton className="h-[26rem] w-full rounded-3xl" />
      </main>
    </div>
  );
}
