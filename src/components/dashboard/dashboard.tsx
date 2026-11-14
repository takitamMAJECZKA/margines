"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  ArrowLeft,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listDictionaries, reorderDictionaries } from "@/db/dictionaries";
import { isOnboardingComplete } from "@/db/seed";
import { listSetIdsForWord, listSetMemberships, listSets } from "@/db/sets";
import type { Dictionary, SetWord, Word, WordSet } from "@/db/types";
import { deleteWord, listWords, restoreWord } from "@/db/words";
import { useDatabaseReady } from "@/hooks/use-database-ready";
import { useDictionarySelection } from "@/hooks/use-dictionary-selection";
import {
  DICTIONARY_COLOR_HEX,
  languagePairLabel,
} from "@/lib/languages";
import type { ForeignLanguageCode } from "@/lib/languages";
import { foldForSearch, wordCountLabel } from "@/lib/utils";

import { AddWordDialog } from "./add-word-dialog";
import { AssignWordsDialog } from "./assign-words-dialog";
import { CreateDictionaryDialog } from "./create-dictionary-dialog";
import { DashboardFooter } from "./dashboard-footer";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { DeleteDictionaryDialog } from "./delete-dictionary-dialog";
import { DeleteSetDialog } from "./delete-set-dialog";
import { DeleteWordDialog } from "./delete-word-dialog";
import { DictionaryOnboarding } from "./dictionary-onboarding";
import { DictionaryTabs } from "./dictionary-tabs";
import { EditWordDialog } from "./edit-word-dialog";
import {
  EmptyDictionary,
  EmptySet,
  NoDictionaries,
  NoSearchResults,
} from "./empty-states";
import { RenameDictionaryDialog } from "./rename-dictionary-dialog";
import { SearchInput } from "./search-input";
import { SetFormDialog } from "./set-form-dialog";
import { StudyBanner } from "./study-banner";
import { VocabularyItem } from "./vocabulary-item";
import { WordSetTiles } from "./word-set-tiles";

