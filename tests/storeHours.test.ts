import { describe, it, expect } from "vitest";
import { DEFAULT_HOURS, isOpenNow, normalizeHours, type StoreHours } from "@/lib/storeHours";

// 2026-10-09 (Jumat) 20:45 WIB = 13:45 UTC ; 2026-10-09 23:30 WIB = 16:30 UTC
const t = (hhUtc: string, date = "2026-10-09") => new Date(`${date}T${hhUtc}:00Z`);

describe("jam buka toko", () => {
  it("bawaan 09–22 setiap hari", () => {
    expect(isOpenNow(undefined, t("13:45"))).toBe(true);   // 20:45 WIB
    expect(isOpenNow(undefined, t("16:30"))).toBe(false);  // 23:30 WIB
    expect(isOpenNow(undefined, t("01:00"))).toBe(false);  // 08:00 WIB
  });
  it("hari tertentu tutup & jam berbeda per hari", () => {
    const h: StoreHours = { ...DEFAULT_HOURS, weekly: DEFAULT_HOURS.weekly.map((d, i) => (i === 5 ? null : d)) }; // Jumat tutup
    expect(isOpenNow(h, t("13:45"))).toBe(false);
    expect(isOpenNow(h, t("13:45", "2026-10-10"))).toBe(true); // Sabtu
    const h2: StoreHours = { ...DEFAULT_HOURS, weekly: DEFAULT_HOURS.weekly.map((d, i) => (i === 5 ? { open: 600, close: 1260 } : d)) };
    expect(isOpenNow(h2, t("13:45"))).toBe(true);  // 20:45 < 21:00
    expect(isOpenNow(h2, t("14:30"))).toBe(false); // 21:30 ≥ 21:00
  });
  it("hari libur khusus menimpa jam mingguan", () => {
    expect(isOpenNow({ ...DEFAULT_HOURS, closed_dates: ["2026-10-09"] }, t("13:45"))).toBe(false);
  });
  it("normalizeHours menolak data rusak", () => {
    expect(normalizeHours({ weekly: [], closed_dates: [] })).toBeNull();
    expect(normalizeHours({ weekly: Array(7).fill({ open: 600, close: 500 }) })).toBeNull();
    expect(normalizeHours({ weekly: Array(7).fill(null), closed_dates: ["besok"] })).toBeNull();
    expect(normalizeHours({ weekly: Array(7).fill({ open: 540, close: 1320 }), closed_dates: ["2026-12-25", "2026-12-25"], follow: true }))
      .toMatchObject({ closed_dates: ["2026-12-25"], follow: true });
  });
});
