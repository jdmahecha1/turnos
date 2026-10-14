import { describe, expect, it } from "vitest";

import { formatCOP, formatDuration, formatTime, groupByDay, localDate, upcomingDays } from "./time";

describe("localDate", () => {
  it("uses the business timezone, not UTC", () => {
    // 02:00 UTC on the 15th is still 21:00 on the 14th in Bogotá
    expect(localDate(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14");
  });
});

describe("upcomingDays", () => {
  it("starts today in Bogotá and labels the first two days", () => {
    const days = upcomingDays(3, new Date("2026-10-15T02:00:00Z"));
    expect(days.map((d) => d.date)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(days[0].label).toBe("Hoy");
    expect(days[1].label).toBe("Mañana");
    expect(days[0].weekday).toBe(3); // Wednesday
    expect(upcomingDays(3, new Date("2026-10-15T02:00:00Z"))[2].label).toMatch(/^Vie/);
  });
});

describe("formatting", () => {
  it("shows times in 12-hour format for Colombia", () => {
    expect(formatTime("2026-10-14T15:30:00Z")).toMatch(/^10:30\sa\.\s?m\.$/);
  });

  it("formats Colombian pesos without decimals", () => {
    expect(formatCOP(25000).replace(/\s/g, " ")).toBe("$ 25.000");
  });

  it("formats durations", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
  });
});

describe("groupByDay", () => {
  it("groups by local day, keeping order", () => {
    const items = [
      { id: 1, starts_at: "2026-10-14T13:00:00Z" },
      { id: 2, starts_at: "2026-10-15T01:00:00Z" }, // 20:00 on the 14th in Bogotá
      { id: 3, starts_at: "2026-10-15T14:00:00Z" },
    ];
    expect(groupByDay(items)).toEqual([
      { date: "2026-10-14", items: [items[0], items[1]] },
      { date: "2026-10-15", items: [items[2]] },
    ]);
  });
});
