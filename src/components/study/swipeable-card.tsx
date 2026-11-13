"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 88;
const EXIT_DISTANCE = 520;
const EXIT_DURATION_MS = 180;

interface SwipeableCardProps {
  enabled: boolean;
  onAnswer: (known: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export function SwipeableCard({
  enabled,
  onAnswer,
  className,
  children,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const startRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const horizontalRef = useRef(false);
  const offsetRef = useRef(0);
  const answeredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function resetDrag() {
    startRef.current = null;
    horizontalRef.current = false;
    offsetRef.current = 0;
    setDragging(false);
    setOffset(0);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || answeredRef.current) return;

    const target = event.target as HTMLElement;
    if (target.closest("a, input, textarea, select, [data-swipe-ignore]")) {
      return;
    }

    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    horizontalRef.current = false;
    setDragging(true);
    // Keep mouse drags captured immediately. For touch, wait until the user
    // clearly chooses a horizontal gesture so the browser can still start a
    // vertical page scroll without cancelling a swipe prematurely.
    if (event.pointerType !== "touch") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId || answeredRef.current) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (!horizontalRef.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;

      // Vertical gestures belong to page scrolling.
      if (Math.abs(deltaY) >= Math.abs(deltaX) * 1.1) {
        startRef.current = null;
        offsetRef.current = 0;
        setDragging(false);
        setOffset(0);
        return;
      }

      horizontalRef.current = true;
      if (event.pointerType === "touch") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    // touch-action: pan-y lets the page handle vertical motion. Once this is
    // clearly a horizontal swipe, prevent any remaining browser gesture from
    // stealing it.
    if (event.cancelable) event.preventDefault();

    const resistance = 1 - Math.min(Math.abs(deltaX) / 900, 0.3);
    const nextOffset =
      Math.sign(deltaX) * Math.min(Math.abs(deltaX) * resistance, 240);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }

  function settle(known: boolean) {
    answeredRef.current = true;
    setExiting(known ? "right" : "left");
    offsetRef.current = known ? EXIT_DISTANCE : -EXIT_DISTANCE;
    setOffset(known ? EXIT_DISTANCE : -EXIT_DISTANCE);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onAnswer(known);
    }, EXIT_DURATION_MS);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current || startRef.current.pointerId !== event.pointerId) return;
    if (answeredRef.current) return;

    if (horizontalRef.current && Math.abs(offsetRef.current) >= SWIPE_THRESHOLD) {
      settle(offsetRef.current > 0);
      return;
    }

    resetDrag();
  }

  function handlePointerCancel() {
    if (answeredRef.current) return;
    resetDrag();
  }

  const overlayOpacity = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const swipingRight = offset > 0;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={(event) => {
        if (answeredRef.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      style={{
        transform: `translateX(${offset}px) rotate(${offset / 45}deg)`,
        transition: dragging
          ? "none"
          : `transform ${EXIT_DURATION_MS}ms ease-out, opacity ${EXIT_DURATION_MS}ms ease-out`,
        opacity: exiting ? 0 : 1,
        touchAction: "pan-y",
      }}
      className={cn("relative select-none", className)}
    >
      {children}

      {enabled && offset !== 0 ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-3xl border-2",
            swipingRight
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/50 bg-destructive/10 text-destructive",
          )}
          style={{ opacity: overlayOpacity }}
        >
          <span
            className="flex items-center gap-2 rounded-full border border-current/25 bg-background/80 px-4 py-2 text-sm font-semibold tracking-[0.14em] uppercase shadow-sm backdrop-blur-sm"
            style={{ transform: `rotate(${swipingRight ? -8 : 8}deg)` }}
          >
            {swipingRight ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Znam
              </>
            ) : (
              <>
                <RotateCcw className="size-4" aria-hidden="true" />
                Nie znam
              </>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}
