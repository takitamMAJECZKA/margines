import { NextResponse } from "next/server";

// Konta i logowanie są tymczasowo wyłączone. Aplikacja nie wymaga sesji,
// więc proxy nie przekierowuje już niezalogowanych użytkowników na /login.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
