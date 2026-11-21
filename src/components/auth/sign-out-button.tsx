"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    if (error) return;
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Wyloguj się" title="Wyloguj się" onClick={signOut} className="text-muted-foreground hover:text-foreground">
      <LogOut aria-hidden="true" />
    </Button>
  );
}
