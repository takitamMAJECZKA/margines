import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const genericError = { error: "Nieprawidłowa nazwa użytkownika lub hasło." };

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // The browser must call the same-origin Next.js route, which forwards the request server-to-server.
  if (request.headers.has("origin")) return json(genericError, 403);

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json(genericError, 400);
  }
  if (!/^[a-z0-9_]{3,32}$/.test(username) || password.length < 1 || password.length > 256) {
    return json(genericError, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const secretSource = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
  const resolveKey = (value: string | undefined) => {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed : parsed.default;
    } catch {
      return value;
    }
  };
  const anonKey = resolveKey(publicKey);
  const secretKey = resolveKey(secretSource);
  if (!url || !anonKey || !secretKey) return json({ error: "Auth service unavailable" }, 503);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("email").eq("username", username).maybeSingle();
  const email = profile?.email ?? `unknown-${crypto.randomUUID()}@invalid.margines.app`;
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json(genericError, 401);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
