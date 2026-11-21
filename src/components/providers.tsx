"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Button } from "@/components/ui/button";
import { clearCloudUserCache, initializeCloudData } from "@/db/cloud-sync";
import { createClient } from "@/lib/supabase/client";
import { readUserPreferences } from "@/lib/user-preferences";
import { useTheme } from "next-themes";

function CloudDataGate({ children }: { children: ReactNode }) {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [clientReady, setClientReady] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPublicPath = ["/login", "/signup", "/auth/callback"].some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );
  const requiresAuthentication = userId === null && !isPublicPath;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClientReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const hydrate = useCallback(async (id: string) => {
    try {
      setError(null);
      await initializeCloudData(id);
      setTheme(readUserPreferences().theme);
      setHydratedUserId(id);
    } catch (cause) {
      console.error("Supabase data initialisation failed", cause);
      setError("Nie udało się pobrać danych z Supabase. Sprawdź połączenie i spróbuj ponownie.");
    }
  }, [setTheme]);

  useEffect(() => {
    if (!supabase) {
      setUserId(null);
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setError("Nie udało się odczytać sesji Supabase.");
        setUserId(null);
        return;
      }
      setUserId(data.session?.user.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      setUserId(nextId);
      if (event === "SIGNED_OUT") {
        setHydratedUserId(null);
        void clearCloudUserCache();
      }
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (userId) void hydrate(userId);
  }, [hydrate, userId]);

  useEffect(() => {
    if (!clientReady || !requiresAuthentication) return;
    const target = new URLSearchParams({ next: pathname });
    router.replace(`/login?${target.toString()}`);
  }, [clientReady, pathname, requiresAuthentication, router]);

  useEffect(() => {
    if (!userId || hydratedUserId !== userId) return;
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void initializeCloudData(userId).catch((cause: unknown) => {
          console.error("Supabase refresh failed", cause);
        });
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [hydratedUserId, userId]);

  if (!clientReady || userId === undefined || (userId && hydratedUserId !== userId && !error)) {
    return (
      <>
        <div hidden aria-hidden="true">{children}</div>
        <main role="status" className="flex min-h-dvh items-center justify-center px-6 text-sm text-muted-foreground">
          Łączę Twoje słowniki…
        </main>
      </>
    );
  }
  if (requiresAuthentication) {
    return <main role="status" className="flex min-h-dvh items-center justify-center px-6 text-sm text-muted-foreground">Przenoszę do logowania…</main>;
  }
  if (userId && error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => void hydrate(userId)}>Spróbuj ponownie</Button>
      </main>
    );
  }
  return children;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <CloudDataGate>{children}</CloudDataGate>
        <Toaster
          position="top-center"
          offset={16}
          gap={8}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border-border !bg-card !text-card-foreground !shadow-card",
              description: "!text-muted-foreground",
              actionButton: "!bg-primary !text-primary-foreground",
              cancelButton: "!bg-secondary !text-secondary-foreground",
            },
          }}
        />
        <ServiceWorkerRegister />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
