"use client";

import { useEffect, useState } from "react";

import { seedDatabase } from "@/db/seed";

export function useDatabaseReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    seedDatabase()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((cause) => {
        console.error("Database initialisation failed", cause);
        if (!cancelled) {
          setError("Nie udało się otworzyć lokalnej bazy danych.");
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}
