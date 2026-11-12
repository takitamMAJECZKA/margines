"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. In development, a service
 * worker cache would mask hot reloads and cause confusing stale UI.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

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
