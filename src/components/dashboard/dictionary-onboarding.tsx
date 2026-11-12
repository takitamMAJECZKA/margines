"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createInitialDictionaries } from "@/db/dictionaries";
import { completeOnboarding } from "@/db/seed";
import type { Dictionary } from "@/db/types";
import type { LanguageCode } from "@/lib/languages";
import { cn, pluralizePolish } from "@/lib/utils";

const OPTIONS: Array<{
  code: LanguageCode;
  name: string;
  label: string;
  description: string;
  native?: boolean;
}> = [
  {
    code: "pl",
    name: "Polski",
    label: "Słownik ojczysty",
    description:
      "Jednojęzyczny słownik z definicjami z polskiego Wikisłownika. Bez tłumaczenia.",
    native: true,
  },
  {
    code: "es",
    name: "Hiszpański",
    label: "Hiszpański → polski",
    description:
      "Tłumaczenie na polski, przykładowe zdanie i rodzajnik dla rzeczowników.",
  },
  {
    code: "en",
    name: "Angielski",
    label: "Angielski → polski",
    description:
      "Tłumaczenie na polski, przykładowe zdanie i rodzajnik a/an dla rzeczowników.",
  },
  {
    code: "de",
    name: "Niemiecki",
    label: "Niemiecki → polski",
    description:
      "Tłumaczenie na polski, przykładowe zdanie i rodzajnik der/die/das dla rzeczowników.",
  },
  {
    code: "fr",
    name: "Francuski",
    label: "Francuski → polski",
    description:
      "Tłumaczenie na polski, przykładowe zdanie i rodzajnik dla rzeczowników.",
  },
];

interface DictionaryOnboardingProps {
  onComplete: (dictionary: Dictionary | null) => void;
}

export function DictionaryOnboarding({
  onComplete,
}: DictionaryOnboardingProps) {
  const [selected, setSelected] = useState<LanguageCode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: LanguageCode) {
    setSelected((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
    setError(null);
  }

  async function handleCreate() {
    if (submitting || skipping) return;

    const languages = OPTIONS.map((option) => option.code).filter((code) =>
      selected.includes(code),
    );

    if (languages.length === 0) {
      setError("Wybierz co najmniej jeden język.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createInitialDictionaries(languages);
      await completeOnboarding();

      toast.success(
        created.length === 1
          ? `Utworzono słownik „${created[0].name}”`
          : `Utworzono ${created.length} ${pluralizePolish(
              created.length,
              "słownik",
              "słowniki",
              "słowników",
            )}`,
      );
      onComplete(created[0] ?? null);
    } catch (cause) {
      console.error(cause);
      setError("Nie udało się utworzyć słowników. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (submitting || skipping) return;

    setSkipping(true);
    setError(null);

    try {
      await completeOnboarding();
      onComplete(null);
    } catch (cause) {
      console.error(cause);
      setError("Nie udało się rozpocząć pracy ze słownikami.");
    } finally {
      setSkipping(false);
    }
  }

  const busy = submitting || skipping;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-9 sm:px-6 sm:py-14">
      <div className="max-w-xl">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Pierwsze uruchomienie
        </p>
        <h1 className="mt-3 font-display text-[2.4rem] leading-[1.03] font-medium tracking-[-0.035em] sm:text-5xl">
          Wybierz swoje słowniki
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Zaznacz języki, których chcesz się uczyć. Polski jest słownikiem
          ojczystym i korzysta z jednojęzycznych definicji. Kolejne słowniki
          możesz dodać później.
        </p>
      </div>

      <div
        role="group"
        aria-label="Słowniki do utworzenia"
        className="mt-7 grid gap-2.5 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const active = selected.includes(option.code);

          return (
            <button
              key={option.code}
              type="button"
              onClick={() => toggle(option.code)}
              aria-pressed={active}
              disabled={busy}
              className={cn(
                "group grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-70",
                active
                  ? "border-primary/45 bg-primary/[0.055] shadow-sm"
                  : "border-border bg-card/55 hover:border-primary/25 hover:bg-card",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl border transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                <BookOpen className="size-[18px]" />
              </span>

              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-display text-xl leading-tight font-medium tracking-[-0.02em]">
                    {option.name}
                  </span>
                  {option.native ? (
                    <span className="rounded-full border border-primary/20 bg-primary/[0.07] px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-primary uppercase">
                      Ojczysty
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground/90">
                  {option.label}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-transparent",
                )}
              >
                <Check className="size-3" />
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => void handleSkip()}
          disabled={busy}
          className="rounded-lg px-1 py-2 text-left text-xs text-muted-foreground underline decoration-border underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
        >
          Pomiń na razie
        </button>
        <Button
          type="button"
          size="lg"
          onClick={() => void handleCreate()}
          disabled={busy || selected.length === 0}
          className="w-full sm:w-auto"
        >
          {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
          {selected.length > 1 ? "Utwórz słowniki" : "Utwórz słownik"}
        </Button>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground/80">
        Wszystkie słowa zapisują się wyłącznie na tym urządzeniu. Do tłumaczeń,
        przykładów i rodzajników aplikacja używa internetu.
      </p>
    </main>
  );
}