export function Dashboard() {
  const { ready, error: databaseError } = useDatabaseReady();
  const dictionaries = useLiveQuery(() => listDictionaries(), []);
  const onboardingComplete = useLiveQuery(() => isOnboardingComplete(), []);
  const { selected, select, selectedId } = useDictionarySelection(dictionaries);

  const allWords = useLiveQuery(
    () => (selected ? listWords(selected.id) : Promise.resolve([] as Word[])),
    [selected?.id],
  );

  const sets = useLiveQuery(
    () => (selected ? listSets(selected.id) : Promise.resolve([] as WordSet[])),
    [selected?.id],
  );

  const memberships = useLiveQuery(
    () =>
      selected
        ? listSetMemberships(selected.id)
        : Promise.resolve([] as SetWord[]),
    [selected?.id],
  );

  // Set selection and search are tied to the dictionary/scope, so switching
  // them starts fresh without an effect that would trigger a second render.
  const [setState, setSetState] = useState<{
    dictionaryId: string | null;
    setId: string | null;
  }>({ dictionaryId: null, setId: null });
  const activeSetId = setState.dictionaryId === selectedId ? setState.setId : null;

  function selectSet(setId: string | null) {
    setSetState({ dictionaryId: selectedId, setId });
  }

  const activeSet = useMemo(
    () => (activeSetId ? (sets?.find((set) => set.id === activeSetId) ?? null) : null),
    [activeSetId, sets],
  );

  const scopeKey = `${selectedId ?? ""}:${activeSetId ?? "all"}`;
  const [searchState, setSearchState] = useState<{ scopeKey: string; value: string }>(
    { scopeKey: "", value: "" },
  );
  const search = searchState.scopeKey === scopeKey ? searchState.value : "";

  function updateSearch(value: string) {
    setSearchState({ scopeKey, value });
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteDictionaryOpen, setDeleteDictionaryOpen] = useState(false);
  const [addWordRequest, setAddWordRequest] = useState<{ initialWord: string } | null>(
    null,
  );
  const [setFormOpen, setSetFormOpen] = useState(false);
  const [assignWordsOpen, setAssignWordsOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<WordSet | null>(null);
  const [deletingSet, setDeletingSet] = useState<WordSet | null>(null);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [deletingWord, setDeletingWord] = useState<Word | null>(null);

  const setCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const membership of memberships ?? []) {
      counts[membership.setId] = (counts[membership.setId] ?? 0) + 1;
    }
    return counts;
  }, [memberships]);

  const words = useMemo(() => {
    if (!allWords) return [];

    if (!activeSet) return allWords;

    const ids = new Set(
      (memberships ?? [])
        .filter((membership) => membership.setId === activeSet.id)
        .map((membership) => membership.wordId),
    );

    return allWords.filter((word) => ids.has(word.id));
  }, [allWords, activeSet, memberships]);

  const normalizedSearch = foldForSearch(search.trim());

  const filteredWords = useMemo(() => {
    if (!normalizedSearch) return words;

    return words.filter((word) =>
      [
        word.originalWord,
        word.translation,
        word.exampleSentence,
        word.exampleTranslation,
      ].some((value) => foldForSearch(value).includes(normalizedSearch)),
    );
  }, [words, normalizedSearch]);

  if (
    !ready ||
    dictionaries === undefined ||
    allWords === undefined ||
    sets === undefined ||
    memberships === undefined
  ) {
    return <DashboardSkeleton />;
  }

  function handleCreatedDictionary(dictionary: Dictionary) {
    select(dictionary.id);
  }

  function handleDeletedDictionary(id: string) {
    const remaining = dictionaries?.filter((dictionary) => dictionary.id !== id) ?? [];
    if (remaining[0]) select(remaining[0].id);
  }

  function openAddWord(initialWord = "") {
    setAddWordRequest({ initialWord });
  }

  async function restoreDeletedWord(item: Word, setIds: string[]) {
    try {
      await restoreWord(item, setIds);
      toast.success(`Przywrócono „${item.originalWord}”`);
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się cofnąć usunięcia.");
    }
  }

  async function handleSwipeDelete(item: Word) {
    try {
      // Capture memberships before the cascade removes them, so undo can put
      // the word back into the same sets.
      const setIds = await listSetIdsForWord(item.id);
      await deleteWord(item.id);

      toast(`Usunięto „${item.originalWord}”`, {
        description: "Czy chcesz cofnąć zmianę?",
        duration: 8000,
        action: {
          label: "Cofnij",
          onClick: () => {
            void restoreDeletedWord(item, setIds);
          },
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Nie udało się usunąć słowa.");
    }
  }

  const editingSetIds = editingWord
    ? memberships
        .filter((membership) => membership.wordId === editingWord.id)
        .map((membership) => membership.setId)
    : [];

  const activeSetWordIds = activeSet
    ? memberships
        .filter((membership) => membership.setId === activeSet.id)
        .map((membership) => membership.wordId)
    : [];

  const totalWordCount = allWords.length;
  const scopedWordCount = words.length;

  if (!ready || dictionaries === undefined || onboardingComplete === undefined) {
    return <DashboardSkeleton />;
  }

  if (dictionaries.length === 0 && !onboardingComplete && !databaseError) {
    return (
      <DictionaryOnboarding
        onComplete={(dictionary) => {
          if (dictionary) select(dictionary.id);
        }}
      />
    );
  }

  return (
    <>
      <DictionaryTabs
        dictionaries={dictionaries}
        selectedId={selectedId}
        onSelect={select}
        onCreate={() => setCreateOpen(true)}
        onReorder={(ids) => {
          void reorderDictionaries(ids).catch((error) => {
            console.error(error);
            toast.error("Nie udało się zmienić kolejności słowników.");
          });
        }}
      />

      {databaseError ? (
        <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.06] p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <h1 className="font-display text-xl font-medium">
                  Baza danych jest niedostępna
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {databaseError} Spróbuj odświeżyć stronę. Jeśli przeglądarka
                  blokuje pamięć lokalną, wyłącz tryb prywatny.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Odśwież stronę
                </Button>
              </div>
            </div>
          </div>
        </main>
      ) : !selected ? (
        <NoDictionaries onCreate={() => setCreateOpen(true)} />
      ) : (
        <main className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <section className="pt-8 sm:pt-12">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: DICTIONARY_COLOR_HEX[selected.color],
                    }}
                  />
                  <span>
                    {languagePairLabel(
                      selected.sourceLanguage,
                      selected.targetLanguage,
                      selected.isNative,
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{wordCountLabel(totalWordCount)}</span>
                </p>
                <h1 className="mt-2.5 font-display text-[2.55rem] leading-[1.02] font-medium tracking-[-0.035em] break-words sm:text-5xl">
                  {selected.name}
                </h1>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Zarządzaj słownikiem"
                    title="Zarządzaj słownikiem"
                    className="mt-1 shrink-0 text-muted-foreground"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                    <Pencil />
                    Zmień nazwę
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingSet(null);
                      setSetFormOpen(true);
                    }}
                  >
                    <FolderOpen />
                    Nowy zestaw
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteDictionaryOpen(true)}
                  >
                    <Trash2 />
                    Usuń słownik
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-[1fr_auto]">
              <SearchInput value={search} onChange={updateSearch} />
              <Button
                type="button"
                size="lg"
                onClick={() =>
                  openAddWord(
                    filteredWords.length === 0 ? search.trim() : "",
                  )
                }
                className="w-full sm:w-auto"
              >
                <Plus />
                Dodaj słowo
              </Button>
            </div>

            {activeSet ? (
              <section
                aria-labelledby="active-set-heading"
                className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.045] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => selectSet(null)}
                      className="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      Wszystkie zestawy
                    </button>
                    <div className="mt-2 flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <FolderOpen className="size-[18px]" aria-hidden="true" />
                      </span>
                      <h2
                        id="active-set-heading"
                        className="min-w-0 truncate font-display text-2xl font-medium tracking-[-0.02em]"
                      >
                        {activeSet.name}
                      </h2>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {wordCountLabel(scopedWordCount)} · nowe słowa trafią od razu
                      do tego zestawu
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Zarządzaj zestawem ${activeSet.name}`}
                        className="shrink-0 text-muted-foreground"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditingSet(activeSet);
                          setSetFormOpen(true);
                        }}
                      >
                        <Pencil />
                        Zmień nazwę zestawu
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeletingSet(activeSet)}
                      >
                        <Trash2 />
                        Usuń zestaw
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </section>
            ) : (
              <section className="mt-7" aria-labelledby="sets-heading">
                <div className="mb-3">
                  <h2
                    id="sets-heading"
                    className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
                  >
                    Zestawy
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Grupuj słowa według rozdziałów lub tematów i ucz się tylko z
                    wybranego zestawu.
                  </p>
                </div>
                <WordSetTiles
                  sets={sets}
                  counts={setCounts}
                  totalCount={totalWordCount}
                  activeSetId={activeSetId}
                  onSelect={selectSet}
                  onCreate={() => {
                    setEditingSet(null);
                    setSetFormOpen(true);
                  }}
                  onRename={(wordSet) => {
                    setEditingSet(wordSet);
                    setSetFormOpen(true);
                  }}
                  onDelete={setDeletingSet}
                />
              </section>
            )}

            <StudyBanner
              count={scopedWordCount}
              wordSet={activeSet}
              dictionary={selected}
            />
          </section>

          <section className="mt-9">
            {scopedWordCount === 0 ? (
              activeSet ? (
                <EmptySet
                  setName={activeSet.name}
                  onAdd={() => openAddWord(search.trim())}
                  onAssign={() => setAssignWordsOpen(true)}
                />
              ) : (
                <EmptyDictionary
                  dictionaryName={selected.name}
                  onAdd={() => openAddWord()}
                />
              )
            ) : filteredWords.length === 0 ? (
              <NoSearchResults
                query={search.trim()}
                onClear={() => updateSearch("")}
                onAdd={() => openAddWord(search.trim())}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <h2 className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    {normalizedSearch
                      ? `Wyniki · ${filteredWords.length}`
                      : activeSet
                        ? "Słowa w zestawie"
                        : "Ostatnio dodane"}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {filteredWords.length}{" "}
                    {filteredWords.length === 1 ? "słowo" : "słów"}
                  </span>
                </div>
                <ul aria-label="Zapisane słowa">
                  {filteredWords.map((word) => (
                    <VocabularyItem
                      key={word.id}
                      word={word}
                      onEdit={setEditingWord}
                      onDelete={setDeletingWord}
                      onSwipeDelete={handleSwipeDelete}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>

          <DashboardFooter />
        </main>
      )}

      <CreateDictionaryDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        dictionaries={dictionaries}
        onCreated={handleCreatedDictionary}
      />

      {selected ? (
        <>
          {activeSet ? (
            <AssignWordsDialog
              key={`assign-words-${activeSet.id}-${assignWordsOpen ? "open" : "closed"}`}
              open={assignWordsOpen}
              onOpenChange={setAssignWordsOpen}
              dictionary={selected}
              wordSet={activeSet}
              words={allWords}
              assignedWordIds={activeSetWordIds}
            />
          ) : null}
          <RenameDictionaryDialog
            key={`rename-${selected.id}-${renameOpen ? "open" : "closed"}`}
            open={renameOpen}
            onOpenChange={setRenameOpen}
            dictionary={selected}
            onRenamed={() => undefined}
          />
          <DeleteDictionaryDialog
            key={`delete-${selected.id}-${deleteDictionaryOpen ? "open" : "closed"}`}
            open={deleteDictionaryOpen}
            onOpenChange={setDeleteDictionaryOpen}
            dictionary={selected}
            wordCount={totalWordCount}
            onDeleted={handleDeletedDictionary}
          />
          <AddWordDialog
            key={`add-${selected.id}-${activeSet?.id ?? "all"}-${
              addWordRequest?.initialWord ?? ""
            }-${addWordRequest ? "open" : "closed"}`}
            open={Boolean(addWordRequest)}
            onOpenChange={(open) => {
              if (!open) setAddWordRequest(null);
            }}
            dictionary={selected}
            initialWord={addWordRequest?.initialWord ?? ""}
            setIds={activeSet ? [activeSet.id] : []}
            onAdded={() => updateSearch("")}
          />
          <SetFormDialog
            key={`set-form-${editingSet?.id ?? "new"}-${
              setFormOpen ? "open" : "closed"
            }`}
            open={setFormOpen}
            onOpenChange={setSetFormOpen}
            dictionary={selected}
            wordSet={editingSet}
            onSaved={(saved) => {
              if (!editingSet) selectSet(saved.id);
            }}
          />
          <DeleteSetDialog
            key={`delete-set-${deletingSet?.id ?? "none"}-${
              deletingSet ? "open" : "closed"
            }`}
            open={Boolean(deletingSet)}
            onOpenChange={(open) => {
              if (!open) setDeletingSet(null);
            }}
            wordSet={deletingSet}
            wordCount={deletingSet ? (setCounts[deletingSet.id] ?? 0) : 0}
            onDeleted={(id) => {
              if (activeSetId === id) selectSet(null);
            }}
          />
        </>
      ) : null}

      <EditWordDialog
        key={`edit-word-${editingWord?.id ?? "none"}-${editingWord ? "open" : "closed"}`}
        open={Boolean(editingWord)}
        onOpenChange={(open) => {
          if (!open) setEditingWord(null);
        }}
        word={editingWord}
        sets={sets}
        initialSetIds={editingSetIds}
        sourceLanguage={
          selected && !selected.isNative
            ? (selected.sourceLanguage as ForeignLanguageCode)
            : null
        }
      />

      <DeleteWordDialog
        key={`delete-word-${deletingWord?.id ?? "none"}-${deletingWord ? "open" : "closed"}`}
        open={Boolean(deletingWord)}
        onOpenChange={(open) => {
          if (!open) setDeletingWord(null);
        }}
        word={deletingWord}
      />
    </>
  );
}
