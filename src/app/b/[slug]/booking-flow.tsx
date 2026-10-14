"use client";

import { useActionState, useState, useTransition } from "react";

import type { Service } from "@/lib/database.types";
import { type DayOption, formatCOP, formatDuration, formatLongDate, formatTime } from "@/lib/time";

import { type BookingState, bookAppointment, getSlots } from "./actions";

type Props = {
  slug: string;
  timezone: string;
  services: Pick<Service, "id" | "name" | "duration_minutes" | "price_cop">[];
  days: DayOption[];
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 flex items-center gap-3 font-semibold">
        <span className="bg-brand-100 text-brand-700 grid size-7 place-items-center rounded-full text-sm">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BookingFlow({ slug, timezone, services, days }: Props) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState(days[0].date);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [loadingSlots, startLoading] = useTransition();

  const service = services.find((s) => s.id === serviceId);

  function loadSlots(nextServiceId: string, nextDay: string) {
    startLoading(async () => {
      const result = await getSlots(slug, nextServiceId, nextDay);
      setSlots(result.slots);
      setSlotsError(result.error);
    });
  }

  function choose(nextServiceId: string, nextDay: string) {
    setServiceId(nextServiceId);
    setDay(nextDay);
    setStartsAt(null);
    loadSlots(nextServiceId, nextDay);
  }

  const [state, formAction, booking] = useActionState<BookingState, FormData>(
    async (prev, formData) => {
      const result = await bookAppointment(prev, formData);
      // If the slot was taken meanwhile, show fresh availability
      if (result.status === "error" && serviceId) loadSlots(serviceId, day);
      return result;
    },
    { status: "idle" },
  );

  if (state.status === "booked" && service) {
    return (
      <div className="card mt-8 text-center" role="status">
        <div className="bg-brand-100 text-brand-700 mx-auto mb-4 grid size-14 place-items-center rounded-full text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-semibold">¡Tu cita quedó reservada!</h2>
        <p className="mt-2 text-stone-600">
          {service.name} · {formatLongDate(state.startsAt, timezone)} a las{" "}
          {formatTime(state.startsAt, timezone)}
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Te esperamos. Si no puedes asistir, avísale al negocio.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <Step n={1} title="Elige el servicio">
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === serviceId}
              onClick={() => choose(s.id, day)}
              className="chip flex flex-col items-start gap-0.5 p-4 text-left"
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs opacity-80">
                {formatDuration(s.duration_minutes)} · {formatCOP(s.price_cop)}
              </span>
            </button>
          ))}
        </div>
      </Step>

      {service && (
        <Step n={2} title="Elige día y hora">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                aria-pressed={d.date === day}
                onClick={() => serviceId && choose(serviceId, d.date)}
                className="chip shrink-0"
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-24" aria-live="polite" aria-busy={loadingSlots}>
            {loadingSlots || slots === null ? (
              <p className="text-sm text-stone-500">Buscando horarios…</p>
            ) : slotsError ? (
              <p className="text-sm text-red-700">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-stone-500">No quedan horarios este día. Prueba otro.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    aria-pressed={iso === startsAt}
                    onClick={() => setStartsAt(iso)}
                    className="chip"
                  >
                    {formatTime(iso, timezone)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Step>
      )}

      {service && startsAt && (
        <Step n={3} title="Tus datos">
          <p className="mb-4 rounded-xl bg-stone-100 px-4 py-3 text-sm">
            <strong>{service.name}</strong> · {formatLongDate(startsAt, timezone)} a las{" "}
            {formatTime(startsAt, timezone)}
          </p>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="startsAt" value={startsAt} />
            <div>
              <label htmlFor="name" className="label">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                className="input"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Celular
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                inputMode="tel"
                placeholder="300 123 4567"
                className="input"
                autoComplete="tel"
              />
            </div>
            {state.status === "error" && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.message}
              </p>
            )}
            <button type="submit" disabled={booking} className="btn-primary w-full py-3">
              {booking ? "Reservando…" : "Confirmar reserva"}
            </button>
          </form>
        </Step>
      )}
    </div>
  );
}
