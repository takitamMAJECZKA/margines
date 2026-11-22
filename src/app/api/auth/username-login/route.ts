import { NextResponse } from "next/server";

// Logowanie nazwą użytkownika jest tymczasowo wyłączone. Aplikacja nie
// wymaga konta i zapisuje dane lokalnie w przeglądarce.
export async function POST() {
  return NextResponse.json(
    { error: "Logowanie jest tymczasowo wyłączone." },
    { status: 410 },
  );
}
