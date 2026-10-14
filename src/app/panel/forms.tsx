"use client";

import { useActionState, useRef, useState } from "react";

import type { WorkingHours } from "@/lib/database.types";
import { WEEKDAYS } from "@/lib/time";
import { slugify } from "@/lib/validation";

import { addService, createBusiness, type FormState, saveHours } from "./actions";

function Message({ state, success }: { state: FormState; success?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.ok && success) {
    return (
      <p role="status" className="text-brand-700 text-sm">
        {success}
      </p>
    );
  }
  return null;
}

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState(createBusiness, {});
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);

  return (
    <form action={action} className="card mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Crea tu negocio</h1>
        <p className="text-sm text-stone-600">Después podrás agregar servicios y horarios.</p>
      </div>
      <div>
        <label htmlFor="name" className="label">
          Nombre del negocio
        </label>
        <input
          id="name"
          name="name"
          required
          className="input"
          placeholder="Barbería El Parche"
          onChange={(e) => !edited && setSlug(slugify(e.target.value))}
        />
      </div>
      <div>
        <label htmlFor="slug" className="label">
          Dirección de tu página
        </label>
        <div className="flex items-center gap-1 text-sm text-stone-500">
          <span>/b/</span>
          <input
            id="slug"
            name="slug"
            required
            className="input"
            value={slug}
            onChange={(e) => {
              setEdited(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>
      <Message state={state} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creando…" : "Crear negocio"}
      </button>
    </form>
  );
}

export function AddServiceForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await addService(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-3 border-t border-stone-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_8rem_auto] sm:items-end">
        <div>
          <label htmlFor="service-name" className="label">
            Servicio
          </label>
          <input
            id="service-name"
            name="name"
            required
            className="input"
            placeholder="Corte + barba"
          />
        </div>
        <div>
          <label htmlFor="duration" className="label">
            Minutos
          </label>
          <input
            id="duration"
            name="duration"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={30}
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="price" className="label">
            Precio (COP)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1000}
            defaultValue={20000}
            required
            className="input"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Agregando…" : "Agregar"}
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function HoursForm({
  hours,
}: {
  hours: Pick<WorkingHours, "weekday" | "opens_at" | "closes_at">[];
}) {
  const [state, action, pending] = useActionState(saveHours, {});
  // Monday first, like a Colombian calendar
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <form action={action} className="space-y-3">
      <ul className="divide-y divide-stone-100">
        {order.map((d) => {
          const day = hours.find((h) => h.weekday === d);
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 py-2">
              <label className="flex w-32 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={`open-${d}`}
                  defaultChecked={!!day}
                  className="accent-brand-600 size-4"
                />
                {WEEKDAYS[d]}
              </label>
              <input
                type="time"
                name={`opens-${d}`}
                aria-label={`${WEEKDAYS[d]}: abre`}
                defaultValue={day?.opens_at.slice(0, 5) ?? "08:00"}
                className="input w-32"
              />
              <span className="text-sm text-stone-500">a</span>
              <input
                type="time"
                name={`closes-${d}`}
                aria-label={`${WEEKDAYS[d]}: cierra`}
                defaultValue={day?.closes_at.slice(0, 5) ?? "18:00"}
                className="input w-32"
              />
            </li>
          );
        })}
      </ul>
      <Message state={state} success="Horario guardado." />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Guardando…" : "Guardar horario"}
      </button>
    </form>
  );
}
