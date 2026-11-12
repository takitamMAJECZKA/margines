import { useRef, useState } from "react";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Word } from "@/db/types";
import { cn, formatAddedDate } from "@/lib/utils";

const SWIPE_TRIGGER = 76;
const MAX_SWIPE = 132;

interface VocabularyItemProps {
  word: Word;
  onEdit: (word: Word) => void;
  onDelete: (word: Word) => void;
  onSwipeDelete: (word: Word) => void;
}

interface DragState {
  startX: number;
  startY: number;
  pointerId: number;
  horizontal: boolean | null;
}

export function VocabularyItem({
  word,
  onEdit,
  onDelete,
  onSwipeDelete,
}: VocabularyItemProps) {
  const hasExample = Boolean(word.exampleSentence);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);

  function updateOffset(value: number) {
    offsetRef.current = value;
    setOffset(value);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      horizontal: null,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;

      if (Math.abs(dx) > Math.abs(dy) * 1.1) {
        drag.horizontal = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is best-effort; the gesture still works without it.
        }
      } else {
        dragRef.current = null;
        setDragging(false);
        updateOffset(0);
        return;
      }
    }

    if (!drag.horizontal) return;

    // Clamp the reveal so the row cannot be dragged across the whole screen.
    updateOffset(
      dx > 0 ? Math.min(dx, MAX_SWIPE) : Math.max(dx, -MAX_SWIPE),
    );
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    dragRef.current = null;
    setDragging(false);

    const dx = offsetRef.current;

    if (dx <= -SWIPE_TRIGGER) {
      // Show the red reveal for a beat before the row disappears.
      updateOffset(-MAX_SWIPE);
      window.setTimeout(() => {
        updateOffset(0);
        onSwipeDelete(word);
      }, 110);
      return;
    }

    if (dx >= SWIPE_TRIGGER) {
      updateOffset(0);
      onEdit(word);
      return;
    }

    updateOffset(0);
  }

  function handlePointerCancel() {
    dragRef.current = null;
    setDragging(false);
    updateOffset(0);
  }

  return (
    <li className="group relative overflow-hidden rounded-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-stretch justify-between"
      >
        <div
          className={cn(
            "flex items-center gap-2 bg-primary px-4 text-primary-foreground transition-opacity duration-150",
            offset > 0 ? "opacity-100" : "opacity-0",
          )}
        >
          <Pencil className="size-4" />
          <span className="text-[11px] font-medium tracking-wide">Edytuj</span>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 bg-destructive px-4 text-white transition-opacity duration-150",
            offset < 0 ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="text-[11px] font-medium tracking-wide">Usuń</span>
          <Trash2 className="size-4" />
        </div>
      </div>

      <article
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging
            ? "none"
            : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
        className={cn(
          "relative flex gap-2 bg-background py-5 sm:gap-4",
          dragging && "cursor-grabbing select-none",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-1">
            <h3 className="font-display text-[1.55rem] leading-tight font-medium tracking-[-0.02em] break-words">
              {word.originalWord}
            </h3>
            <span className="text-[15px] leading-relaxed text-muted-foreground">
              {word.translation}
            </span>
          </div>

          {hasExample ? (
            <blockquote className="mt-2.5 border-l-2 border-border/90 pl-3">
              <p className="text-sm leading-relaxed text-foreground/85">
                „{word.exampleSentence}”
              </p>
              {word.exampleTranslation ? (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {word.exampleTranslation}
                </p>
              ) : null}
            </blockquote>
          ) : null}

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/85">
            <CalendarDays className="size-3" aria-hidden="true" />
            Dodano {formatAddedDate(word.createdAt)}
            {word.reviewCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {word.reviewCount}{" "}
                  {word.reviewCount === 1
                    ? "powtórka"
                    : word.reviewCount < 5
                      ? "powtórki"
                      : "powtórek"}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-0.5 transition-opacity sm:opacity-50 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(word)}
            aria-label={`Edytuj słowo ${word.originalWord}`}
            title="Edytuj"
            className="size-11 text-muted-foreground hover:text-foreground sm:size-10"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(word)}
            aria-label={`Usuń słowo ${word.originalWord}`}
            title="Usuń"
            className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-10"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </article>
    </li>
  );
}
