import { NextResponse } from "next/server";

import { isAiExampleConfigured } from "@/lib/ai/example";
import { translateText } from "@/lib/translation";
import { firstZodError, lookupRequestSchema } from "@/lib/validation";
import type { EnrichResponse } from "@/types/api";

/**
 * Translation only. Example sentences are fetched by /api/examples in
 * parallel on the client so Tatoeba latency cannot delay the preview.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane wejściowe." }, { status: 400 });
  }

  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const { word, sourceLanguage, targetLanguage } = parsed.data;

  const translation = await translateText(word, sourceLanguage, targetLanguage);

  const payload: EnrichResponse = {
    word,
    translation,
    examples: [],
    examplesError: null,
    aiAvailable: isAiExampleConfigured(),
    fetchedAt: Date.now(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
