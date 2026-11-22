import { NextResponse, type NextRequest } from "next/server";

// Wymiana kodu sesji Supabase jest tymczasowo wyłączona.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}
