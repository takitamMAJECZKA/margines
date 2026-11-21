import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10"><Brand /><Suspense><AuthForm mode="signup" /></Suspense></main>;
}
