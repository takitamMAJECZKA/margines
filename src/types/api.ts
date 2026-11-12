export type TranslationProviderName =
  | "deepl"
  | "libretranslate"
  | "wiktionary";

export type ApiIssueCode =
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "QUOTA_EXCEEDED"
  | "UNAVAILABLE"
  | "BAD_REQUEST";

export interface ApiIssue {
  code: ApiIssueCode;
  message: string;
}

export interface TranslationResult {
  text: string | null;
  provider: TranslationProviderName | null;
  error: ApiIssue | null;
}

export interface AuthenticExample {
  id: string;
  text: string;
  translation: string;
  source: "Tatoeba";
  sourceUrl: string;
  attribution: string;
  license: string;
  hasDirectTranslation: boolean;
}

/** A monolingual dictionary sense, used by the native Polish dictionary. */
export interface DefinitionEntry {
  id: string;
  text: string;
  /** Grammatical label such as "rzeczownik, rodzaj męski". */
  partOfSpeech: string;
  /** Dictionary sense number such as "1.2". */
  sense: string;
}

export interface EnrichResponse {
  /** Word that will be saved, including an article when one was found. */
  word: string;
  /** Word exactly as the user typed it, without an added article. */
  baseWord?: string;
  /** True when Wiktionary supplied a gender/article for this noun. */
  articleApplied?: boolean;
  /** True when the user entered Polish and the learned-language word was translated. */
  reverseLookup?: boolean;
  translation: TranslationResult;
  /** Available for the native Polish dictionary. */
  definitions?: DefinitionEntry[];
  examples: AuthenticExample[];
  examplesError: ApiIssue | null;
  aiAvailable: boolean;
  fetchedAt: number;
}

export interface ExamplesResponse {
  examples: AuthenticExample[];
  examplesError: ApiIssue | null;
  fetchedAt: number;
}

export interface DefinitionResponse {
  word: string;
  definitions: DefinitionEntry[];
  error: ApiIssue | null;
  fetchedAt: number;
}

export interface ArticleResponse {
  /** Word with the article prepended when one was found. */
  word: string;
  baseWord: string;
  article: string | null;
  applied: boolean;
  error: ApiIssue | null;
  fetchedAt: number;
}

export interface AiExample {
  text: string;
  translation: string;
  model: string;
}

export interface AiExampleResponse {
  example: AiExample;
}

export interface ApiErrorResponse {
  error: string;
}
