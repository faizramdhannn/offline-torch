import { describe, it, expect } from "vitest";
import { windowRows } from "../lib/rowWindow";

describe("windowRows", () => {
  const now = new Date(2026, 9, 21).getTime();
  const rows = [
    { id: 1, d: "20 Okt 2026, 10.00.00", done: true },
    { id: 2, d: "1 Jan 2026, 10.00.00", done: true },
    { id: 3, d: "1 Jan 2026, 10.00.00", done: false },
    { id: 4, d: "", done: true },
  ];
  it("jendela 120 hari + baris belum selesai + tanggal tak terbaca", () => {
    const r = windowRows(rows, false, { dateOf: (x) => x.d, keep: (x) => !x.done, now });
    expect(r.map((x) => x.id)).toEqual([1, 3, 4]);
  });
  it("all=1 → semua", () => {
    expect(windowRows(rows, true, { dateOf: (x) => x.d, now })).toHaveLength(4);
  });
});
