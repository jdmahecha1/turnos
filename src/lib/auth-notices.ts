// Messages shown after following the link in the confirmation email.

export const NOTICES = {
  verified: {
    tone: "success",
    title: "¡Tu correo fue verificado!",
    text: "Ya puedes iniciar sesión con tu correo y contraseña.",
  },
  welcome: {
    tone: "success",
    title: "¡Tu correo fue verificado!",
    text: "Bienvenido a Turnos. Empieza creando tu negocio.",
  },
  "link-expired": {
    tone: "error",
    title: "El enlace ya no es válido",
    text: "Venció o ya fue usado. Si tu cuenta ya está activa, inicia sesión; si no, entra y pide un nuevo correo.",
  },
} as const;

export type NoticeKey = keyof typeof NOTICES;

export function isNoticeKey(value: unknown): value is NoticeKey {
  return typeof value === "string" && value in NOTICES;
}

type ConfirmOutcome = {
  /** Supabase sends error params when the link expired or was already used. */
  linkError: boolean;
  /** Whether a session could be opened in this browser. */
  signedIn: boolean;
};

/**
 * Where to send the user after the confirmation link.
 *
 * Supabase verifies the email before redirecting here, so if there is no error the address
 * IS confirmed even when no session can be opened (e.g. the link was opened in the mail app's
 * browser, which doesn't have the sign-up cookies). In that case we ask them to sign in.
 */
export function confirmDestination({ linkError, signedIn }: ConfirmOutcome): string {
  if (linkError) return "/login?aviso=link-expired";
  return signedIn ? "/panel?aviso=welcome" : "/login?aviso=verified";
}
