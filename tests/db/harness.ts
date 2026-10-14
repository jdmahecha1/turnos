import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

export type Tx = Transaction;

/**
 * A fresh in-memory Postgres with the real migrations applied, plus helpers to run
 * queries as the same roles Supabase uses (anon / authenticated user / admin).
 */
export async function createTestDb() {
  const pg = await PGlite.create({ extensions: { btree_gist } });
  await pg.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  async function asRole<T>(role: string, userId: string | null, fn: (tx: Tx) => Promise<T>) {
    return pg.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      return fn(tx);
    });
  }

  return {
    pg,
    /** Superuser: bypasses RLS, used to arrange test data. */
    admin: <T>(fn: (tx: Tx) => Promise<T>) => pg.transaction(fn),
    anon: <T>(fn: (tx: Tx) => Promise<T>) => asRole("anon", null, fn),
    user: <T>(userId: string, fn: (tx: Tx) => Promise<T>) => asRole("authenticated", userId, fn),
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Today's date in Bogotá plus `days`, as YYYY-MM-DD. */
export function bogotaDate(days: number): string {
  const now = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

/** A Bogotá wall-clock time on `day` as an ISO instant (Bogotá is UTC-5, no DST). */
export function bogotaInstant(day: string, time: string): string {
  return new Date(`${day}T${time}:00-05:00`).toISOString();
}

export async function createUser(db: TestDb, email: string): Promise<string> {
  const { rows } = await db.admin((tx) =>
    tx.query<{ id: string }>(
      "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id",
      [email],
    ),
  );
  return rows[0].id;
}

/**
 * An owner with a business open every day 08:00-18:00 and a 30-minute service,
 * created through the owner's own session so RLS insert policies are exercised.
 */
export async function createBusiness(db: TestDb, slug: string) {
  const ownerId = await createUser(db, `${slug}@example.com`);
  return db.user(ownerId, async (tx) => {
    const business = await tx.query<{ id: string }>(
      "insert into public.businesses (slug, name) values ($1, $2) returning id",
      [slug, `Negocio ${slug}`],
    );
    const businessId = business.rows[0].id;
    const service = await tx.query<{ id: string }>(
      `insert into public.services (business_id, name, duration_minutes, price_cop)
       values ($1, 'Corte de cabello', 30, 25000) returning id`,
      [businessId],
    );
    await tx.query(
      `insert into public.working_hours (business_id, weekday, opens_at, closes_at)
       select $1, d, '08:00', '18:00' from generate_series(0, 6) d`,
      [businessId],
    );
    return { ownerId, businessId, serviceId: service.rows[0].id, slug };
  });
}

export async function slots(db: TestDb, slug: string, serviceId: string, day: string) {
  const { rows } = await db.anon((tx) =>
    tx.query<{ starts_at: Date }>("select starts_at from public.available_slots($1, $2, $3)", [
      slug,
      serviceId,
      day,
    ]),
  );
  return rows.map((r) => new Date(r.starts_at).toISOString());
}

export async function book(
  db: TestDb,
  slug: string,
  serviceId: string,
  startsAt: string,
  customer = { name: "Laura Gómez", phone: "3001234567" },
) {
  const { rows } = await db.anon((tx) =>
    tx.query<{ id: string }>("select public.book_appointment($1, $2, $3, $4, $5) as id", [
      slug,
      serviceId,
      startsAt,
      customer.name,
      customer.phone,
    ]),
  );
  return rows[0].id;
}
