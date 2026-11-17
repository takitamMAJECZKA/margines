import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function KnowledgeStars({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const level = Math.max(0, Math.min(5, Math.round(score || 0)));

  return (
    <span
      role="img"
      aria-label={`Poziom znajomości: ${level} z 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            "size-3.5",
            index < level
              ? "fill-amber-500 text-amber-500"
              : "fill-transparent text-border",
          )}
        />
      ))}
    </span>
  );
}
