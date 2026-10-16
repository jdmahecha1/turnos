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

export type AuthState = {
  error?: string;
  /** Sign-up worked and a confirmation email went to this address. */
  sentTo?: string;
  /** Sign-in was refused because this address isn't confirmed yet. */
  unconfirmed?: string;
};

const RATE_LIMITED = "Ya enviamos varios correos. Espera unos minutos e inténtalo de nuevo.";

async function confirmUrl() {
  const origin = (await headers()).get("origin") ?? "";
  return `${origin}/auth/confirm`;
}

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password, mode } = parsed.data;
  const supabase = await createClient();

  if (mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      return {
        error: "Aún no has verificado tu correo. Abre el enlace que te enviamos.",
        unconfirmed: email,
      };
    }
    if (error) return { error: "Correo o contraseña incorrectos." };
    redirect("/panel");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await confirmUrl() },
  });
  if (error?.code === "over_email_send_rate_limit") return { error: RATE_LIMITED };
  if (error) return { error: "No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo." };
  // Email confirmation off: the user is already signed in
  if (data.session) redirect("/panel");
  // For privacy Supabase answers the same way when the email already exists, so the message
  // can't reveal who is registered.
  return { sentTo: email };
}

export async function resendConfirmation(email: string): Promise<{ ok?: boolean; error?: string }> {
  if (!z.email().safeParse(email).success) return { error: "Correo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await confirmUrl() },
  });
  if (error?.code === "over_email_send_rate_limit") return { error: RATE_LIMITED };
  if (error) return { error: "No pudimos reenviar el correo. Inténtalo más tarde." };
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
