import { NextResponse } from "next/server";

import { firstZodError, speechRequestSchema } from "@/lib/validation";

const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";

/**
 * Device voices are used first, but Windows only ships voices for the system
 * language and English. When the browser has no voice for the card language,
 * the client streams the phrase through this endpoint so it is read with a
 * native accent instead of the system default one.
 *
 * The request is proxied instead of hitting Google from the browser because
 * Google rejects requests that carry a foreign `Referer` header.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = speechRequestSchema.safeParse({
    text: searchParams.get("text") ?? "",
    language: searchParams.get("language") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed.error) },
      { status: 400 },
    );
  }

  const { text, language } = parsed.data;
  const url = `${GOOGLE_TTS_URL}?${new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: language,
    q: text,
  }).toString()}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Nie udało się pobrać wymowy." },
        { status: 502 },
      );
    }

    const audio = await response.arrayBuffer();

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się pobrać wymowy." },
      { status: 502 },
    );
  }
}
