import { describe, expect, it } from "vitest";

import { friendlyError } from "./errors";
import { bookingSchema, businessSchema, hoursSchema, phoneSchema, slugify } from "./validation";

describe("slugify", () => {
  it("builds URL-friendly slugs from Spanish names", () => {
    expect(slugify("Barbería El Parche")).toBe("barberia-el-parche");
    expect(slugify("  Spa & Uñas  Ñoño!! ")).toBe("spa-unas-nono");
  });
});

describe("businessSchema", () => {
  it("accepts a valid business", () => {
    expect(businessSchema.parse({ name: "Mi Spa", slug: "Mi-Spa" })).toEqual({
      name: "Mi Spa",
      slug: "mi-spa",
    });
  });

  it.each(["ab", "con espacios", "-guion", "panel", "doble--guion"])("rejects slug %j", (slug) => {
    expect(businessSchema.safeParse({ name: "Negocio", slug }).success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("strips spaces, dashes and parentheses", () => {
    expect(phoneSchema.parse("+57 (300) 123-4567")).toBe("+573001234567");
  });

  it.each(["123", "abc1234567", "+57 300 123 4567 8901 23"])("rejects %j", (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });
});

describe("bookingSchema", () => {
  const valid = {
    slug: "barberia",
    serviceId: "7f3c0f6e-2c1a-4b7e-9a35-1d2f3e4a5b6c",
    startsAt: "2026-10-20T15:00:00.000Z",
    name: " Laura ",
    phone: "300 123 4567",
  };

  it("parses and normalizes a booking", () => {
    expect(bookingSchema.parse(valid)).toMatchObject({ name: "Laura", phone: "3001234567" });
  });

  it("requires a real UUID and an ISO date", () => {
    expect(bookingSchema.safeParse({ ...valid, serviceId: "1" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...valid, startsAt: "mañana" }).success).toBe(false);
  });
});

describe("hoursSchema", () => {
  it("rejects closing before opening", () => {
    const result = hoursSchema.safeParse([{ weekday: 1, opensAt: "18:00", closesAt: "08:00" }]);
    expect(result.success).toBe(false);
  });
});

describe("friendlyError", () => {
  it("translates booking errors raised by the database", () => {
    expect(friendlyError({ message: "slot_unavailable" })).toMatch(/ya no está disponible/);
    expect(friendlyError({ code: "42501", message: "permission denied" })).toMatch(/permiso/);
    expect(friendlyError(null, "fallback")).toBe("fallback");
  });
});
