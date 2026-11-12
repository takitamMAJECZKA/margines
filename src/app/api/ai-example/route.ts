import { NextResponse } from "next/server";

import { generateAiExample, isAiExampleConfigured } from "@/lib/ai/example";
import { issueFromError } from "@/lib/server/errors";
import { aiExampleRequestSchema, firstZodError } from "@/lib/validation";
import type { AiExampleResponse } from "@/types/api";

export async function POST(request: Request) {
  if (!isAiExampleConfigured()) {
    return NextResponse.json(
      {
        error: "Generator przykładów AI nie jest skonfigurowany.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane wejściowe." }, { status: 400 });
  }

  const parsed = aiExampleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
  }

  try {
    const example = await generateAiExample(
      parsed.data.word,
      parsed.data.sourceLanguage,
    );
    const payload: AiExampleResponse = { example };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const issue = issueFromError(error, "Nie udało się wygenerować przykładu AI.");
    return NextResponse.json(
      { error: issue.message, code: issue.code },
      { status: 502 },
    );
  }
}
