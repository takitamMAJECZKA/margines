import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path
        d="M9.4 12.7c4.9-1.5 8.4-1 10.6 1.1v13.3c-2.2-2.1-5.7-2.6-10.6-1.1V12.7Z"
        className="fill-primary-foreground"
      />
      <path
        d="M30.6 12.7c-4.9-1.5-8.4-1-10.6 1.1v13.3c2.2-2.1 5.7-2.6 10.6-1.1V12.7Z"
        className="fill-primary-foreground/75"
      />
      <path
        d="M20 14.3v12.7"
        className="stroke-primary"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M14.4 17.4c1.4-.2 2.6-.1 3.6.4M14.4 20.5c1.4-.2 2.6-.1 3.6.4"
        className="stroke-primary/45"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle cx="29.3" cy="27.2" r="1.6" className="fill-amber-500" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Margines — strona główna"
      className={cn(
        "flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
    >
      <BrandMark />
      <span className="font-display text-[1.35rem] font-semibold tracking-[-0.02em]">
        Margines
      </span>
    </Link>
  );
}
