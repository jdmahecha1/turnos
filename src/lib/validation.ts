import { z } from "zod";

// Mirrors the CHECK constraints in the database so users get errors before a round trip.

export const RESERVED_SLUGS = ["admin", "api", "auth", "login", "panel", "b", "www"];

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, "Escribe un teléfono válido (solo números)."));

export const bookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  phone: phoneSchema,
});

export const businessSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "La dirección debe tener al menos 3 caracteres.")
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usa solo letras minúsculas, números y guiones.")
    .refine((s) => !RESERVED_SLUGS.includes(s), "Esa dirección está reservada."),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto.").max(60),
  duration: z.coerce.number().int().min(5, "Mínimo 5 minutos.").max(480, "Máximo 8 horas."),
  price: z.coerce.number().int().min(0, "El precio no puede ser negativo."),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

export const hoursSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), opensAt: time, closesAt: time })
      .refine((d) => d.opensAt < d.closesAt, "La hora de cierre debe ser después de la apertura."),
  )
  .max(7);

/** Turn a business name into a suggested URL slug: "Barbería El Parche" -> "barberia-el-parche". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos.";
}
