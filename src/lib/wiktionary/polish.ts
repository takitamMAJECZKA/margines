import "server-only";

import { ProviderRequestError } from "@/lib/server/errors";
import type { DefinitionEntry } from "@/types/api";

import {
  extractMeaningsBlock,
  fetchWiktionaryPage,
  stripWikiMarkup,
} from "./client";

const MAX_DEFINITIONS = 6;
const MAX_DEFINITION_LENGTH = 560;

function extractPolishSection(wikitext: string): string {
  const heading = /^==\s*.*\{\{\s*język polski\s*\}\}.*==\s*$/im;
  const match = heading.exec(wikitext);
  if (!match) return "";

  const rest = wikitext.slice(match.index + match[0].length);
  const nextHeading = rest.match(/^==[^=].*$/m);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

function cleanDefinition(value: string): string {
  const text = stripWikiMarkup(value);
  if (text.length <= MAX_DEFINITION_LENGTH) return text;
  return `${text.slice(0, MAX_DEFINITION_LENGTH).trimEnd()}…`;
}

/**
 * Monolingual Polish lookup. dictionaryapi.dev has no Polish entries, so the
 * app reads the numbered senses from the Polish Wiktionary's `{{znaczenia}}`
 * block instead.
 */
export async function findPolishDefinitions(
  word: string,
): Promise<DefinitionEntry[]> {
  const page = await fetchWiktionaryPage("pl", word);

  if (!page.wikitext) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie znaleziono tego słowa w polskim Wikisłowniku. Możesz wpisać definicję ręcznie.",
    );
  }

  const section = extractPolishSection(page.wikitext);
  const block = extractMeaningsBlock(section || page.wikitext);

  if (block.length === 0) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie udało się odczytać definicji z Wikisłownika. Możesz wpisać ją ręcznie.",
    );
  }

  const definitions: DefinitionEntry[] = [];
  const seen = new Set<string>();
  let partOfSpeech = "";

  for (const line of block) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Lines such as ''rzeczownik, rodzaj męskorzeczowy'' describe the part of
    // speech for the definitions that follow.
    if (!/^[:#]/.test(trimmed)) {
      const label = stripWikiMarkup(trimmed);
      if (label) partOfSpeech = label;
      continue;
    }

    const match = /^[:#]+\s*(?:\(([^)]+)\)\s*)?(.+)$/.exec(trimmed);
    if (!match) continue;

    const sense = (match[1] ?? "").trim();
    const text = cleanDefinition(match[2]);
    if (text.length < 2) continue;

    const key = text.toLocaleLowerCase("pl");
    if (seen.has(key)) continue;
    seen.add(key);

    definitions.push({
      id: `pl-def-${definitions.length + 1}`,
      text,
      partOfSpeech,
      sense,
    });

    if (definitions.length >= MAX_DEFINITIONS) break;
  }

  if (definitions.length === 0) {
    throw new ProviderRequestError(
      "UNAVAILABLE",
      "Nie znaleziono definicji w polskim Wikisłowniku. Możesz wpisać ją ręcznie.",
    );
  }

  return definitions;
}
