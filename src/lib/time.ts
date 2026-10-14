// Dates are shown in the business' timezone, not the visitor's browser timezone.
export const DEFAULT_TIMEZONE = "America/Bogota";
const LOCALE = "es-CO";

export const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** YYYY-MM-DD of `date` in `timeZone`. */
export function localDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export type DayOption = { date: string; weekday: number; label: string };

/** The next `count` days starting today, as seen in `timeZone`. */
export function upcomingDays(count: number, now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const days: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const date = localDate(new Date(now.getTime() + i * 86_400_000), timeZone);
    // Noon UTC of that calendar date is the same date everywhere in the Americas
    const noon = new Date(`${date}T12:00:00Z`);
    const label =
      i === 0
        ? "Hoy"
        : i === 1
          ? "Mañana"
          : capitalizeFirst(
              new Intl.DateTimeFormat(LOCALE, {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              }).format(noon),
            );
    days.push({ date, weekday: noon.getUTCDay(), label });
  }
  return days;
}

export function formatTime(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(iso));
}

export function formatLongDate(iso: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(iso));
}

export function formatCOP(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Group items with a `starts_at` by local calendar day, keeping their order. */
export function groupByDay<T extends { starts_at: string }>(
  items: T[],
  timeZone = DEFAULT_TIMEZONE,
): { date: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = localDate(new Date(item.starts_at), timeZone);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([date, items]) => ({ date, items }));
}
