import "server-only";

import { serverCache } from "@/lib/server/cache";
import { ProviderRequestError } from "@/lib/server/errors";
import { fetchWithTimeout, readJson } from "@/lib/server/http";
import { escapeRegExp } from "@/lib/utils";

const PAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MISSING_PAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const WIKTIONARY_TIMEOUT_MS = 12_000;

type WiktionaryHost = "pl" | "en";

interface MediaWikiResponse {
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
      revisions?: Array<{
        slots?: { main?: { content?: string } };
      }>;
    }>;
  };
  error?: { code?: string; info?: string };
}

export interface WiktionaryPage {
  title: string;
  wikitext: string;
}

function cacheKey(host: WiktionaryHost, title: string): string {
  return `wiktionary:${host}:${title.normalize("NFC").toLocaleLowerCase("pl")}`;
}

/**
 * Fetch a word page through the MediaWiki action API. The API is used instead
 * of the REST definition endpoint because pl.wiktionary.org's REST definition
 * endpoint currently returns 501 while raw wikitext is available.
 */
export async function fetchWiktionaryPage(
  host: WiktionaryHost,
  title: string,
): Promise<WiktionaryPage> {
  const key = cacheKey(host, title);
  const cached = serverCache.get<WiktionaryPage>(key);
  if (cached) return cached;

  const url = new URL(`https://${host}.wiktionary.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvslots: "main",
    rvprop: "content",
    format: "json",
    formatversion: "2",
    redirects: "1",
    titles: title,
  }).toString();

  const response = await fetchWithTimeout(url, {
    timeoutMs: WIKTIONARY_TIMEOUT_MS,
    headers: {
      Accept: "application/json",
      "User-Agent": "Margines/1.0 (personal vocabulary PWA)",
    },
  });

  if (response.status === 429) {
    throw new ProviderRequestError(
      "RATE_LIMITED",
      "Wikisłownik chwilowo ograniczył liczbę zapytań. Spróbuj ponownie za chwilę.",
    );
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie udało się pobrać danych z Wikisłownika.",
    );
  }

  const data = await readJson<MediaWikiResponse>(response);

  if (data.error) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Wikisłownik nie mógł przetworzyć tego zapytania.",
    );
  }

  const page = data.query?.pages?.[0];
  const wikitext = page?.revisions?.[0]?.slots?.main?.content;

  const result: WiktionaryPage =
    page && !page.missing && wikitext
      ? { title: page.title ?? title, wikitext }
      : { title: page?.title ?? title, wikitext: "" };

  if (result.wikitext) {
    serverCache.set(key, result, PAGE_CACHE_TTL_MS);
  } else {
    serverCache.set(key, result, MISSING_PAGE_CACHE_TTL_MS);
  }

  return result;
}

/**
 * Return only one language section (for example `== German ==`) so a word that
 * exists in several languages cannot borrow a noun template from another one.
 */
export function extractLanguageSection(
  wikitext: string,
  language: string,
): string {
  const heading = new RegExp(
    `^==\\s*${escapeRegExp(language)}\\s*==\\s*$`,
    "im",
  );
  const match = heading.exec(wikitext);
  if (!match) return "";

  const rest = wikitext.slice(match.index + match[0].length);
  const nextHeading = rest.match(/^==[^=].*$/m);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

/** Find the `{{znaczenia}}` block in a Polish Wiktionary entry. */
export function extractMeaningsBlock(wikitext: string): string[] {
  const lines = wikitext.split(/\r?\n/);
  const collected: string[] = [];
  let collecting = false;

  for (const line of lines) {
    if (!collecting) {
      if (/\{\{\s*znaczenia\s*\}\}/i.test(line)) collecting = true;
      continue;
    }

    // The meanings block ends at the next template or heading.
    if (/^\s*\{\{/.test(line) || /^\s*==/.test(line)) break;
    collected.push(line);
  }

  return collected;
}

/** Convert the small subset of wiki markup used in dictionary senses to text. */
export function stripWikiMarkup(value: string): string {
  let text = value;

  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<ref\b[^>]*\/>/gi, " ");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");

  // Remove innermost templates repeatedly; templates can be nested.
  for (let index = 0; index < 6; index += 1) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, " ");
    if (next === text) break;
    text = next;
  }

  text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/\S+\]/g, " ");
  text = text.replace(/'''?/g, "");

  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}
