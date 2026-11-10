import { describe, expect, it } from "vitest";
import { codeHours, totalHours, codeOvertime, totalOvertime, monthDates, weekSlotOf, monthsCovered, dateRangeDates, visiblePeriods, visibleMonths } from "../components/attendance/utils";

describe("jam kerja attendance", () => {
  it("jam per kode", () => {
    const hours = { P: 8, S: 8, M: 8, MF: 10, F: 12, O: 0, C: 0, "+": 0, I: 0, A: 0 } as Record<string, number>;
    for (const [code, h] of Object.entries(hours)) expect(codeHours(code, "Torch Lembong")).toBe(h);
  });

  it("Full 13 jam di Karawang, Purwokerto, Jogja (tanpa peduli huruf besar/kecil)", () => {
    expect(codeHours("F", "Torch Karawang")).toBe(13);
    expect(codeHours("F", "TORCH PURWOKERTO")).toBe(13);
    expect(codeHours("F", "Torch Jogja")).toBe(13);
    expect(codeHours("MF", "Torch Karawang")).toBe(10); // hanya F yang 13
  });

  it("kode kosong / tak dikenal = 0, huruf kecil & spasi tetap dibaca", () => {
    expect(codeHours("", "Torch X")).toBe(0);
    expect(codeHours(undefined, "Torch X")).toBe(0);
    expect(codeHours("Z", "Torch X")).toBe(0);
    expect(codeHours(" p ", "Torch X")).toBe(8);
  });

  it("total seminggu", () => {
    expect(totalHours(["P", "S", "F", "MF", "O", "C", ""], "Torch Lembong")).toBe(8 + 8 + 12 + 10);
    expect(totalHours(["F", "F", "F", "F", "F", "O", "O"], "Torch Karawang")).toBe(65);
  });

  it("lembur terjadwal: MF 2, F 4 (5 di Karawang/Purwokerto/Jogja), lainnya 0", () => {
    for (const c of ["P", "S", "M", "O", "C", "+", "I", "A", ""]) expect(codeOvertime(c, "Torch Lembong")).toBe(0);
    expect(codeOvertime("MF", "Torch Lembong")).toBe(2);
    expect(codeOvertime("MF", "Torch Karawang")).toBe(2);
    expect(codeOvertime("F", "Torch Lembong")).toBe(4);
    expect(codeOvertime("F", "Torch Purwokerto")).toBe(5);
    expect(codeOvertime("F", "Torch Jogja")).toBe(5);
  });

  it("total lembur seminggu", () => {
    expect(totalOvertime(["P", "S", "F", "MF", "O", "M", "F"], "Torch Lembong")).toBe(4 + 2 + 4);
    expect(totalOvertime(["F", "F", "MF", "O", "O", "O", "O"], "Torch Karawang")).toBe(5 + 5 + 2);
  });

  it("jadwal bulanan: tanggal → minggu & hari ke-n", () => {
    const dl = [
      { id: "1", date_range: "26 Okt - 1 Nov", week_start: "2026-10-26", week_end: "2026-11-01" },
      { id: "2", date_range: "2 Nov - 8 Nov", week_start: "2026-11-02", week_end: "2026-11-08" },
    ];
    expect(monthDates("2026-11")).toHaveLength(30);
    expect(weekSlotOf(new Date(2026, 10, 1), dl)).toEqual({ dateRange: "26 Okt - 1 Nov", dayIndex: 6 });
    expect(weekSlotOf(new Date(2026, 10, 2), dl)).toEqual({ dateRange: "2 Nov - 8 Nov", dayIndex: 0 });
    expect(weekSlotOf(new Date(2026, 10, 20), dl)).toBeNull();
    expect(monthsCovered(dl)).toEqual(["2026-11", "2026-10"]);
  });

  it("rentang tanggal kustom (mis. 26 Okt – 25 Nov)", () => {
    const r = dateRangeDates("2026-10-26", "2026-11-25");
    expect(r).toHaveLength(31);
    expect([r[0].getMonth(), r[0].getDate()]).toEqual([9, 26]);
    expect([r[30].getMonth(), r[30].getDate()]).toEqual([10, 25]);
    expect(dateRangeDates("2026-11-25", "2026-10-26")).toHaveLength(31); // terbalik ditukar
    expect(dateRangeDates("", "2026-11-25")).toEqual([]);
    expect(dateRangeDates("2026-01-01", "2026-12-31")).toHaveLength(93); // dibatasi
  });

  it("filter periode: yang lebih dari 2 bulan lalu disembunyikan", () => {
    const now = new Date(2026, 10, 10); // 10 Nov 2026 → batas 10 Sep 2026
    const dl = [
      { id: "1", date_range: "AGU", week_start: "2026-08-24", week_end: "2026-08-30" },
      { id: "2", date_range: "SEP-AWAL", week_start: "2026-09-07", week_end: "2026-09-13" },
      { id: "3", date_range: "OKT", week_start: "2026-10-19", week_end: "2026-10-25" },
      { id: "4", date_range: "RUSAK", week_start: "", week_end: "" },
    ];
    expect(visiblePeriods(dl, "", now).map((x) => x.date_range)).toEqual(["SEP-AWAL", "OKT", "RUSAK"]);
    expect(visiblePeriods(dl, "AGU", now).map((x) => x.date_range)).toEqual(["AGU", "SEP-AWAL", "OKT", "RUSAK"]); // pilihan aktif tetap tampil
    expect(visibleMonths(["2026-12", "2026-11", "2026-10", "2026-09", "2026-08"], now)).toEqual(["2026-12", "2026-11", "2026-10", "2026-09"]);
  });
});
