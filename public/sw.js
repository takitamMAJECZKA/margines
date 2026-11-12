/*
 * Margines service worker.
 *
 * Goals:
 * - The app shell (dashboard, study, offline page) loads without a network.
 * - Saved vocabulary lives in IndexedDB, so the offline UI is fully usable.
 * - Translation/example APIs are never cached; they are online-only by design.
 * - Hashed Next.js assets are cached forever, runtime responses briefly.
 */

const VERSION = "margines-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

/** Pages that should always be available offline, even before the first visit. */
const CORE_PAGES = ["/", "/study", "/offline"];

/** Static files that are not part of the generated build manifest. */
const CORE_FILES = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

const RUNTIME_CACHE_LIMIT = 120;

async function addSafely(cache, url) {
  try {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response);
  } catch {
    // A single missing asset must not abort the whole install.
  }
}

async function readBuildAssets() {
  try {
    const response = await fetch("/sw-manifest.json", { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.assets) ? data.assets : [];
  } catch {
    return [];
  }
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;

  // Cache keys are in insertion order; remove the oldest entries first.
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await Promise.all(CORE_PAGES.map((url) => addSafely(shell, url)));

      const staticCache = await caches.open(STATIC_CACHE);
      await Promise.all(CORE_FILES.map((url) => addSafely(staticCache, url)));

      const buildAssets = await readBuildAssets();
      await Promise.all(buildAssets.map((url) => addSafely(staticCache, url)));

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key !== SHELL_CACHE && key !== STATIC_CACHE && key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );

      await trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT);
      await self.clients.claim();
    })(),
  );
});

/** Network-first navigation with a cached shell fallback. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache the canonical page URL, not the RSC payload variant.
      try {
        await cache.put(request, response.clone());
      } catch {
        // A full cache must not turn a successful navigation into an error.
      }
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const home = await cache.match("/");
    if (home) return home;

    const offline = await cache.match("/offline");
    if (offline) return offline;

    return new Response(
      "<!doctype html><html lang=\"pl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Offline — Margines</title><body style=\"font-family:system-ui;padding:2rem;line-height:1.6\"><h1>Brak połączenia</h1><p>Otwórz Margines ponownie, gdy sieć będzie dostępna.</p></body></html>",
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

/** Cache-first for hashed build output and icons. */
async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    try {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    } catch {
      // Ignore quota/cache failures; the network response is still usable.
    }
  }
  return response;
}

/** Stale-while-revalidate for other same-origin GET requests (including RSC). */
function handleRuntime(event, request) {
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        try {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(request, response.clone());
          await trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT);
        } catch {
          // Ignore cache failures and return the fresh response.
        }
      }
      return response;
    })
    .catch(() => undefined);

  // Called synchronously during the fetch event, so the browser keeps the
  // worker alive long enough to finish the background refresh.
  event.waitUntil(networkPromise.then(() => undefined));

  return (async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await networkPromise;
    return response ?? Response.error();
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Online-only APIs; translations and examples must never be served stale.
  if (url.pathname.startsWith("/api/")) return;

  // The service worker and its asset manifest must always be revalidated.
  if (url.pathname === "/sw.js" || url.pathname === "/sw-manifest.json") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(handleStatic(request));
    return;
  }

  event.respondWith(handleRuntime(event, request));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
