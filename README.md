# Margines

Osobisty, dwujęzyczny słownik do nauki słówek z książek. Aplikacja w stylu
PWA: działa w przeglądarce, instaluje się na iPhone'ie i przechowuje cały
słownik lokalnie na urządzeniu.

- **Języki:** hiszpański → polski, angielski → polski oraz ręczne słowniki
  ojczyste (polski).
- **Automatyzacja:** tłumaczenie DeepL lub LibreTranslate oraz przykładowe
  zdanie do podglądu.
- **Nauka:** fiszki z całego słownika lub wybranego zestawu, powtarzanie
  pominiętych słów, podsumowanie sesji.
- **Offline:** zapisane słówka i interfejs działają bez internetu.

---

## Funkcje

### Słowniki

- Dwa słowniki startowe: **Hiszpański** i **Angielski** (→ polski).
- Tworzenie własnych słowników: hiszpański, angielski lub polski ojczysty.
- Zmiana nazwy, koloru przy tworzeniu, usuwanie z potwierdzeniem.
- Poziome zakładki słowników, wybór zapamiętywany w `localStorage`.
- Słownik ojczysty nie wysyła zapytań do API — wszystko dodajesz ręcznie.

### Zestawy słów

- Kafelki zestawów na stronie głównej, obok wirtualnego zestawu **Wszystkie**.
- Tworzenie, zmiana nazwy i usuwanie zestawów w obrębie słownika.
- Nazwa „Wszystkie” jest zarezerwowana, a nazwy zestawów są unikalne w słowniku.
- Wejście w kafelek pokazuje tylko słowa z danego zestawu, w tym samym układzie
  co cała lista.
- Nowe słowo dodane w widoku zestawu trafia do niego automatycznie.
- Istniejące słowa przypisujesz do zestawów w oknie edycji słowa.
- Usunięcie zestawu usuwa tylko pogrupowanie — słowa zostają w słowniku.

### Dodawanie słów

- Wyszukiwanie po wpisaniu słowa: tłumaczenie + przykładowe zdanie.
- Gdy szukanie nie daje wyników, „Dodaj słowo” otwiera formularz z wpisaną
  frazą z wyszukiwania.
- Wykrywanie duplikatów w obrębie słownika (bez rozróżniania wielkości liter).
- Podgląd przed zapisem: można poprawić tłumaczenie i wybrać przykładowe
  zdanie albo zapisać słowo bez przykładu. Treść zdania jest tylko do odczytu.
- Przykłady są wyświetlane bez informacji o dostawcy źródła.
- Jeśli tłumaczenie się nie powiedzie, podgląd pyta, czy anulować dodawanie
  słowa, czy wpisać tłumaczenie ręcznie.
- Ponawianie wyszukiwania bez wychodzenia z podglądu.
- Cache wyników wyszukiwania w IndexedDB (24 h) i cache serwerowy.

### Lista słów

- Przesunięcie w lewo usuwa słowo i pokazuje toast z akcją „Cofnij”, która
  przywraca słowo wraz z przypisaniem do zestawów.
- Przesunięcie w prawo otwiera edycję słowa.
- Przyciski edycji i usuwania pozostają widoczne, więc gesty nie są jedynym
  sposobem na wykonanie tych akcji.

### Nauka

- Sesja fiszek z wybranego słownika albo zestawu, losowa kolejność.
- Wybór zakresu nauki: „Wszystkie słowa” lub konkretny zestaw. Link z kafelka
  zestawu otwiera naukę od razu w tym zakresie (`/study?set=…`).
- Przód karty: polskie tłumaczenie; po odsłonięciu: słowo w języku źródłowym
  i przykład.
- „Znam” zdejmuje kartę z kolejki, „Nie znam” przenosi ją na koniec.
- Gesty na telefonie i myszce: przesunięcie w lewo = „Nie znam”,
  w prawo = „Znam” — działa też bez odwracania karty. Przyciski i skróty
  klawiszowe nadal działają.
- Sesja kończy się, gdy wszystkie karty zostaną oznaczone jako znane.
- Postęp, licznik pozostałych kart, podsumowanie: liczba słów, odpowiedzi,
  skuteczność za pierwszym razem oraz lista słów wymagających powtórki.
- Ponowne uruchomienie sesji i zmiana zakresu nauki.
- Skróty klawiszowe na desktopie: `Spacja`/`Enter` odsłania, `1` = nie znam,
  `2` = znam.
- Lekkie metadane powtórek (`reviewCount`, `lastReviewedAt`,
  `lastReviewKnown`) przygotowują grunt pod przyszły SRS.

### Interfejs i dostępność

