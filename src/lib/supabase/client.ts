import { createBrowserClient } from "@supabase/ssr";

let browserConfig: { url: string; key: string } | null = null;

/**
 * The root layout reads Supabase configuration on the server and forwards the
 * public values here, because `NEXT_PUBLIC_` variables cannot be stored as
 * Secrets in Vercel.
 */
export function configureSupabase(config: { url: string; key: string }) {
  browserConfig = config;
}

export function createClient() {
  const url = browserConfig?.url || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    browserConfig?.key || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Brak konfiguracji Supabase.");
  return createBrowserClient(url, key);
}
