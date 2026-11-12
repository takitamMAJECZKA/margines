"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DuplicateWordError, ValidationError } from "@/db/errors";
import { createWord } from "@/db/words";
import type { Dictionary, Word } from "@/db/types";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { firstZodError, wordDraftSchema } from "@/lib/validation";
import type {
  AuthenticExample,
  EnrichResponse,
  TranslationProviderName,
} from "@/types/api";

type ExampleSelection =
  | { kind: "example"; id: string }
  | { kind: "none" };

function providerLabel(provider: TranslationProviderName | null): string {
  if (provider === "deepl") return "DeepL";
  if (provider === "libretranslate") return "LibreTranslate";
  if (provider === "wiktionary") return "Wikisłownik";
  return "API";
}

function ExampleCard({
  active,
  sentence,
  translation,
  onSelect,
}: {
  active: boolean;
  sentence: string;
  translation: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "w-full rounded-xl border p-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-primary/40 bg-primary/[0.055]"
          : "border-border bg-card/50 hover:border-primary/20 hover:bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Przykład
        </span>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-transparent",
          )}
        >
          <Check className="size-3" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{sentence}</p>
      {translation ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {translation}
        </p>
      ) : null}
    </button>
  );
}

interface WordPreviewFormProps {
  dictionary: Dictionary;
  enrichment: EnrichResponse;
  setIds?: string[];
  retrying: boolean;
  examplesLoading: boolean;
  onRetry: () => void;
  onRetryExamples: () => void;
  onBack: () => void;
  onClose: () => void;
  onSaved: (word: Word) => void;
  onChangeInputLanguage: () => void;
}

