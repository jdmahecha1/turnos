import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { upcomingDays } from "@/lib/time";

import { BookingFlow } from "./booking-flow";

const DAYS_SHOWN = 14;

export const metadata: Metadata = { title: "Reserva tu cita" };

async function loadBusiness(slug: string) {
  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug, name, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) return null;

  const [{ data: services }, { data: hours }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cop")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("name"),
    supabase.from("working_hours").select("weekday").eq("business_id", business.id),
  ]);

  return { business, services: services ?? [], openWeekdays: (hours ?? []).map((h) => h.weekday) };
}

async function Booking({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadBusiness(slug);
  if (!data) notFound();

  const { business, services, openWeekdays } = data;
  const days = upcomingDays(DAYS_SHOWN, new Date(), business.timezone).filter((d) =>
    openWeekdays.includes(d.weekday),
  );

  return (
    <>
      <title>{`Reserva en ${business.name} · Turnos`}</title>
      <h1 className="text-3xl font-bold tracking-tight">{business.name}</h1>
      <p className="mt-1 text-stone-600">Reserva tu cita en tres pasos.</p>

      {services.length === 0 || days.length === 0 ? (
        <div className="card mt-8 text-stone-600">
          Este negocio todavía no tiene horarios disponibles para reservar.
        </div>
      ) : (
        <BookingFlow
          slug={business.slug}
          timezone={business.timezone}
          services={services}
          days={days}
        />
      )}
    </>
  );
}

function BookingSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      <div className="h-9 w-64 rounded-lg bg-stone-200" />
      <div className="h-5 w-48 rounded bg-stone-200" />
      <div className="card mt-8 h-40" />
    </div>
  );
}

export default function BookingPage(props: PageProps<"/b/[slug]">) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<BookingSkeleton />}>
        <Booking params={props.params} />
      </Suspense>
    </div>
  );
}
