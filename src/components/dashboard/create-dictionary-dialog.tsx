"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { createDictionary } from "@/db/dictionaries";
import { DuplicateDictionaryNameError, ValidationError } from "@/db/errors";
import type { Dictionary } from "@/db/types";
import {
  DICTIONARY_COLORS,
  DICTIONARY_COLOR_HEX,
  DICTIONARY_COLOR_LABELS,
  type DictionaryColor,
} from "@/lib/languages";
import { cn, normalizeWord } from "@/lib/utils";
import { dictionaryFormSchema } from "@/lib/validation";

const DICTIONARY_TYPES = [
  {
    value: "es-pl",
    label: "Hiszpański → polski",
    baseName: "Hiszpański",
    sourceLanguage: "es",
    targetLanguage: "pl",
    isNative: false,
    defaultColor: "amber",
    description: "Automatyczne tłumaczenie i przykładowe zdania.",
  },
  {
    value: "en-pl",
    label: "Angielski → polski",
    baseName: "Angielski",
    sourceLanguage: "en",
    targetLanguage: "pl",
    isNative: false,
    defaultColor: "sky",
    description: "Automatyczne tłumaczenie i przykładowe zdania.",
  },
  {
    value: "de-pl",
    label: "Niemiecki → polski",
    baseName: "Niemiecki",
    sourceLanguage: "de",
    targetLanguage: "pl",
    isNative: false,
    defaultColor: "violet",
    description: "Automatyczne tłumaczenie i przykładowe zdania.",
  },
  {
    value: "fr-pl",
    label: "Francuski → polski",
    baseName: "Francuski",
    sourceLanguage: "fr",
    targetLanguage: "pl",
    isNative: false,
    defaultColor: "stone",
    description: "Automatyczne tłumaczenie i przykładowe zdania.",
  },
  {
    value: "pl-pl",
    label: "Polski (język ojczysty)",
    baseName: "Polski",
    sourceLanguage: "pl",
    targetLanguage: "pl",
    isNative: true,
    defaultColor: "emerald",
    description: "Podstawowe dodawanie słów i tłumaczeń — bez automatycznych zapytań.",
  },
] as const;

type DictionaryTypeValue = (typeof DICTIONARY_TYPES)[number]["value"];

function suggestName(baseName: string, dictionaries: Dictionary[]): string {
  const names = new Set(dictionaries.map((dictionary) => normalizeWord(dictionary.name)));
  if (!names.has(normalizeWord(baseName))) return baseName;

  let suffix = 2;
  while (names.has(normalizeWord(`${baseName} ${suffix}`))) suffix += 1;
  return `${baseName} ${suffix}`;
}

function suggestColor(
  preferred: DictionaryColor,
  dictionaries: Dictionary[],
): DictionaryColor {
  const used = new Set(dictionaries.map((dictionary) => dictionary.color));
  if (!used.has(preferred)) return preferred;
  return DICTIONARY_COLORS.find((color) => !used.has(color)) ?? preferred;
}

interface CreateDictionaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dictionaries: Dictionary[];
  onCreated: (dictionary: Dictionary) => void;
}

export function CreateDictionaryDialog({
  open,
  onOpenChange,
  dictionaries,
  onCreated,
}: CreateDictionaryDialogProps) {
  const availableTypes = DICTIONARY_TYPES.filter(
    (item) => !dictionaries.some((dictionary) => dictionary.sourceLanguage === item.sourceLanguage),
  );
  const initialType = availableTypes[0] ?? DICTIONARY_TYPES[0];
  const [name, setName] = useState(() =>
    suggestName(initialType.baseName, dictionaries),
  );
  const [type, setType] = useState<DictionaryTypeValue>(initialType.value);
  const [color, setColor] = useState<DictionaryColor>(() =>
    suggestColor(initialType.defaultColor, dictionaries),
  );
  const [colorTouched, setColorTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedType =
    availableTypes.find((item) => item.value === type) ?? availableTypes[0] ?? DICTIONARY_TYPES[0];
  const visibleName = nameTouched ? name : suggestName(selectedType.baseName, dictionaries);
  const visibleColor = colorTouched
    ? color
    : suggestColor(selectedType.defaultColor, dictionaries);

  function handleTypeChange(value: DictionaryTypeValue) {
    const nextType = availableTypes.find((item) => item.value === value);
    if (!nextType) return;

    setType(value);
    if (colorTouched) setColor(suggestColor(nextType.defaultColor, dictionaries));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (availableTypes.length === 0) {
      setError(
        availableTypes.length === 0
          ? "Masz już słowniki dla wszystkich dostępnych języków."
          : "Wybierz język z listy.",
      );
      return;
    }

    const parsed = dictionaryFormSchema.safeParse({
      name: visibleName,
      sourceLanguage: selectedType.sourceLanguage,
      targetLanguage: selectedType.targetLanguage,
      isNative: selectedType.isNative,
      color: visibleColor,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Sprawdź dane słownika.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const dictionary = await createDictionary(parsed.data);
      toast.success(`Utworzono słownik „${dictionary.name}”`);
      onCreated(dictionary);
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof DuplicateDictionaryNameError || cause instanceof ValidationError) {
        setError(cause.message);
      } else {
        console.error(cause);
        setError("Nie udało się utworzyć słownika.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy słownik</DialogTitle>
          <DialogDescription>
            Każdy słownik ma własną listę słów i osobny postęp nauki.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="dictionary-type">Rodzaj słownika</Label>
            <NativeSelect
              id="dictionary-type"
              value={selectedType.value}
              onChange={(event) =>
                handleTypeChange(event.target.value as DictionaryTypeValue)
              }
            >
              {availableTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
            {availableTypes.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Masz już słowniki dla wszystkich dostępnych języków.
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {selectedType.description}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dictionary-name">Nazwa</Label>
            <Input
              id="dictionary-name"
              value={visibleName}
              maxLength={40}
              autoFocus
              autoComplete="off"
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
                setError(null);
              }}
              placeholder="np. Hiszpański z powieści"
              aria-invalid={Boolean(error)}
            />
          </div>

          <fieldset className="grid gap-2.5">
            <legend className="text-sm font-medium">Kolor</legend>
            <div className="flex flex-wrap items-center gap-2.5">
              {DICTIONARY_COLORS.map((item) => {
                const active = item === visibleColor;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setColor(item);
                      setColorTouched(true);
                    }}
                    aria-label={DICTIONARY_COLOR_LABELS[item]}
                    aria-pressed={active}
                    title={DICTIONARY_COLOR_LABELS[item]}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      active
                        ? "scale-105 border-foreground/70"
                        : "border-transparent hover:scale-105",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-6 rounded-full"
                      style={{ backgroundColor: DICTIONARY_COLOR_HEX[item] }}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {selectedType.isNative ? (
            <p className="rounded-xl border border-border bg-muted/60 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Słownik ojczysty nie korzysta z automatycznego tłumaczenia ani
              przykładowych zdań. Słowa dodajesz ręcznie.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Anuluj
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || availableTypes.length === 0}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Utwórz słownik
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
