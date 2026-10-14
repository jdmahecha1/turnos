import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient, currentUserId } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

async function RedirectIfSignedIn() {
  if (await currentUserId(await createClient())) redirect("/panel");
  return null;
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Tu negocio en Turnos</h1>
      <p className="mb-6 text-stone-600">Entra para ver tus citas y configurar tus horarios.</p>
      <LoginForm />
    </div>
  );
}
