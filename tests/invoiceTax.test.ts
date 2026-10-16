import { describe, it, expect } from "vitest";
import { taxBreakdown } from "@/lib/invoiceTax";

describe("PPN: harga sudah termasuk PPN", () => {
  it("tanpa PPN: tidak ada perubahan", () => {
    const r = taxBreakdown([{ qty: 2, unit_price: 100000 }], 0);
    expect(r).toMatchObject({ dpp: 200000, ppn: 0, total: 200000, withTax: false });
    expect(r.lines[0].unit_excl).toBe(100000);
  });
  it("dengan PPN 11%: harga ditampilkan tanpa PPN, DPP + PPN = total", () => {
    const r = taxBreakdown([{ qty: 1, unit_price: 111000 }], 11);
    expect(r.lines[0]).toMatchObject({ total_incl: 111000, total_excl: 100000, unit_excl: 100000 });
    expect(r).toMatchObject({ dpp: 100000, ppn: 11000, total: 111000, withTax: true });
  });
  it("contoh invoice nyata (total Rp5.001.000): PPN ≈ 495 ribu, bukan 550 ribu", () => {
    const items = [
      { qty: 1, unit_price: 399000 }, { qty: 1, unit_price: 399000 }, { qty: 1, unit_price: 399000 }, { qty: 3, unit_price: 499000 },
      { qty: 1, unit_price: 239000 }, { qty: 2, unit_price: 239000 }, { qty: 2, unit_price: 239000 },
      { qty: 3, unit_price: 139000 }, { qty: 1, unit_price: 139000 }, { qty: 4, unit_price: 139000 },
    ];
    const r = taxBreakdown(items, 11);
    expect(r.total).toBe(5001000);
    expect(r.dpp + r.ppn).toBe(5001000);
    expect(Math.abs(r.ppn - Math.round((5001000 * 11) / 111))).toBeLessThanOrEqual(5); // ≈ 495.6 ribu
  });
  it("harga satuan tanpa PPN bisa berdesimal; total baris bulat", () => {
    const r = taxBreakdown([{ qty: 3, unit_price: 399000 }], 11);
    expect(r.lines[0].total_excl).toBe(1078378);
    expect(r.lines[0].unit_excl).toBeCloseTo(359459.33, 1);
  });
});
