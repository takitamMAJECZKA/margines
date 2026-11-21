"use client";

import { useEffect } from "react";

/**
 * A service worker registered by an earlier production run keeps serving its
 * cached shell and assets on the same origin. During development that hides
 * code changes (including hot reload), so unregister it and drop its caches.
 */
let devCleanupStarted = false;

/**
 * Registers the service worker in production only. In development, a service
 * worker cache would mask hot reloads and cause confusing stale UI.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      if (devCleanupStarted) return;
      devCleanupStarted = true;

      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length === 0) return;

          await Promise.all(
            registrations.map((registration) => registration.unregister()),
          );

          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }

          window.location.reload();
        } catch (error) {
          console.error("Could not clear the development service worker", error);
        }
      })();

      return;
    }

    if (!window.isSecureContext) return;

    const hadController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      // Reload once when a new version takes over, but not on the very first install.
      if (hadController) window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  return null;
}
