"use server";

import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { bookingSchema, firstError } from "@/lib/validation";

export async function getSlots(slug: string, serviceId: string, day: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("available_slots", {
    p_business_slug: slug,
    p_service_id: serviceId,
    p_day: day,
  });
  if (error) return { slots: [] as string[], error: friendlyError(error) };
  return { slots: data.map((row) => row.starts_at), error: null };
}

export type BookingState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "booked"; startsAt: string };

export async function bookAppointment(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: firstError(parsed.error) };

  const { slug, serviceId, startsAt, name, phone } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_appointment", {
    p_business_slug: slug,
    p_service_id: serviceId,
    p_starts_at: startsAt,
    p_customer_name: name,
    p_customer_phone: phone,
  });
  if (error) return { status: "error", message: friendlyError(error) };
  return { status: "booked", startsAt };
}
