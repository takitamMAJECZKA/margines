import { NextResponse } from "next/server";

import { issueFromError } from "@/lib/server/errors";
import { findAuthenticExamples } from "@/lib/tatoeba/client";
import { examplesRequestSchema, firstZodError } from "@/lib/validation";
import type { ExamplesResponse } from "@/types/api";

/**
 * Example sentences live in their own endpoint so a slow Tatoeba response
 * never blocks the translation shown in the add-word dialog.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane wejściowe." }, { status: 400 });
  }

  const parsed = examplesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  const { word, sourceLanguage, excludeIds = [] } = parsed.data;

  let payload: ExamplesResponse;

  try {
    const result = await findAuthenticExamples(word, sourceLanguage, excludeIds);
    payload = {
      examples: result.examples,
      examplesError: result.error,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    payload = {
      examples: [],
      examplesError: issueFromError(
        error,
        "Nie udało się pobrać przykładów z Tatoeba.",
      ),
      fetchedAt: Date.now(),
    };
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
