import { describe, it, expect } from "vitest";
import { parseIdDateTime } from "../lib/idDate";

describe("parseIdDateTime", () => {
  it("bulan Indonesia terbaca & urut benar", () => {
    const a = parseIdDateTime("12 Jun 2026, 17.58.43");
    const b = parseIdDateTime("3 Agu 2026, 09.00.00");
    const c = parseIdDateTime("5 Okt 2026, 09.03.01");
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b);
    expect(parseIdDateTime("1 Des 2026, 00.00.00")).toBeGreaterThan(c);
    expect(parseIdDateTime("20 Mei 2026, 10.00.00")).toBeLessThan(a);
  });
  it("detik/jam opsional & format lain", () => {
    expect(parseIdDateTime("5 Okt 2026")).toBe(new Date(2026, 9, 5).getTime());
    expect(parseIdDateTime("2026-10-05T09:03:01")).toBeGreaterThan(0);
    expect(parseIdDateTime("")).toBe(0);
    expect(parseIdDateTime("bukan tanggal")).toBe(0);
  });
});
