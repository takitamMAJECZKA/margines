import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard/dashboard";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <Dashboard />
    </div>
  );
}
