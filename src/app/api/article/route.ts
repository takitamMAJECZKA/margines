import { NextResponse } from "next/server";

import { issueFromError } from "@/lib/server/errors";
import { findArticle } from "@/lib/wiktionary/article";
import { articleRequestSchema, firstZodError } from "@/lib/validation";
import type { ArticleResponse } from "@/types/api";

/**
 * Foreign nouns get their German/Spanish article from Wiktionary. The word
 * itself is translated separately, so a slow article lookup never blocks the
 * translation request.
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

  const parsed = articleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstZodError(parsed.error) },
      { status: 400 },
    );
  }

  const { word, sourceLanguage } = parsed.data;

  let payload: ArticleResponse;

  try {
    const result = await findArticle(word, sourceLanguage);
    payload = {
      word: result.word,
      baseWord: word,
      article: result.article,
      applied: result.applied,
      error: null,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    payload = {
      word,
      baseWord: word,
      article: null,
      applied: false,
      error: issueFromError(
        error,
        "Nie udało się sprawdzić rodzajnika w Wikisłowniku.",
      ),
      fetchedAt: Date.now(),
    };
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