- Mobile-first, ciepła „papierowa” paleta z leśną zielenią.
- Tryb jasny, ciemny i systemowy (`next-themes`).
- Duże cele dotykowe, widoczne stany fokusu, semantyczne nagłówki, opisy
  `aria-*`, komunikaty błędów przez `role="alert"`.
- Delikatne animacje wejścia kart i przejść.
- Bezpieczne marginesy iPhone'a (`env(safe-area-inset-*)`).
- Polska lokalizacja całego interfejsu, w tym liczba mnoga („1 słowo”,
  „2 słowa”, „5 słów”).

### PWA i offline

- Manifest (`/manifest.webmanifest`): `standalone`, kolory motywu, ikony
  192/512, ikona maskable, skrót do nauki.
- Service worker (`public/sw.js`) cache'uje powłokę aplikacji, strony
  `/`, `/study`, `/offline`, ikony i hashowane pliki `/_next/static`.
- Nawigacja: network-first z fallbackiem do cache i strony offline.
- Statyczne assety: cache-first. Pozostałe zapytania same-origin:
  stale-while-revalidate z ograniczeniem rozmiaru cache.
- **`/api/*` i zapytania cross-origin nie są cache'owane** — tłumaczenia
  i przykłady wymagają internetu i nie mogą być serwowane jako nieaktualne.
- Service worker rejestruje się wyłącznie w buildzie produkcyjnym.
- `postbuild` generuje `public/sw-manifest.json` z listą plików `.next/static`.

---

## Stos technologiczny

| Warstwa        | Technologia                                              |
| -------------- | -------------------------------------------------------- |
| Framework      | Next.js 16.4.6 (App Router, Turbopack, Cache Components) |
| Język          | TypeScript (strict)                                       |
| UI             | React 19.3, Tailwind CSS 4.3, komponenty w stylu shadcn/ui |
| Ikony          | Lucide React                                              |
| Dane lokalne   | Dexie 4 + `dexie-react-hooks` (IndexedDB)                 |
| Zapytania      | TanStack Query 5                                          |
| Walidacja      | Zod 4                                                     |
| Motywy         | `next-themes`                                             |
| Powiadomienia  | Sonner                                                    |
| PWA            | własny manifest + service worker                          |
| Tłumaczenia    | DeepL API lub LibreTranslate (adaptery serwerowe)         |
| Przykłady      | zewnętrzny korpus zdań (adapter serwerowy)                 |

---

## Szybki start

Wymagania: Node.js 20.9+ (zalecane 22 LTS) i npm.

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Otwórz <http://localhost:3000>. Aplikacja działa od razu — klucze API są
opcjonalne. Bez nich tłumaczenie automatyczne zwróci komunikat
„nieskonfigurowane”, a tłumaczenie i przykłady można wpisać ręcznie.
Przykładowe zdania nadal działają, bo ich źródło nie wymaga klucza.

### Produkcja

```bash
npm run build
npm run start
```

`npm run build` automatycznie uruchamia `postbuild`, który generuje
`public/sw-manifest.json`. Serwer produkcyjny domyślnie nasłuchuje na porcie
3000.

### Jakość kodu

```bash
npm run lint
npm run typecheck
npm run build
```

---

## Konfiguracja środowiska

Skopiuj `.env.example` do `.env.local`. Wszystkie zmienne są **serwerowe** —
bez prefiksu `NEXT_PUBLIC_` — więc klucze nie trafiają do bundle'a klienta.

### Tłumaczenie

| Zmienna                | Opis                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `TRANSLATION_PROVIDER` | `auto` (domyślnie), `deepl`, `libretranslate` lub `none`             |
| `DEEPL_AUTH_KEY`       | Klucz DeepL; darmowy plan kończy się na `:fx`                        |
| `DEEPL_API_URL`        | Opcjonalny własny endpoint DeepL (np. proxy)                         |
| `LIBRETRANSLATE_URL`   | Bazowy URL instancji LibreTranslate, np. `https://libretranslate.com` |
| `LIBRETRANSLATE_API_KEY` | Opcjonalny klucz LibreTranslate                                    |

Tryb `auto`: jeśli ustawiono `DEEPL_AUTH_KEY`, używany jest DeepL; w
przeciwnym razie LibreTranslate, jeśli ustawiono `LIBRETRANSLATE_URL`; inaczej
tłumaczenie jest wyłączone. Wymuszenie dostawcy bez jego konfiguracji również
kończy się czytelnym błędem `NOT_CONFIGURED` i możliwością ręcznego wpisania
tłumaczenia.

Adresy API są wywoływane wyłącznie z Route Handlerów:

