import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

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

  return (
    <Link
      href={{ pathname: "/study", query: { dictionary: dictionary.id, ...(wordSet ? { set: wordSet.id } : {}) } }}
      prefetch
      className="group mt-3 flex items-center gap-3.5 rounded-2xl border border-primary/15 bg-primary/[0.055] p-3.5 outline-none transition-colors hover:bg-primary/[0.085] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Layers className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {wordSet ? `Nauka: ${wordSet.name}` : "Tryb nauki"}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {count} {pluralizePolish(count, "fiszka", "fiszki", "fiszek")} · powtarzaj
          trudne słowa aż je zapamiętasz
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="mr-1 size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
