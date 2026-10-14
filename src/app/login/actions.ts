"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";

const credentials = z.object({
  email: z.email("Escribe un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  mode: z.enum(["signin", "signup"]),
});

export type AuthState = { error?: string; info?: string };

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password, mode } = parsed.data;
  const supabase = await createClient();

  if (mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Correo o contraseña incorrectos." };
    redirect("/panel");
  }

  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: "No pudimos crear la cuenta. ¿Ya estás registrado?" };
  if (!data.session) return { info: "Te enviamos un correo para confirmar tu cuenta." };
  redirect("/panel");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