- `POST /api/enrich` — tłumaczenie (szybka odpowiedź, bez czekania na Tatoeba),
- `POST /api/examples` — przykładowe zdania z Tatoeba (osobne, dłuższe okno czasu),
- `POST /api/translate` — samo tłumaczenie,
- `POST /api/ai-example` — opcjonalny przykład AI.

Każdy endpoint ma walidację Zod, limit czasu i kontrolowane odpowiedzi błędów.
Tłumaczenie wraca od razu, a przykłady są pobierane równolegle przez osobny
endpoint, więc wolna odpowiedź Tatoeba nie blokuje podglądu ani zapisu słowa.
Tłumaczenia i przykłady są cache'owane w pamięci procesu serwera (odpowiednio
24 h i 6 h). Pomyślne odpowiedzi Tatoeba trzymane są 6 h, puste — tylko 2 min,
a błędy nie są cache'owane wcale, żeby ponowna próba mogła od razu zadziałać.
Cache lokalny przeglądarki (`lookups`) ma TTL 24 h i pomija wyniki bez
przykładowych zdań.

### Generator AI (niedostępny w interfejsie)

Endpoint `/api/ai-example` oraz zmienne `AI_API_KEY`, `AI_BASE_URL` i
`AI_MODEL` pozostają w projekcie, ale kreator słów ich nie używa. Przykładowe
zdania można wyłącznie wybrać spośród pobranych propozycji.

---

## Instalacja na iPhone

PWA wymaga HTTPS (lub `localhost` na komputerze). Najprościej wdrożyć aplikację
np. na Vercel i otworzyć adres na telefonie.

1. Otwórz adres Marginesu w **Safari** na iPhone'ie. (Nie w Chrome — w iOS
   instalacja PWA odbywa się przez Safari.)
2. Dotknij przycisku **Udostępnij** (kwadrat ze strzałką).
3. Wybierz **Dodaj do ekranu początkowego**.
4. Potwierdź nazwę **Margines** i dotknij **Dodaj**.
5. Uruchom aplikację z ikony na ekranie początkowym. Pierwsze otwarcie wymaga
   internetu, aby zapisać powłokę i pobrać assety.
6. Od tego momentu słownik, fiszki i zapisane dane działają offline.

W aplikacji, na dole słownika, znajduje się skrót **„Jak zainstalować na
iPhone?”** z tą instrukcją (widoczny tylko na urządzeniach iOS poza trybem
standalone).

Uwagi:

- Instalacja i pierwsze uruchomienie wymagają połączenia z internetem.
- Tłumaczenia i przykładowe zdania wymagają internetu również po instalacji.
- Dane są przypisane do originu i urządzenia. Wyczyszczenie danych Safari lub
  usunięcie aplikacji usuwa słownik.
- Aktualizacje PWA trafiają do urządzenia przy kolejnym otwarciu z siecią;
  service worker odświeża cache i przełącza nową wersję.

---

## Architektura

```text
src/
  app/
    page.tsx                 dashboard
    study/page.tsx           ekran nauki
    offline/page.tsx         fallback offline
    manifest.ts              manifest PWA
    api/
      enrich/route.ts        samo tłumaczenie (szybki podgląd)
      examples/route.ts      przykładowe zdania z Tatoeba
      translate/route.ts     samo tłumaczenie
      ai-example/route.ts    opcjonalny przykład AI
  components/
    dashboard/               zakładki, zestawy, dodawanie, podgląd, edycja, usuwanie
    study/                   reducer sesji i ekran fiszek
    ui/                      prymitywy w stylu shadcn/ui
  db/
    index.ts                 Dexie, schemat v1–v3, migracja
    types.ts                 typy rekordów
    seed.ts                  słowniki domyślne
    dictionaries.ts          CRUD słowników
    words.ts                 CRUD słów, duplikaty, powtórki
    sets.ts                  zestawy i przypisania słów
    lookups.ts               lokalny cache wyszukiwań
  hooks/                     gotowość bazy, wybór słownika, online, klient
  lib/
    translation/             adaptery DeepL i LibreTranslate
    tatoeba/client.ts        wyszukiwanie i ranking przykładów
    ai/example.ts            opcjonalny generator AI
    api-client.ts            fetch z limitem czasu i błędami
    validation.ts            schematy Zod
    languages.ts             języki, kolory, etykiety
  types/api.ts               kontrakt API
public/
  sw.js                      service worker
  icons/                     ikony PWA i Apple
scripts/
  generate-icons.mjs         generowanie ikon (sharp)
  generate-sw-manifest.mjs   lista assetów do precache
docs/database.md             schemat i migracje IndexedDB
```

### Przepływ dodawania słowa

