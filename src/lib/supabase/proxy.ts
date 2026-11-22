import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./env";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") {
      return NextResponse.next({ request });
    }
    return NextResponse.redirect(new URL("/login?setup=1", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = ["/login", "/signup", "/auth/callback"].some((path) =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`),
  ) || request.nextUrl.pathname === "/api/auth/username-login";

  if (!user && !isPublic) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(target);
  }
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
