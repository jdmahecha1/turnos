import { beforeEach, describe, expect, it } from "vitest";

import {
  book,
  bogotaDate,
  bogotaInstant,
  createBusiness,
  createTestDb,
  slots,
  type TestDb,
} from "./harness";

let db: TestDb;
let shop: Awaited<ReturnType<typeof createBusiness>>;
const day = bogotaDate(7);
const at = (time: string) => bogotaInstant(day, time);

beforeEach(async () => {
  db = await createTestDb();
  shop = await createBusiness(db, "barberia-el-parche");
});

describe("available_slots", () => {
  it("offers a 15-minute grid inside working hours that fits the service", async () => {
    const free = await slots(db, shop.slug, shop.serviceId, day);
    // 08:00 .. 17:30 for a 30-minute service closing at 18:00
    expect(free).toHaveLength(39);
    expect(free[0]).toBe(at("08:00"));
    expect(free.at(-1)).toBe(at("17:30"));
  });

  it("hides every start time that would overlap a booking", async () => {
    await book(db, shop.slug, shop.serviceId, at("10:00"));
    const free = await slots(db, shop.slug, shop.serviceId, day);
    expect(free).not.toContain(at("09:45"));
    expect(free).not.toContain(at("10:00"));
    expect(free).not.toContain(at("10:15"));
    // touching is fine: 09:30-10:00 and 10:30-11:00 don't overlap 10:00-10:30
    expect(free).toContain(at("09:30"));
    expect(free).toContain(at("10:30"));
  });

  it("frees the slot again when the appointment is cancelled", async () => {
    const id = await book(db, shop.slug, shop.serviceId, at("10:00"));
    await db.user(shop.ownerId, (tx) =>
      tx.query("update public.appointments set status = 'cancelled' where id = $1", [id]),
    );
    expect(await slots(db, shop.slug, shop.serviceId, day)).toContain(at("10:00"));
  });

  it("returns nothing on closed days", async () => {
    const weekday = new Date(`${day}T12:00:00-05:00`).getUTCDay();
    await db.admin((tx) =>
      tx.query("delete from public.working_hours where business_id = $1 and weekday = $2", [
        shop.businessId,
        weekday,
      ]),
    );
    expect(await slots(db, shop.slug, shop.serviceId, day)).toEqual([]);
  });

  it("never offers the past or more than 60 days ahead", async () => {
    expect(await slots(db, shop.slug, shop.serviceId, bogotaDate(-1))).toEqual([]);
    expect(await slots(db, shop.slug, shop.serviceId, bogotaDate(61))).toEqual([]);
    expect(await slots(db, shop.slug, shop.serviceId, bogotaDate(60))).not.toEqual([]);
  });

  it("returns nothing for unknown businesses or inactive services", async () => {
    expect(await slots(db, "no-existe", shop.serviceId, day)).toEqual([]);
    await db.admin((tx) =>
      tx.query("update public.services set active = false where id = $1", [shop.serviceId]),
    );
    expect(await slots(db, shop.slug, shop.serviceId, day)).toEqual([]);
  });
});

describe("book_appointment", () => {
  it("stores the appointment with the service duration", async () => {
    const id = await book(db, shop.slug, shop.serviceId, at("09:00"));
    const { rows } = await db.admin((tx) =>
      tx.query<{ starts_at: Date; ends_at: Date; status: string }>(
        "select starts_at, ends_at, status from public.appointments where id = $1",
        [id],
      ),
    );
    expect(new Date(rows[0].starts_at).toISOString()).toBe(at("09:00"));
    expect(new Date(rows[0].ends_at).toISOString()).toBe(at("09:30"));
    expect(rows[0].status).toBe("confirmed");
  });

  it("rejects a slot that is already taken", async () => {
    await book(db, shop.slug, shop.serviceId, at("11:00"));
    await expect(book(db, shop.slug, shop.serviceId, at("11:00"))).rejects.toThrow(
      "slot_unavailable",
    );
    await expect(book(db, shop.slug, shop.serviceId, at("11:15"))).rejects.toThrow(
      "slot_unavailable",
    );
  });

  it("rejects times outside the grid, outside hours or in the past", async () => {
    for (const startsAt of [
      at("10:07"),
      at("07:30"),
      at("17:45"),
      bogotaInstant(bogotaDate(-1), "10:00"),
    ]) {
      await expect(book(db, shop.slug, shop.serviceId, startsAt)).rejects.toThrow(
        "slot_unavailable",
      );
    }
  });

  it("rejects services from another business", async () => {
    const other = await createBusiness(db, "spa-la-calma");
    await expect(book(db, shop.slug, other.serviceId, at("10:00"))).rejects.toThrow(
      "service_not_found",
    );
    await expect(book(db, "no-existe", shop.serviceId, at("10:00"))).rejects.toThrow(
      "business_not_found",
    );
  });

  it("normalizes the phone and validates customer data", async () => {
    const id = await book(db, shop.slug, shop.serviceId, at("12:00"), {
      name: "  Andrés Pérez ",
      phone: "+57 (300) 123-4567",
    });
    const { rows } = await db.admin((tx) =>
      tx.query<{ customer_name: string; customer_phone: string }>(
        "select customer_name, customer_phone from public.appointments where id = $1",
        [id],
      ),
    );
    expect(rows[0]).toEqual({ customer_name: "Andrés Pérez", customer_phone: "+573001234567" });

    await expect(
      book(db, shop.slug, shop.serviceId, at("13:00"), { name: "Ana", phone: "abc" }),
    ).rejects.toThrow("invalid_customer_data");
  });

  it("is protected by the database even if the function is bypassed", async () => {
    await book(db, shop.slug, shop.serviceId, at("15:00"));
    // A direct insert of an overlapping appointment (e.g. a buggy admin script)
    const direct = db.admin((tx) =>
      tx.query(
        `insert into public.appointments
           (business_id, service_id, customer_name, customer_phone, starts_at, ends_at)
         values ($1, $2, 'Otro', '3000000000', $3, $4)`,
        [shop.businessId, shop.serviceId, at("15:10"), at("15:40")],
      ),
    );
    await expect(direct).rejects.toMatchObject({ code: "23P01" }); // exclusion_violation
  });
});
