"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/db/types";
import { DICTIONARY_COLOR_HEX, LANGUAGE_CODES } from "@/lib/languages";
import { cn } from "@/lib/utils";

interface DictionaryTabsProps {
  dictionaries: Dictionary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function DictionaryTabs({
  dictionaries,
  selectedId,
  onSelect,
  onCreate,
}: DictionaryTabsProps) {
  const canCreateDictionary = LANGUAGE_CODES.some(
    (language) => !dictionaries.some((dictionary) => dictionary.sourceLanguage === language),
  );

  return (
    <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 border-b border-border/60 bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 sm:px-5">
        <nav
          aria-label="Słowniki"
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2.5"
        >
          {dictionaries.map((dictionary) => {
            const active = dictionary.id === selectedId;

            return (
              <button
                key={dictionary.id}
                type="button"
                onClick={() => onSelect(dictionary.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: DICTIONARY_COLOR_HEX[dictionary.color] }}
                />
                {dictionary.name}
              </button>
            );
          })}
        </nav>

        {canCreateDictionary ? (
          <>
            <div aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onCreate}
              aria-label="Utwórz nowy słownik"
              title="Nowy słownik"
              className="size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Plus />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
