// Turn database errors into messages a customer or owner can act on.

type PgError = { message?: string; code?: string } | null | undefined;

const BY_MESSAGE: Record<string, string> = {
  slot_unavailable: "Ese horario ya no está disponible. Elige otro, por favor.",
  service_not_found: "Ese servicio ya no existe o no está activo.",
  business_not_found: "No encontramos este negocio.",
  invalid_customer_data: "Revisa tu nombre y teléfono.",
};

const BY_CODE: Record<string, string> = {
  "23505": "Ese valor ya está en uso.", // unique_violation
  "23514": "Algún dato no es válido.", // check_violation
  "23P01": "Ese horario se cruza con otra cita.", // exclusion_violation
  "42501": "No tienes permiso para hacer esto.", // insufficient_privilege / RLS
};

export function friendlyError(
  error: PgError,
  fallback = "Algo salió mal. Intenta de nuevo.",
): string {
  if (!error) return fallback;
  for (const [key, text] of Object.entries(BY_MESSAGE)) {
    if (error.message?.includes(key)) return text;
  }
  return (error.code && BY_CODE[error.code]) || fallback;
}
