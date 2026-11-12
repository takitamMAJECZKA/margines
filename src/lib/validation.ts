import { z } from "zod";

import {
  DICTIONARY_COLORS,
  FOREIGN_LANGUAGE_CODES,
  LANGUAGE_CODES,
} from "@/lib/languages";
import { normalizeWord } from "@/lib/utils";

const languageCodeSchema = z.enum(LANGUAGE_CODES);
const foreignLanguageCodeSchema = z.enum(FOREIGN_LANGUAGE_CODES);

export const wordTextSchema = z
  .string()
  .trim()
  .min(1, "Wpisz słowo.")
  .max(80, "Słowo może mieć maksymalnie 80 znaków.")
  .refine((value) => /[\p{L}]/u.test(value), "Słowo musi zawierać przynajmniej jedną literę.")
  .refine(
    (value) => /^[\p{L}\p{M}\s'’\-.]+$/u.test(value),
    "Dozwolone są litery, spacje, apostrofy, myślniki i kropki.",
  );

export const dictionaryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Wpisz nazwę słownika.")
      .max(40, "Nazwa może mieć maksymalnie 40 znaków."),
    sourceLanguage: languageCodeSchema,
    targetLanguage: languageCodeSchema,
    isNative: z.boolean(),
    color: z.enum(DICTIONARY_COLORS),
  })
  .superRefine((value, ctx) => {
    if (value.isNative && (value.sourceLanguage !== "pl" || value.targetLanguage !== "pl")) {
      ctx.addIssue({
        code: "custom",
        path: ["isNative"],
        message: "Słownik ojczysty obsługuje obecnie tylko język polski.",
      });
    }

    if (!value.isNative && value.sourceLanguage === value.targetLanguage) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceLanguage"],
        message: "Język źródłowy i docelowy muszą się różnić.",
      });
    }
  });

export type DictionaryFormValues = z.infer<typeof dictionaryFormSchema>;

export const wordDraftSchema = z.object({
  originalWord: wordTextSchema,
  translation: z
    .string()
    .trim()
    .min(1, "Wpisz polskie tłumaczenie.")
    // Monolingual definitions can be longer than a short translation.
    .max(600, "Tłumaczenie może mieć maksymalnie 600 znaków."),
  exampleSentence: z
    .string()
    .trim()
    .max(500, "Zdanie może mieć maksymalnie 500 znaków."),
  exampleTranslation: z
    .string()
    .trim()
    .max(500, "Tłumaczenie zdania może mieć maksymalnie 500 znaków."),
  exampleSource: z.string().trim().max(80),
  exampleSourceUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\/\S+$/i.test(value),
      "Nieprawidłowy adres źródła.",
    ),
  exampleAttribution: z.string().trim().max(240),
  exampleType: z.enum(["authentic", "ai", "manual"]),
});

export type WordDraftValues = z.infer<typeof wordDraftSchema>;

export const dictionaryTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Wpisz nazwę słownika.")
    .max(40, "Nazwa może mieć maksymalnie 40 znaków."),
});

export const ALL_WORDS_SET_NAME = "Wszystkie";

export const setFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Wpisz nazwę zestawu.")
      .max(40, "Nazwa zestawu może mieć maksymalnie 40 znaków."),
  })
  .superRefine((value, ctx) => {
    if (normalizeWord(value.name) === normalizeWord(ALL_WORDS_SET_NAME)) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Nazwa „Wszystkie” jest zarezerwowana dla widoku wszystkich słów.",
      });
    }
  });

export type SetFormValues = z.infer<typeof setFormSchema>;

export const lookupRequestSchema = z.object({
  word: z.string().trim().min(1).max(80),
  sourceLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
}).refine(
  ({ sourceLanguage, targetLanguage }) =>
    sourceLanguage !== targetLanguage &&
    (sourceLanguage === "pl" || targetLanguage === "pl"),
  "Tłumaczenie musi łączyć polski z innym językiem.",
);

export type LookupRequest = z.infer<typeof lookupRequestSchema>;

export const examplesRequestSchema = z.object({
  word: z.string().trim().min(1).max(80),
  sourceLanguage: foreignLanguageCodeSchema,
  excludeIds: z.array(z.string().max(40)).max(20).optional(),
});

export type ExamplesRequest = z.infer<typeof examplesRequestSchema>;

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  sourceLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
}).refine(
  ({ sourceLanguage, targetLanguage }) =>
    sourceLanguage !== targetLanguage &&
    (sourceLanguage === "pl" || targetLanguage === "pl"),
  "Tłumaczenie musi łączyć polski z innym językiem.",
);

export const aiExampleRequestSchema = z.object({
  word: z.string().trim().min(1).max(80),
  sourceLanguage: foreignLanguageCodeSchema,
});

/** Native Polish dictionary: monolingual definitions from pl.wiktionary.org. */
export const definitionRequestSchema = z.object({
  word: wordTextSchema,
});

export type DefinitionRequest = z.infer<typeof definitionRequestSchema>;

/** Foreign nouns: Wiktionary gender/article enrichment. */
export const articleRequestSchema = z.object({
  word: wordTextSchema,
  sourceLanguage: foreignLanguageCodeSchema,
});

export type ArticleRequest = z.infer<typeof articleRequestSchema>;

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Nieprawidłowe dane.";
}
