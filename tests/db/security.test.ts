import { beforeEach, describe, expect, it } from "vitest";

import {
  book,
  bogotaDate,
  bogotaInstant,
  createBusiness,
  createTestDb,
  createUser,
  type TestDb,
} from "./harness";

let db: TestDb;
let a: Awaited<ReturnType<typeof createBusiness>>;
let b: Awaited<ReturnType<typeof createBusiness>>;
let appointmentOfB: string;
const day = bogotaDate(5);

beforeEach(async () => {
  db = await createTestDb();
  a = await createBusiness(db, "negocio-a");
  b = await createBusiness(db, "negocio-b");
  appointmentOfB = await book(db, b.slug, b.serviceId, bogotaInstant(day, "10:00"));
});

describe("anonymous visitors", () => {
  it("can see businesses, active services and hours", async () => {
    await db.admin((tx) =>
      tx.query(
        "insert into public.services (business_id, name, duration_minutes, active) values ($1, 'Oculto', 30, false)",
        [a.businessId],
      ),
    );
    const services = await db.anon((tx) =>
      tx.query<{ name: string }>("select name from public.services where business_id = $1", [
        a.businessId,
      ]),
    );
    expect(services.rows.map((s) => s.name)).toEqual(["Corte de cabello"]);
    const hours = await db.anon((tx) => tx.query("select * from public.working_hours"));
    expect(hours.rows).toHaveLength(14);
  });

  it("cannot read any customer data", async () => {
    const { rows } = await db.anon((tx) => tx.query("select * from public.appointments"));
    expect(rows).toEqual([]);
  });

  it("cannot insert appointments directly, only through book_appointment", async () => {
    const insert = db.anon((tx) =>
      tx.query(
        `insert into public.appointments
           (business_id, service_id, customer_name, customer_phone, starts_at, ends_at)
         values ($1, $2, 'Hacker', '3000000000', now() + interval '1 day', now() + interval '1 day 30 min')`,
        [a.businessId, a.serviceId],
      ),
    );
    await expect(insert).rejects.toThrow(/permission denied/);
  });

  it("cannot create or modify businesses, services or hours", async () => {
    for (const sql of [
      "insert into public.businesses (owner_id, slug, name) values (gen_random_uuid(), 'pirata', 'Pirata')",
      `update public.services set price_cop = 1 where business_id = '${a.businessId}'`,
      `delete from public.working_hours where business_id = '${a.businessId}'`,
      "truncate public.appointments",
    ]) {
      await expect(db.anon((tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("business owners", () => {
  it("see only their own appointments", async () => {
    const own = await db.user(b.ownerId, (tx) => tx.query("select id from public.appointments"));
    expect(own.rows).toEqual([{ id: appointmentOfB }]);
    const others = await db.user(a.ownerId, (tx) => tx.query("select id from public.appointments"));
    expect(others.rows).toEqual([]);
  });

  it("cannot change another owner's data", async () => {
    const result = await db.user(a.ownerId, (tx) =>
      tx.query("update public.services set price_cop = 1 where business_id = $1", [b.businessId]),
    );
    expect(result.affectedRows).toBe(0);

    const cancel = await db.user(a.ownerId, (tx) =>
      tx.query("update public.appointments set status = 'cancelled' where id = $1", [
        appointmentOfB,
      ]),
    );
    expect(cancel.affectedRows).toBe(0);
  });

  it("cannot add services to another owner's business", async () => {
    const insert = db.user(a.ownerId, (tx) =>
      tx.query(
        "insert into public.services (business_id, name, duration_minutes) values ($1, 'Intruso', 30)",
        [b.businessId],
      ),
    );
    await expect(insert).rejects.toThrow(/row-level security/);
  });

  it("can cancel an appointment but not move it", async () => {
    const cancel = await db.user(b.ownerId, (tx) =>
      tx.query("update public.appointments set status = 'cancelled' where id = $1", [
        appointmentOfB,
      ]),
    );
    expect(cancel.affectedRows).toBe(1);

    const move = db.user(b.ownerId, (tx) =>
      tx.query("update public.appointments set starts_at = starts_at + interval '1 hour'"),
    );
    await expect(move).rejects.toThrow(/permission denied/);
  });

  it("cannot register a business in someone else's name", async () => {
    const newcomer = await createUser(db, "nuevo@example.com");
    const insert = db.user(newcomer, (tx) =>
      tx.query(
        "insert into public.businesses (owner_id, slug, name) values ($1, 'ajeno', 'Ajeno')",
        [a.ownerId],
      ),
    );
    await expect(insert).rejects.toThrow(/row-level security/);
  });

  it("can own only one business", async () => {
    const second = db.user(a.ownerId, (tx) =>
      tx.query("insert into public.businesses (slug, name) values ('segundo', 'Segundo')"),
    );
    await expect(second).rejects.toMatchObject({ code: "23505" }); // unique_violation
  });

  it("must use a URL-friendly slug", async () => {
    const newcomer = await createUser(db, "slug@example.com");
    const insert = db.user(newcomer, (tx) =>
      tx.query("insert into public.businesses (slug, name) values ('Mi Negocio!', 'Mi negocio')"),
    );
    await expect(insert).rejects.toMatchObject({ code: "23514" }); // check_violation
  });
});

describe("exposed API schema", () => {
  it("has no SECURITY DEFINER functions (elevated code lives in `private`)", async () => {
    const { rows } = await db.admin((tx) =>
      tx.query<{ proname: string }>(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prosecdef`,
      ),
    );
    expect(rows).toEqual([]);
  });

  it("enables row level security on every table", async () => {
    const { rows } = await db.admin((tx) =>
      tx.query<{ relname: string }>(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      ),
    );
    expect(rows).toEqual([]);
  });
});
