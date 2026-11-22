/**
 * Supabase configuration is read from server-side variable names so the same
 * values can be stored in Vercel as Config or Secret without the
 * `NEXT_PUBLIC_` prefix restriction.
 *
 * The URL and publishable (anon) key are public by design — row level security
 * protects the data. Never use the service-role key here.
 */
export function getSupabaseConfig() {
  return {
    url:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    key:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "",
  };
}
