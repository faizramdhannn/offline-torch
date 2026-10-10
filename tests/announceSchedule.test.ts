import { describe, it, expect } from "vitest";
import { isDue, wibParts, type AnnounceRule } from "@/lib/announceSchedule";

const base: AnnounceRule = {
  id: 1, name: "t", text: "x", seconds: 30, all_stores: true, user_names: [], recurrence: "daily",
  days: "", day_of_month: null, run_date: "", time_min: 20 * 60 + 45, start_date: "", end_date: "", active: true,
};
// 2026-10-09 (Jumat) 20:45 WIB = 13:45 UTC
const at = (hhmmUtc: string, date = "2026-10-09") => new Date(`${date}T${hhmmUtc}:00Z`);

describe("pengumuman terjadwal", () => {
  it("wibParts: tanggal, hari, menit WIB (lintas tengah malam UTC)", () => {
    const w = wibParts(at("17:30", "2026-10-09")); // 00:30 WIB 10 Okt (Sabtu)
    expect(w.ymd).toBe("2026-10-10");
    expect(w.day).toBe(6);
    expect(w.min).toBe(30);
  });
  it("harian: tepat jam & toleransi 2 menit, lewat itu dilewati", () => {
    expect(isDue(base, at("13:45"))).toBe(true);
    expect(isDue(base, at("13:46"))).toBe(true);
    expect(isDue(base, at("13:47"))).toBe(false);
    expect(isDue(base, at("13:44"))).toBe(false);
  });
  it("sekali: hanya pada tanggalnya", () => {
    const r = { ...base, recurrence: "once" as const, run_date: "2026-10-09" };
    expect(isDue(r, at("13:45"))).toBe(true);
    expect(isDue(r, at("13:45", "2026-10-10"))).toBe(false);
  });
  it("mingguan: hanya hari yang dipilih (Jumat = 5)", () => {
    expect(isDue({ ...base, recurrence: "weekly", days: "1,5" }, at("13:45"))).toBe(true);
    expect(isDue({ ...base, recurrence: "weekly", days: "1,2" }, at("13:45"))).toBe(false);
  });
  it("bulanan: tanggal tertentu, tanggal 31 jatuh ke hari terakhir bulan pendek", () => {
    expect(isDue({ ...base, recurrence: "monthly", day_of_month: 9 }, at("13:45"))).toBe(true);
    expect(isDue({ ...base, recurrence: "monthly", day_of_month: 10 }, at("13:45"))).toBe(false);
    expect(isDue({ ...base, recurrence: "monthly", day_of_month: 31 }, at("13:45", "2026-11-30"))).toBe(true); // Nov 30 hari
  });
  it("rentang berlaku & nonaktif", () => {
    expect(isDue({ ...base, start_date: "2026-10-10" }, at("13:45"))).toBe(false);
    expect(isDue({ ...base, end_date: "2026-10-08" }, at("13:45"))).toBe(false);
    expect(isDue({ ...base, end_date: "2026-10-09" }, at("13:45"))).toBe(true);
    expect(isDue({ ...base, active: false }, at("13:45"))).toBe(false);
  });
});
