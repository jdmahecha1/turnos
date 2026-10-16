"use client";

import { useActionState, useState, useTransition } from "react";

import { type AuthState, authenticate, resendConfirmation } from "./actions";

function ResendButton({ email }: { email: string }) {
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, startTransition] = useTransition();

  if (result.ok) {
    return (
      <p role="status" className="text-brand-700 text-sm">
        Listo, te enviamos otro correo.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await resendConfirmation(email)))}
        className="btn-secondary w-full"
      >
        {pending ? "Reenviando…" : "Reenviar el correo"}
      </button>
      {result.error && (
        <p role="alert" className="text-sm text-red-700">
          {result.error}
        </p>
      )}
    </div>
  );
}

function CheckYourEmail({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="card space-y-4 text-center" role="status">
      <div className="bg-brand-100 text-brand-700 mx-auto grid size-14 place-items-center rounded-full text-2xl">
        ✉
      </div>
      <div>
        <h2 className="text-xl font-semibold">Revisa tu correo</h2>
        <p className="mt-2 text-sm text-stone-600">
          Te enviamos un enlace de verificación a
          <strong className="my-1 block wrap-anywhere text-stone-900">{email}</strong>
          Ábrelo para activar tu cuenta.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Si no lo ves en unos minutos, busca en la carpeta de spam o promociones.
        </p>
      </div>
      <ResendButton email={email} />
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-stone-600 underline hover:text-stone-900"
      >
        Ya lo verifiqué, quiero iniciar sesión
      </button>
    </div>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});

  if (state.sentTo && dismissed !== state.sentTo) {
    const email = state.sentTo;
    return (
      <CheckYourEmail
        email={email}
        onBack={() => {
          setDismissed(email);
          setMode("signin");
        }}
      />
    );
  }

  return (
    <form action={formAction} className="card space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-medium">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 ${mode === m ? "bg-white shadow-sm" : "text-stone-500"}`}
          >
            {m === "signin" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="email" className="label">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className="input"
        />
        {mode === "signup" && <p className="mt-1.5 text-xs text-stone-500">Mínimo 8 caracteres.</p>}
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.unconfirmed && <ResendButton email={state.unconfirmed} />}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "Un momento…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
