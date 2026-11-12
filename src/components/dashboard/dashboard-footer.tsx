import { InstallHint } from "@/components/install-hint";

export function DashboardFooter() {
  return (
    <footer className="mt-14 flex flex-col gap-2 border-t border-border/60 py-6 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p data-testid="local-data-note">
        Dane zapisują się wyłącznie na tym urządzeniu.
      </p>
      <InstallHint />
    </footer>
  );
}
