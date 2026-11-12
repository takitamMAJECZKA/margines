import Link from "next/link";
import { ArrowRight, Layers, RotateCcw } from "lucide-react";

import type { WordSet } from "@/db/types";
import type { Dictionary } from "@/db/types";
import { pluralizePolish } from "@/lib/utils";

export function StudyBanner({
  count,
  wordSet,
  dictionary,
}: {
  count: number;
  wordSet?: WordSet | null;
  dictionary: Dictionary;
}) {
  if (count === 0) return null;

  const scope = {
    dictionary: dictionary.id,
    ...(wordSet ? { set: wordSet.id } : {}),
  };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <Link
        href={{ pathname: "/study", query: { ...scope, mode: "daily" } }}
        prefetch
        className="group flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/[0.1] p-3.5 outline-none transition-colors hover:bg-primary/[0.14] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <RotateCcw className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Codzienna powtórka</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Według wyniku znajomości i terminu
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Link
        href={{ pathname: "/study", query: scope }}
        prefetch
        className="group flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3.5 outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Layers className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {wordSet ? `Fiszki: ${wordSet.name}` : "Powtórz cały dział"}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {count} {pluralizePolish(count, "fiszka", "fiszki", "fiszek")}
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
