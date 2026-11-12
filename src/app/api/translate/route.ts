import { NextResponse } from "next/server";

import { translateText } from "@/lib/translation";
import { firstZodError, translateRequestSchema } from "@/lib/validation";

/**
 * Standalone translation endpoint. Keeping it separate from /api/enrich makes
 * the provider replaceable and allows future retry / re-translate actions.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane wejściowe." }, { status: 400 });
  }

  const parsed = translateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const { text, sourceLanguage, targetLanguage } = parsed.data;
  const result = await translateText(text, sourceLanguage, targetLanguage);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
