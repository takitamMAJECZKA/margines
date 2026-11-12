import { NextResponse } from "next/server";

import { issueFromError } from "@/lib/server/errors";
import { findPolishDefinitions } from "@/lib/wiktionary/polish";
import { definitionRequestSchema, firstZodError } from "@/lib/validation";
import type { DefinitionResponse } from "@/types/api";

/**
 * Monolingual Polish lookup for the native dictionary. Polish is never
 * translated into another language, so this endpoint returns definitions
 * instead of a translation.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowe dane wejściowe." },
      { status: 400 },
    );
  }

  const parsed = definitionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed.error) },
      { status: 400 },
    );
  }

  const { word } = parsed.data;

  let payload: DefinitionResponse;

  try {
    const definitions = await findPolishDefinitions(word);
    payload = {
      word,
      definitions,
      error: null,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    payload = {
      word,
      definitions: [],
      error: issueFromError(
        error,
        "Nie udało się pobrać definicji z polskiego Wikisłownika.",
      ),
      fetchedAt: Date.now(),
    };
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
