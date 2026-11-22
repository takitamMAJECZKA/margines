"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { ServiceWorkerRegister } from "@/components/service-worker-register";

// Konta i synchronizacja z Supabase są tymczasowo wyłączone. Aplikacja
// przechowuje słowniki, słowa i postęp lokalnie w IndexedDB przeglądarki.
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
        {children}
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
