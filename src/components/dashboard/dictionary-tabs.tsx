"use client";

import { useEffect, useRef, useState } from "react";
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
  onReorder: (ids: string[]) => void;
}

export function DictionaryTabs({
  dictionaries,
  selectedId,
  onSelect,
  onCreate,
  onReorder,
}: DictionaryTabsProps) {
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const canCreateDictionary = LANGUAGE_CODES.some(
    (language) => !dictionaries.some((dictionary) => dictionary.sourceLanguage === language),
  );

  useEffect(() => {
    if (!dragSource) return;

    function handlePointerMove(event: PointerEvent) {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const tab = element?.closest<HTMLElement>("[data-dictionary-id]");
      const id = tab?.dataset.dictionaryId;
      if (id && id !== dragTargetRef.current) {
        dragTargetRef.current = id;
        setDragTarget(id);
      }
    }

    function finishDrag(cancelled = false) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      const source = dragSourceRef.current;
      const target = dragTargetRef.current;
      if (!cancelled && source && target && source !== target) {
        const ids = dictionaries.map((dictionary) => dictionary.id);
        const from = ids.indexOf(source);
        const to = ids.indexOf(target);
        if (from >= 0 && to >= 0) {
          ids.splice(from, 1);
          ids.splice(to, 0, source);
          onReorder(ids);
        }
      }

      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 500);
      dragSourceRef.current = null;
      dragTargetRef.current = null;
      setDragSource(null);
      setDragTarget(null);
    }

    function handlePointerUp() {
      finishDrag();
    }

    function handlePointerCancel() {
      finishDrag(true);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
    document.addEventListener("pointercancel", handlePointerCancel, { once: true });
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [dictionaries, dragSource, onReorder]);

  function startLongPress(id: string) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      dragSourceRef.current = id;
      dragTargetRef.current = id;
      setDragSource(id);
      setDragTarget(id);
    }, 450);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

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
                data-dictionary-id={dictionary.id}
                onPointerDown={(event) => {
                  if (event.button === 0) startLongPress(dictionary.id);
                }}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(event) => {
                  if (dragSource) event.preventDefault();
                }}
                onClick={(event) => {
                  if (suppressClickRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  onSelect(dictionary.id);
                }}
                aria-current={active ? "page" : undefined}
                title="Przytrzymaj i przeciągnij, aby zmienić kolejność"
                className={cn(
                  "flex h-9 shrink-0 touch-pan-x items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "border-border bg-card text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  dragSource === dictionary.id && "cursor-grabbing opacity-60",
                  dragTarget === dictionary.id && dragSource !== dictionary.id && "ring-2 ring-primary/50",
                  dragSource !== dictionary.id && "cursor-grab",
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
