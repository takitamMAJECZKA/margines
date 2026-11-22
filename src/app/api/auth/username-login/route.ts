import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Nieprawidłowa nazwa użytkownika lub hasło.";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 403 });
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (!/^[a-z0-9_]{3,32}$/.test(username) || password.length < 1 || password.length > 256) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) return NextResponse.json({ error: "Brak konfiguracji Supabase." }, { status: 503 });

  try {
    const response = await fetch(`${url}/functions/v1/username-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    const session = await response.json();
    if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string") {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nie udało się połączyć z usługą logowania." }, { status: 502 });
  }
}
