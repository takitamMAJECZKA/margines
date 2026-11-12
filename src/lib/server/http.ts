import { ProviderRequestError } from "./errors";

interface TimedFetchOptions extends RequestInit {
  timeoutMs?: number;
}

const TIMEOUT_MESSAGE = "Zewnętrzna usługa odpowiada zbyt wolno. Spróbuj ponownie.";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function timeoutError(): ProviderRequestError {
  return new ProviderRequestError("TIMEOUT", TIMEOUT_MESSAGE);
}

/**
 * Fetch with a hard timeout. External AI/translation APIs must never leave the
 * UI waiting indefinitely. The optional caller signal lets a whole operation
 * (for example a multi-request example lookup) enforce one shared deadline.
 */
export async function fetchWithTimeout(
  input: string | URL,
  { timeoutMs = 10_000, signal: externalSignal, ...init }: TimedFetchOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      abort();
    } else {
      externalSignal.addEventListener("abort", abort, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw timeoutError();
    }

    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie udało się połączyć z zewnętrzną usługą.",
    );
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

async function readBodyText(
  response: Response,
  signal?: AbortSignal,
): Promise<string> {
  const bodyPromise = response.text();

  if (!signal) return bodyPromise;

  if (signal.aborted) {
    // Drain the body so the underlying socket can be released.
    bodyPromise.catch(() => undefined);
    throw timeoutError();
  }

  return new Promise<string>((resolve, reject) => {
    const onAbort = () => reject(timeoutError());

    signal.addEventListener("abort", onAbort, { once: true });
    bodyPromise.then(
      (text) => {
        signal.removeEventListener("abort", onAbort);
        resolve(text);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Read and parse a JSON body under the same deadline as the request. Headers
 * can arrive quickly while the body stalls, so the caller's signal also covers
 * the body read.
 */
export async function readJson<T>(
  response: Response,
  signal?: AbortSignal,
): Promise<T> {
  let text: string;

  try {
    text = await readBodyText(response, signal);
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;

    if (signal?.aborted || isAbortError(error)) {
      throw timeoutError();
    }

    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Zewnętrzna usługa zwróciła nieprawidłową odpowiedź.",
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Zewnętrzna usługa zwróciła nieprawidłową odpowiedź.",
    );
  }
}
