# Baza danych i migracje

Margines przechowuje dane wyłącznie w przeglądarce użytkownika, w bazie
IndexedDB o nazwie `margines`, za pośrednictwem biblioteki
[Dexie](https://dexie.org/). Nie ma backendu ani kont użytkowników.

## Tabele

### `dictionaries`

| Pole             | Typ            | Indeks | Opis                                            |
| ---------------- | -------------- | ------ | ----------------------------------------------- |
| `id`             | `string`       | PK     | UUID lub stały identyfikator słownika domyślnego |
| `name`           | `string`       | ✓      | Nazwa widoczna w zakładkach                     |
| `sourceLanguage` | `LanguageCode` | ✓      | Język źródłowy (`es`, `en`, `pl`)               |
| `targetLanguage` | `LanguageCode` |        | Język docelowy (obecnie zawsze `pl`)            |
| `isNative`       | `boolean`      |        | Słownik ojczysty — bez automatycznych zapytań   |
| `color`          | `DictionaryColor` |     | Kolor akcentu zakładki i nagłówka               |
| `createdAt`      | `number`       | ✓      | Znacznik czasu (ms)                             |
| `updatedAt`      | `number`       |        | Znacznik czasu (ms)                             |

### `words`

| Pole                 | Typ           | Indeks                              | Opis                                      |
| -------------------- | ------------- | ----------------------------------- | ----------------------------------------- |
| `id`                 | `string`      | PK                                  | UUID                                      |
| `dictionaryId`       | `string`      | ✓, złożony z `normalizedWord`       | Słownik, do którego należy słowo          |
| `originalWord`       | `string`      |                                     | Słowo w języku źródłowym                  |
| `normalizedWord`     | `string`      | złożony z `dictionaryId`            | Klucz duplikatów (lowercase, NFC, trim)   |
| `translation`        | `string`      |                                     | Tłumaczenie polskie                       |
| `exampleSentence`    | `string`      |                                     | Przykład lub pusty ciąg                   |
| `exampleTranslation` | `string`      |                                     | Tłumaczenie przykładu                     |
| `exampleSource`      | `string`      |                                     | `Tatoeba`, `AI` lub pusty                 |
| `exampleSourceUrl`   | `string`      |                                     | Link do zdania w Tatoeba                  |
| `exampleAttribution` | `string`      |                                     | Autor i licencja zdania                   |
| `exampleType`        | `authentic` \| `ai` \| `manual` |            | Sposób pochodzenia przykładu              |
| `reviewCount`        | `number`      |                                     | Łączna liczba odpowiedzi w fiszkach       |
| `lastReviewedAt`     | `number` \| `null` |                               | Ostatnia odpowiedź                        |
| `lastReviewKnown`    | `boolean` \| `null` |                              | Czy ostatnia odpowiedź to „Znam”          |
| `createdAt`          | `number`      | ✓, złożony z `dictionaryId`         | Data dodania                              |
| `updatedAt`          | `number`      |                                     | Data ostatniej edycji                     |

Złożony indeks `[dictionaryId+normalizedWord]` jest unikalny na poziomie
logiki aplikacji i zapewnia szybkie wykrywanie duplikatów. Wyścig między
sprawdzeniem a zapisem jest dodatkowo obsługiwany przez `ConstraintError`.

### `sets`

Zestawy tworzone przez użytkownika w obrębie słownika. Wirtualny zestaw
„Wszystkie” nie jest zapisywany — to widok całej tabeli `words`.

| Pole           | Typ      | Indeks                              | Opis                    |
| -------------- | -------- | ----------------------------------- | ----------------------- |
| `id`           | `string` | PK                                  | UUID                    |
| `dictionaryId` | `string` | ✓, złożony z `createdAt`            | Słownik właściciela     |
| `name`         | `string` |                                     | Nazwa zestawu           |
| `createdAt`    | `number` | ✓, złożony z `dictionaryId`         | Data utworzenia         |
| `updatedAt`    | `number` |                                     | Data zmiany nazwy       |

### `setWords`

Wiele-do-wielu: przypisanie słowa do zestawu. `id` jest deterministyczne
(`setId:wordId`), więc to samo słowo nie trafi do zestawu dwa razy.

| Pole           | Typ      | Indeks                              | Opis                    |
| -------------- | -------- | ----------------------------------- | ----------------------- |
| `id`           | `string` | PK                                  | `setId:wordId`          |
| `setId`        | `string` | ✓                                   | Zestaw                  |
| `wordId`       | `string` | ✓                                   | Słowo                   |
| `dictionaryId` | `string` | ✓                                   | Ułatwia kaskadowe czyszczenie |
| `createdAt`    | `number` | ✓, złożony z `setId`                | Data przypisania        |

Usunięcie słowa, zestawu lub słownika czyści powiązane wpisy `setWords`
w tej samej transakcji. Usunięcie zestawu nie usuwa samych słów.

### `lookups`

Lokalny cache wyników `/api/enrich` (tłumaczenie + przykłady).

| Pole           | Typ             | Indeks | Opis                          |
| -------------- | --------------- | ------ | ----------------------------- |
| `key`          | `string`        | PK     | `język:źródło:cel:normalized` |
| `dictionaryId` | `string`        |        | Słownik, z którego wykonano zapytanie |
| `payload`      | `EnrichResponse`|        | Zapisana odpowiedź API        |
| `createdAt`    | `number`        | ✓      | Data wpisu; TTL 24 h          |

### `meta`

Proste pary klucz–wartość. Między innymi:

- `defaults-seeded-at` — znacznik jednorazowego seedu słowników domyślnych,
- `dictionary-used:<id>` — ostatnie użycie słownika.

## Wersje schematu

Schemat jest wersjonowany w `src/db/index.ts`.

### v1 — pierwsza wersja

```ts
dictionaries: "id, name, sourceLanguage, createdAt",
words: "id, dictionaryId, createdAt",
meta: "key",
```

### v2 — indeksy i cache

Dodaje:

- złożone indeksy `[dictionaryId+normalizedWord]` i
  `[dictionaryId+createdAt]` (szybsze wyszukiwanie i sortowanie),
- tabelę `lookups` z indeksem `createdAt`,
- migrację istniejących słów: uzupełnienie `normalizedWord`, `exampleType`,
  pól źródła przykładu oraz metadanych powtórek.

Migracja używa `transaction.table<Word>("words").toCollection().modify(...)`,
więc działa na wszystkich istniejących rekordach bez ich usuwania.

### v3 — zestawy słów (obecna wersja)

```ts
sets: "id, dictionaryId, [dictionaryId+createdAt], createdAt",
setWords: "id, setId, wordId, dictionaryId, [setId+createdAt]",
```

Dodaje tabele `sets` i `setWords`. Nie ma migracji danych — istniejące słowniki
i słowa działają bez zmian, a zestawy tworzy użytkownik. Schemat v3 powtarza
pełne definicje wszystkich tabel z v2.

### Dodawanie kolejnej wersji

1. Zwiększ numer w `this.version(N)`.
2. Powtórz pełną definicję `stores()` dla nowej wersji (Dexie nie scala
   deklaracji automatycznie).
3. Dodaj `.upgrade(...)` z bezpiecznym backfillem nowych pól.
4. Zaktualizuj typy w `src/db/types.ts` i ten dokument.
5. Przetestuj migrację na kopii bazy w DevTools → Application → IndexedDB.

Dane w IndexedDB są przypisane do originu. Zmiana domeny lub trybu
prywatnego oznacza osobną, pustą bazę.

## Resetowanie danych

W przeglądarce: DevTools → Application → Storage → IndexedDB → `margines` →
Delete database. Przy następnym otwarciu aplikacja ponownie utworzy słowniki
domyślne (Hiszpański i Angielski).
