"use client";

import { useActionState, useState } from "react";

import { type AuthState, authenticate } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});

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
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.info && (
        <p role="status" className="bg-brand-50 text-brand-900 rounded-xl px-4 py-3 text-sm">
          {state.info}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "Un momento…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
