import type { ApiIssueCode } from "@/types/api";

export class ProviderRequestError extends Error {
  readonly code: ApiIssueCode;

  constructor(code: ApiIssueCode, message: string) {
    super(message);
    this.name = "ProviderRequestError";
    this.code = code;
  }
}

export function issueFromError(error: unknown, fallbackMessage: string) {
  if (error instanceof ProviderRequestError) {
    return { code: error.code, message: error.message };
  }

  console.error("[provider]", error);
  return { code: "UNAVAILABLE" as const, message: fallbackMessage };
}
