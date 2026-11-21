"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const search = useSearchParams();
  const signup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      if (signup) {
        const username = String(form.get("username") ?? "").trim().toLowerCase();
        const { data, error } = await createClient().auth.signUp({
          email: identifier.toLowerCase(), password,
          options: { data: { username }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage(data.session ? "Konto utworzone. Możesz się zalogować." : "Sprawdź pocztę i potwierdź adres e-mail.");
        return;
      }
      if (identifier.includes("@")) {
        const { error } = await createClient().auth.signInWithPassword({ email: identifier.toLowerCase(), password });
        if (error) throw error;
      } else {
        const response = await fetch("/api/auth/username-login", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: identifier, password }),
        });
        if (!response.ok) throw new Error("Nieprawidłowa nazwa użytkownika lub hasło.");
      }
      const next = search.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wykonać tej operacji.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMessage("");
    try {
      const next = search.get("next");
      const redirect = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się rozpocząć logowania Google.");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-border/70 bg-card p-6 shadow-card sm:p-8">
      <h1 className="font-display text-3xl">{signup ? "Załóż konto" : "Zaloguj się"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Twoje słowniki i postęp będą przypisane do konta.</p>
      {search.get("setup") && <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">Aplikacja wymaga konfiguracji projektu Supabase.</p>}
      {search.get("error") === "oauth" && <p className="mt-4 text-sm text-destructive">Logowanie Google nie powiodło się.</p>}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {signup && <Input name="username" autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" placeholder="Nazwa użytkownika" required />}
        <Input name="identifier" type={signup ? "email" : "text"} autoComplete={signup ? "email" : "username"} placeholder={signup ? "Adres e-mail" : "Nazwa użytkownika lub e-mail"} required />
        <Input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} maxLength={256} placeholder="Hasło (min. 8 znaków)" required />
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Chwileczkę…" : signup ? "Utwórz konto" : "Zaloguj się"}</Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />lub<span className="h-px flex-1 bg-border" /></div>
      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={google}>Kontynuuj z Google</Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {signup ? "Masz już konto? " : "Nie masz konta? "}
        <Link className="font-medium text-foreground underline underline-offset-4" href={signup ? "/login" : "/signup"}>{signup ? "Zaloguj się" : "Załóż konto"}</Link>
      </p>
    </div>
  );
}
