import { BookOpen, FolderOpen, Plus, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmptyDictionary({
  dictionaryName,
  onAdd,
}: {
  dictionaryName: string;
  onAdd: () => void;
}) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/35 px-6 py-14 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card">
        <BookOpen className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium tracking-tight">
        Pusty margines
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Słownik „{dictionaryName}” nie ma jeszcze słów. Dodaj pierwsze słowo
        zapisane podczas czytania.
      </p>
      <Button onClick={onAdd} className="mt-6">
        <Plus />
        Dodaj pierwsze słowo
      </Button>
    </div>
  );
}

export function NoDictionaries({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card">
        <BookOpen className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-medium tracking-tight">
        Zacznij od słownika
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Wybierz język słownika. Słowa zostaną zapisane tylko na tym urządzeniu.
      </p>
      <Button onClick={onCreate} className="mt-7">
        <Plus />
        Utwórz słownik
      </Button>
    </div>
  );
}

export function EmptySet({
  setName,
  onAdd,
  onShowAll,
}: {
  setName: string;
  onAdd: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-border bg-card/35 px-6 py-12 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card">
        <FolderOpen className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium tracking-tight">
        Pusty zestaw
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Zestaw „{setName}” nie ma jeszcze słów. Dodaj nowe słowo albo przypisz
        istniejące słowa w oknie edycji.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onShowAll}>
          Wszystkie zestawy
        </Button>
        <Button onClick={onAdd}>
          <Plus />
          Dodaj słowo
        </Button>
      </div>
    </div>
  );
}

export function NoSearchResults({
  query,
  onClear,
  onAdd,
}: {
  query: string;
  onClear: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-xl font-medium">
        Brak wyników dla „{query}”
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Sprawdź pisownię lub dodaj to słowo do słownika.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onClear}>
          Wyczyść szukanie
        </Button>
        <Button onClick={onAdd}>
          <Plus />
          Dodaj słowo
        </Button>
      </div>
    </div>
  );
}