1. Użytkownik wpisuje słowo. Aplikacja sprawdza duplikat w IndexedDB.
2. Jeśli słownik jest hiszpański/angielski, klient pyta `/api/enrich` o
   tłumaczenie. Podgląd otwiera się od razu po jego otrzymaniu.
3. Klient od razu po odebraniu tłumaczenia pyta `/api/examples`, nie czekając
   z pokazaniem podglądu. Serwer uruchamia oba zapytania do Tatoeba (z polskim
   tłumaczeniem i zapasowe) jednocześnie i stosuje wspólny deadline. Sekcja
   przykładów pokazuje stan ładowania; można poczekać albo wybrać „Zapisz bez
   przykładu”.
4. Przykłady pojawiają się w podglądzie i pierwszy jest wybierany automatycznie;
   nic nie jest zapisywane bez potwierdzenia.
5. `createWord` waliduje dane, normalizuje słowo i zapisuje rekord w Dexie
   (wraz z przypisaniem do zestawu, jeśli dodawanie rozpoczęto w jego widoku).
6. Lista odświeża się reaktywnie przez `useLiveQuery`.

Błędy tłumaczenia i przykładów są niezależne: brak tłumaczenia nie blokuje
przykładów i odwrotnie. Aplikacja nigdy nie wymyśla tłumaczenia ani nie
podstawia wygenerowanego zdania bez oznaczenia.

### Trwałość danych

- IndexedDB `margines` — słowniki, słowa, zestawy, przypisania do zestawów,
  cache wyszukiwań, metadane.
- `localStorage` — wybrany słownik i motyw.
- Service worker — powłoka aplikacji i statyczne assety, nie dane API.

Szczegóły schematu i migracji: [`docs/database.md`](docs/database.md).

---

## Prywatność i bezpieczeństwo

- Klucze API są używane tylko w Route Handlerach i nie są wysyłane do
  przeglądarki.
- Słownik nie opuszcza urządzenia. Do serwera trafia jedynie wpisywane słowo
  (do tłumaczenia i przykładów).
- Nagłówki bezpieczeństwa (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) oraz `no-store` dla `sw.js` i
  `sw-manifest.json` są ustawione w `next.config.ts`.
- Aplikacja nie ma logowania. Jeśli wdrażasz ją publicznie, chroń instancję
  (np. hasłem na poziomie platformy), aby nikt nie zużywał Twoich limitów API.
- `robots` jest ustawione na `noindex, nofollow`.

---

## Ograniczenia

- **Dane są lokalne:** brak kont, synchronizacji i eksportu. Każde urządzenie i
  każdy origin ma osobną bazę.
- **Brak SRS:** powtórki są proste (znane/nieznane, powtarzanie w tej samej
  sesji). Metadane powtórek są zapisywane, ale nie ma jeszcze algorytmu
  interwałów.
- **Tłumaczenia wymagają klucza:** bez DeepL/LibreTranslate trzeba wpisać
  tłumaczenie ręcznie. Przykładowe zdania działają bez klucza, ale wymagają
  internetu.
- **Generator AI:** endpoint `/api/ai-example` pozostaje w projekcie, ale
  interfejs dodawania słowa go nie udostępnia.
- **Słowniki ojczyste:** obsługiwany jest tylko polski; brak automatycznego
  tłumaczenia i przykładów.
- **Jeden kierunek:** hiszpański/angielski → polski. Interfejs jest polski.
- **PWA:** instalacja na iPhone'ie wymaga Safari i HTTPS. Offline obejmuje
  zapisane dane i powłokę, nie nowe tłumaczenia.
- **Brak testów E2E:** projekt ma lint, typecheck i build; nie ma jeszcze
  automatycznych testów przeglądarkowych.
- **Service worker tylko w produkcji:** w `npm run dev` celowo nie jest
  rejestrowany, aby nie maskować hot reloadu.

---

## Skrypty

| Skrypt              | Działanie                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | serwer deweloperski                                    |
| `npm run build`     | build produkcyjny + `postbuild` (manifest SW)          |
| `npm run start`     | serwer produkcyjny                                     |
| `npm run lint`      | ESLint dla całego projektu                             |
| `npm run typecheck` | `tsc --noEmit`                                         |
| `npm run icons`     | ponowne wygenerowanie ikon PWA/Apple                   |

---

## Licencje danych

- Przykładowe zdania pochodzą z korpusu Tatoeba (CC-BY 2.0 FR). Metadane autora
  i licencji są zapisywane razem ze słowem, ale interfejs ich nie wyświetla.
- Tłumaczenia DeepL/LibreTranslate są generowane przez zewnętrznych
  dostawców.
"# margines" 
