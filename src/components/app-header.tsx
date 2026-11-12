import { Brand } from "@/components/brand";
import { OfflineBadge } from "@/components/offline-badge";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1.5">
          <OfflineBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