export function WordPreviewForm({
  dictionary,
  enrichment,
  setIds = [],
  retrying,
  examplesLoading,
  onRetry,
  onRetryExamples,
  onBack,
  onClose,
  onSaved,
  onChangeInputLanguage,
}: WordPreviewFormProps) {
  const examples = enrichment.examples.slice(0, 1);
  const firstExample = examples[0];
  const exampleIds = examples.map((example) => example.id).join("|");
  const [translation, setTranslation] = useState(enrichment.translation.text ?? "");
  const [selection, setSelection] = useState<ExampleSelection>(
    firstExample ? { kind: "example", id: firstExample.id } : { kind: "none" },
  );
  const choseNoneRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualTranslation, setManualTranslation] = useState(false);

  // Examples arrive after the translation preview opens. Select the first one
  // automatically, unless the user explicitly chose to save without one.
  useEffect(() => {
    if (!exampleIds) return;

    const ids = exampleIds.split("|");
    setSelection((current) => {
      if (current.kind === "example" && ids.includes(current.id)) return current;
      if (choseNoneRef.current) return current;
      return { kind: "example", id: ids[0] };
    });
  }, [exampleIds]);

  const selectedExample: AuthenticExample | undefined =
    selection.kind === "example"
      ? examples.find((example) => example.id === selection.id)
      : undefined;

  function selectExample(example: AuthenticExample) {
    choseNoneRef.current = false;
    setSelection({ kind: "example", id: example.id });
    setFormError(null);
  }

  function selectNone() {
    choseNoneRef.current = true;
    setSelection({ kind: "none" });
    setFormError(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const draft = {
      originalWord: enrichment.word,
      translation,
      exampleSentence: selectedExample?.text ?? "",
      exampleTranslation: selectedExample?.translation ?? "",
      exampleType: selectedExample ? ("authentic" as const) : ("manual" as const),
      exampleSource: selectedExample ? "Tatoeba" : "",
      exampleSourceUrl: selectedExample?.sourceUrl ?? "",
      exampleAttribution: selectedExample?.attribution ?? "",
    };

    const parsed = wordDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(firstZodError(parsed.error));
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const savedWord = await createWord(dictionary.id, parsed.data, setIds);
      onSaved(savedWord);
      toast.success(`Dodano „${enrichment.word}” do słownika`);
      onClose();
    } catch (error) {
      if (error instanceof DuplicateWordError || error instanceof ValidationError) {
        setFormError(error.message);
      } else {
        console.error(error);
        setFormError("Nie udało się zapisać słowa.");
      }
    } finally {
      setSaving(false);
    }
  }

  const targetLanguage = LANGUAGES[dictionary.targetLanguage].name;
  const translationError = enrichment.translation.error;
  const examplesError = enrichment.examplesError;
  const failedProvider = enrichment.translation.provider
    ? providerLabel(enrichment.translation.provider)
    : null;
  const showCancelPrompt =
    Boolean(translationError) && !manualTranslation && !translation.trim();

  return (
    <>
      <DialogHeader>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 w-fit text-muted-foreground"
        >
          <ArrowLeft />
          Zmień słowo
        </Button>
        {!dictionary.isNative ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onChangeInputLanguage}
            className="-ml-2 w-fit text-muted-foreground"
          >
            Zmień język wpisywania
          </Button>
        ) : null}
        <DialogTitle>Sprawdź i zapisz</DialogTitle>
        <DialogDescription>
          Popraw tłumaczenie, wybierz jedno z przykładowych zdań albo zapisz
          słowo w słowniku „{dictionary.name}”.
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-border/80 bg-muted/45 px-4 py-3.5">
        <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Nowe słowo
        </p>
        <p className="mt-1 font-display text-3xl leading-tight font-medium tracking-[-0.025em]">
          {enrichment.word}
        </p>
        {enrichment.articleApplied ? (
          <p className="mt-1 text-xs text-muted-foreground">Dodano rodzajnik „{enrichment.word.split(" ")[0]}” z Wikisłownika.</p>
        ) : null}
      </div>

      <form onSubmit={handleSave} className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="word-translation">
            {dictionary.isNative ? "Definicja po polsku" : `Tłumaczenie na ${targetLanguage}`}{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Textarea
            id="word-translation"
            value={translation}
            onChange={(event) => {
              setTranslation(event.target.value);
              setFormError(null);
            }}
            rows={2}
            placeholder={
              dictionary.isNative
                ? "Popraw definicję lub wpisz ją ręcznie"
                : "Wpisz polskie tłumaczenie"
            }
            className="min-h-16"
          />
              {translation && !translationError ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
                  {enrichment.reverseLookup
                    ? "Polskie znaczenie wpisane przez Ciebie"
                    : dictionary.isNative
                ? enrichment.translation.provider === "wiktionary" ? "Definicje z polskiego Wikisłownika" : "Definicja wpisana ręcznie"
                : `Tłumaczenie automatyczne · ${providerLabel(enrichment.translation.provider)}`}
            </p>
          ) : null}
          {translationError ? (
            <div
              role="alert"
              className="mt-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {failedProvider
                      ? `${failedProvider} nie zwrócił tłumaczenia.`
                      : "Nie udało się pobrać tłumaczenia."}
                  </p>
                  <p>{translationError.message}</p>
                  {showCancelPrompt ? (
                    <p>
                      Czy chcesz anulować dodanie tego słowa, czy wpisać
                      tłumaczenie ręcznie?
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-2.5 ml-5 flex flex-wrap items-center gap-2">
                {showCancelPrompt ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setManualTranslation(true)}
                    >
                      Wpiszę ręcznie
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onClose}
                    >
                      Anuluj dodawanie
                    </Button>
                  </>
                ) : null}
                {!retrying ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="underline decoration-amber-700/30 underline-offset-2 hover:no-underline dark:decoration-amber-300/30"
                  >
                    Spróbuj ponownie
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <section className="grid gap-2.5" aria-labelledby="examples-heading">
          <Label id="examples-heading">Przykład zdania</Label>

          {examples.length > 0 ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wybierz przykładowe zdanie. Treści przykładu nie można zmieniać.
              </p>
              <div className="grid gap-2">
                {examples.map((example) => (
                  <ExampleCard
                    key={example.id}
                    active={
                      selection.kind === "example" && selection.id === example.id
                    }
                    sentence={example.text}
                    translation={example.translation}
                    onSelect={() => selectExample(example)}
                  />
                ))}
              </div>
              {examplesLoading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Szukam kolejnych przykładów…
                </p>
              ) : null}
            </>
          ) : examplesLoading ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Możesz zapisać teraz. Dodamy przykład automatycznie, gdy go znajdziemy.</span>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              {examplesError
                ? `${examplesError.message} Możesz zapisać słowo bez przykładu.`
                : "Brak przykładowego zdania. Możesz zapisać słowo bez przykładu."}
              {examplesError && !retrying ? (
                <button
                  type="button"
                  onClick={onRetryExamples}
                  className="ml-1 underline decoration-border underline-offset-2 hover:text-foreground"
                >
                  Spróbuj ponownie
                </button>
              ) : null}
            </div>
          )}

          {selection.kind !== "none" ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="text-muted-foreground"
              >
                Bez przykładu
              </Button>
            </div>
          ) : null}
        </section>

        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        {retrying ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Ponawiam wyszukiwanie…
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Anuluj
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={saving || retrying}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Zapisz słowo
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
