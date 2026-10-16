import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient, currentUserId } from "@/lib/supabase/server";
import {
  capitalizeFirst,
  formatCOP,
  formatDuration,
  formatLongDate,
  formatTime,
  groupByDay,
} from "@/lib/time";

import { signOut } from "../login/actions";
import { Notice } from "../notice";
import { cancelAppointment, setServiceActive } from "./actions";
import { AddServiceForm, CreateBusinessForm, HoursForm } from "./forms";

export const metadata: Metadata = { title: "Mi negocio" };

async function Panel() {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) redirect("/login");

  // Businesses, services and hours are publicly readable (booking pages need them),
  // so the panel must filter by owner explicitly instead of relying on RLS here.
  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug, name, timezone")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!business) return <CreateBusinessForm />;

  const [{ data: appointments }, { data: services }, { data: hours }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, customer_name, customer_phone, services(name)")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(100),
    supabase.from("services").select("*").eq("business_id", business.id).order("created_at"),
    supabase
      .from("working_hours")
      .select("weekday, opens_at, closes_at")
      .eq("business_id", business.id),
  ]);

  const tz = business.timezone;
  const days = groupByDay(appointments ?? [], tz);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
          <p className="text-sm text-stone-600">
            Tu página de reservas:{" "}
            <Link href={`/b/${business.slug}`} className="text-brand-700 font-medium underline">
              /b/{business.slug}
            </Link>
          </p>
        </div>
        <form action={signOut}>
          <button className="btn-secondary">Cerrar sesión</button>
        </form>
      </div>

      <section className="card">
        <h2 className="mb-4 font-semibold">Próximas citas</h2>
        {days.length === 0 ? (
          <p className="text-sm text-stone-500">
            Aún no tienes citas. Comparte tu página de reservas con tus clientes.
          </p>
        ) : (
          <div className="space-y-6">
            {days.map(({ date, items }) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-semibold text-stone-500">
                  {capitalizeFirst(formatLongDate(items[0].starts_at, tz))}
                </h3>
                <ul className="divide-y divide-stone-100">
                  {items.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {formatTime(a.starts_at, tz)} · {a.services?.name}
                        </p>
                        <p className="text-sm text-stone-600">
                          {a.customer_name} ·{" "}
                          <a
                            className="underline"
                            href={`https://wa.me/${a.customer_phone.replace("+", "")}`}
                          >
                            {a.customer_phone}
                          </a>
                        </p>
                      </div>
                      <form action={cancelAppointment}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn-danger px-3 py-1.5">Cancelar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Servicios</h2>
          <ul className="divide-y divide-stone-100">
            {(services ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className={s.active ? "" : "opacity-50"}>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-stone-600">
                    {formatDuration(s.duration_minutes)} · {formatCOP(s.price_cop)}
                  </p>
                </div>
                <form action={setServiceActive}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  <button className="btn-secondary px-3 py-1.5">
                    {s.active ? "Pausar" : "Activar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <AddServiceForm />
        </section>

        <section className="card">
          <h2 className="mb-4 font-semibold">Horario de atención</h2>
          <HoursForm hours={hours ?? []} />
        </section>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded-lg bg-stone-200" />
      <div className="card h-48" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card h-64" />
        <div className="card h-64" />
      </div>
    </div>
  );
}

export default function PanelPage(props: PageProps<"/panel">) {
  return (
    <>
      <Suspense>
        <Notice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<PanelSkeleton />}>
        <Panel />
      </Suspense>
    </>
  );
}
