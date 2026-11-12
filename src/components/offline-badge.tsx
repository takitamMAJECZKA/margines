"use client";

import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBadge() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300"
    >
      <WifiOff className="size-3" aria-hidden="true" />
      Offline
    </span>
  );
}
