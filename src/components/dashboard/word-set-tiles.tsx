"use client";

import {
  FolderOpen,
  Layers,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WordSet } from "@/db/types";
import { cn, pluralizePolish } from "@/lib/utils";

interface WordSetTilesProps {
  sets: WordSet[];
  counts: Record<string, number>;
  totalCount: number;
  activeSetId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onAssign: (set: WordSet) => void;
  onRename: (set: WordSet) => void;
  onDelete: (set: WordSet) => void;
}

function countLabel(count: number): string {
  return `${count} ${pluralizePolish(count, "słowo", "słowa", "słów")}`;
}

export function WordSetTiles({
  sets,
  counts,
  totalCount,
  activeSetId,
  onSelect,
  onCreate,
  onAssign,
  onRename,
  onDelete,
}: WordSetTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={activeSetId === null}
        className={cn(
          "group flex flex-col justify-between rounded-2xl border p-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
          activeSetId === null
            ? "border-primary/35 bg-primary/[0.055]"
            : "border-border bg-card hover:border-primary/25 hover:bg-card/80",
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Layers className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="mt-5 block">
          <span className="block truncate text-sm font-semibold">Wszystkie</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {countLabel(totalCount)}
          </span>
        </span>
      </button>

      {sets.map((set) => (
        <div key={set.id} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(set.id)}
            aria-pressed={activeSetId === set.id}
            className={cn(
              "flex h-full w-full flex-col justify-between rounded-2xl border p-3.5 pr-11 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
              activeSetId === set.id
                ? "border-primary/35 bg-primary/[0.055]"
                : "border-border bg-card hover:border-primary/25 hover:bg-card/80",
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground/75">
              <FolderOpen className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="mt-5 block">
              <span className="block truncate text-sm font-semibold">{set.name}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {countLabel(counts[set.id] ?? 0)}
              </span>
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Zarządzaj zestawem ${set.name}`}
                className="absolute top-1.5 right-1.5 size-9 rounded-full text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onSelect(set.id)}>
                <FolderOpen />
                Otwórz zestaw
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAssign(set)}>
                <ListPlus />
                Przypisz słowa
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRename(set)}>
                <Pencil />
                Zmień nazwę
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(set)}>
                <Trash2 />
                Usuń zestaw
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      <button
        type="button"
        onClick={onCreate}
        className="flex min-h-[7.25rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 p-3.5 text-center text-muted-foreground outline-none transition-colors hover:border-primary/30 hover:bg-card/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="flex size-9 items-center justify-center rounded-xl border border-dashed border-border">
          <Plus className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium">Nowy zestaw</span>
      </button>
    </div>
  );
}
