"use server";

import { revalidatePath } from "next/cache";

import { friendlyError } from "@/lib/errors";
import { createClient, currentUserId } from "@/lib/supabase/server";
import { businessSchema, firstError, hoursSchema, serviceSchema } from "@/lib/validation";

export type FormState = { error?: string; ok?: boolean };

// Every query runs as the signed-in owner: RLS decides what they can change, these actions
// only validate input and shape it.

async function ownedBusinessId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const userId = await currentUserId(supabase);
  if (!userId) return null;
  // Businesses are publicly readable, so filter by owner explicitly
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    return {
      error:
        error.code === "23505" ? "Esa dirección ya la usa otro negocio." : friendlyError(error),
    };
  }

  // Sensible defaults so the booking page works right away: Mon-Sat 8:00-18:00
  await supabase.from("working_hours").insert(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      business_id: business.id,
      weekday,
      opens_at: "08:00",
      closes_at: "18:00",
    })),
  );
  revalidatePath("/panel");
  return { ok: true };
}

export async function addService(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const businessId = await ownedBusinessId(supabase);
  if (!businessId) return { error: "Primero crea tu negocio." };

  const { error } = await supabase.from("services").insert({
    business_id: businessId,
    name: parsed.data.name,
    duration_minutes: parsed.data.duration,
    price_cop: parsed.data.price,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/panel");
  return { ok: true };
}

export async function setServiceActive(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("services")
    .update({ active: formData.get("active") === "true" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/panel");
}

export async function saveHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const days = [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => formData.get(`open-${d}`) === "on")
    .map((d) => ({
      weekday: d,
      opensAt: String(formData.get(`opens-${d}`)),
      closesAt: String(formData.get(`closes-${d}`)),
    }));
  const parsed = hoursSchema.safeParse(days);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const businessId = await ownedBusinessId(supabase);
  if (!businessId) return { error: "Primero crea tu negocio." };

  const open = parsed.data.map((d) => d.weekday);
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.includes(d));

  const { error: upsertError } = await supabase.from("working_hours").upsert(
    parsed.data.map((d) => ({
      business_id: businessId,
      weekday: d.weekday,
      opens_at: d.opensAt,
      closes_at: d.closesAt,
    })),
  );
  if (upsertError) return { error: friendlyError(upsertError) };

  if (closed.length) {
    const { error } = await supabase
      .from("working_hours")
      .delete()
      .eq("business_id", businessId)
      .in("weekday", closed);
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath("/panel");
  return { ok: true };
}

export async function cancelAppointment(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/panel");
}
