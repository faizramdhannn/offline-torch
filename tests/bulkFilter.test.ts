import { describe, expect, it } from "vitest";
import { groupBulkRows, toBulkRow } from "../lib/bulkOrder";
import { activeFilterCount, applyBulkFilters, bulkFilterOptions, emptyBulkFilters, periodRange } from "../lib/bulkFilter";

const row = (o: Record<string, any>) => toBulkRow({
  id: "a", source_store: "Torch Cirebon", item_code: "S1", item_name: "Tas A", item_category: "Backpack", item_qty: "10", item_price: "100000", item_net: "90000",
  customer_name: "Budi", customer_institution: "PT Maju", customer_phone_number: "6281", reason_buy: "", reason_not_buy: "", sales_order: "",
  note: "", created_at: "10 Nov 2026, 09.00.00", created_by: "cirebon", ...o,
});

const groups = groupBulkRows([
  row({ id: "a", reason_buy: "Harga bagus", sales_order: "SO-1" }),
  row({ id: "a", item_code: "S2", item_name: "Pouch", item_category: "Pouch", item_qty: "2" }),
  row({ id: "b", source_store: "Torch Margonda", customer_name: "Sari", customer_institution: "CV Jaya", reason_not_buy: "Terlalu mahal", created_at: "1 Okt 2026, 10.00.00", created_by: "margonda", item_qty: "30" }),
  row({ id: "c", source_store: "Torch Margonda", customer_name: "Andi", item_code: "S2", item_name: "Pouch", item_category: "Pouch", item_qty: "6", created_at: "12 Nov 2026, 08.00.00", created_by: "margonda" }),
]);
const NOW = new Date(2026, 10, 15, 12).getTime(); // 15 Nov 2026
const f = (p: Partial<ReturnType<typeof emptyBulkFilters>>) => ({ ...emptyBulkFilters(), ...p });
const ids = (gs: { id: string }[]) => gs.map((g) => g.id);

describe("filter bulk", () => {
  it("tanpa filter: semua input", () => {
    expect(ids(applyBulkFilters(groups, emptyBulkFilters()))).toEqual(["a", "b", "c"]);
    expect(activeFilterCount(emptyBulkFilters())).toBe(0);
  });
  it("multi toko, institusi, pembuat", () => {
    expect(ids(applyBulkFilters(groups, f({ stores: ["Torch Margonda"] })))).toEqual(["b", "c"]);
    expect(ids(applyBulkFilters(groups, f({ stores: ["Torch Cirebon", "Torch Margonda"] })))).toEqual(["a", "b", "c"]);
    expect(ids(applyBulkFilters(groups, f({ institutions: ["CV Jaya"] })))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ createdBy: ["cirebon"] })))).toEqual(["a"]);
  });
  it("status & SO & alasan", () => {
    expect(ids(applyBulkFilters(groups, f({ status: "buy" })))).toEqual(["a"]);
    expect(ids(applyBulkFilters(groups, f({ status: "not_buy" })))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ status: "none" })))).toEqual(["c"]);
    expect(ids(applyBulkFilters(groups, f({ hasSO: "yes" })))).toEqual(["a"]);
    expect(ids(applyBulkFilters(groups, f({ hasSO: "no" })))).toEqual(["b", "c"]);
    expect(ids(applyBulkFilters(groups, f({ reasonNotBuy: ["Terlalu mahal"] })))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ reasonBuy: ["Harga bagus"] })))).toEqual(["a"]);
  });
  it("periode: preset & custom (akhir hari ikut)", () => {
    expect(ids(applyBulkFilters(groups, f({ period: "7" }), { now: NOW }))).toEqual(["a", "c"]);
    expect(ids(applyBulkFilters(groups, f({ period: "this_month" }), { now: NOW }))).toEqual(["a", "c"]);
    expect(ids(applyBulkFilters(groups, f({ period: "last_month" }), { now: NOW }))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ period: "custom", from: "2026-10-01", to: "2026-10-01" }), { now: NOW }))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ period: "custom", from: "2026-11-11" }), { now: NOW }))).toEqual(["c"]);
    expect(periodRange({ period: "all", from: "", to: "" })).toEqual({ from: 0, to: 0 });
  });
  it("item/kategori: tabel Data menyimpan input utuh, Report menyempitkan ke item yang cocok", () => {
    const whole = applyBulkFilters(groups, f({ categories: ["Pouch"] }));
    expect(ids(whole)).toEqual(["a", "c"]);
    expect(whole[0].rows).toHaveLength(2);
    expect(whole[0].total_qty).toBe(12);
    const narrow = applyBulkFilters(groups, f({ categories: ["Pouch"] }), { narrow: true });
    expect(ids(narrow)).toEqual(["a", "c"]);
    expect(narrow[0].rows).toHaveLength(1);
    expect(narrow[0].total_qty).toBe(2);
    expect(ids(applyBulkFilters(groups, f({ items: ["S1"] }), { narrow: true }))).toEqual(["a", "b"]);
  });
  it("rentang qty & nilai pada total input", () => {
    expect(ids(applyBulkFilters(groups, f({ qtyMin: "10" })))).toEqual(["a", "b"]);
    expect(ids(applyBulkFilters(groups, f({ qtyMax: "6" })))).toEqual(["c"]);
    expect(ids(applyBulkFilters(groups, f({ valueMin: "3000000" })))).toEqual(["b"]);
  });
  it("cari teks dan gabungan filter", () => {
    expect(ids(applyBulkFilters(groups, f({ search: "sari" })))).toEqual(["b"]);
    expect(ids(applyBulkFilters(groups, f({ search: "pouch", stores: ["Torch Margonda"] })))).toEqual(["c"]);
    expect(activeFilterCount(f({ search: "x", stores: ["a"], qtyMin: "1", period: "30" }))).toBe(4);
  });
  it("pilihan dropdown diturunkan dari data", () => {
    const o = bulkFilterOptions(groups);
    expect(o.stores.map((x) => x.value)).toEqual(["Torch Cirebon", "Torch Margonda"]);
    expect(o.items.map((x) => x.value)).toEqual(["S1", "S2"]);
    expect(o.categories.map((x) => x.value)).toEqual(["Backpack", "Pouch"]);
    expect(o.reasonNotBuy.map((x) => x.value)).toEqual(["Terlalu mahal"]);
  });
});
