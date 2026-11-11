import { describe, expect, it } from "vitest";
import { buildBulkReport, buildBulkRows, canSeeBulkRow, fmtCompactRp, groupBulkRows, masterFromRows, parsePrice, summarizeGroup, toBulkRow, validateBulkInput, type BulkInput } from "../lib/bulkOrder";

const master = masterFromRows([
  { SKU: "TUCGW615600RB", Product_name: "Nexus Backpack", Category: "Backpack", HPJ: "Rp1.079.200", reason_buy: "Harga bagus", reason_not_buy: "Terlalu mahal" },
  { SKU: "SKU2", Product_name: "Travi Pouch", Category: "Travel Pouch", HPJ: "269000", reason_buy: "Kualitas", reason_not_buy: "Stok kosong" },
  { SKU: "", Product_name: "", Category: "", HPJ: "", reason_buy: "Harga bagus", reason_not_buy: "" }, // duplikat/kosong diabaikan
]);

const base: BulkInput = {
  source_store: "Torch Cirebon", customer_name: "Budi", customer_institution: "PT Maju", customer_phone: "0812-3456-7890",
  reason_buy: "Harga bagus", sales_order: "SO-1", note: "bulk 50 pcs",
  items: [{ item_code: "tucgw615600rb", item_qty: "10" }, { item_code: "SKU2", item_qty: 5 }],
};

describe("master bulk", () => {
  it("harga & daftar alasan unik", () => {
    expect(parsePrice("Rp1.079.200")).toBe(1079200);
    expect(master.items).toHaveLength(2);
    expect(master.reasonBuy).toEqual(["Harga bagus", "Kualitas"]);
    expect(master.reasonNotBuy).toEqual(["Terlalu mahal", "Stok kosong"]);
  });
});

describe("validasi input bulk", () => {
  it("valid: SKU tidak peka huruf, nama/kategori/harga dari master, HP jadi 62", () => {
    const r = validateBulkInput(base, master);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.phone).toBe("6281234567890");
    expect(r.value.items[0].master.product_name).toBe("Nexus Backpack");
    expect(r.value.items[0].qty).toBe(10);
  });

  it("reason buy terisi → sales order wajib", () => {
    const r = validateBulkInput({ ...base, sales_order: "  " }, master);
    expect(r).toEqual({ ok: false, error: "Sales Order wajib diisi bila Reason Buy dipilih" });
  });

  it("reason not buy tidak butuh sales order; harus salah satu saja", () => {
    expect(validateBulkInput({ ...base, reason_buy: "", reason_not_buy: "Terlalu mahal", sales_order: "" }, master).ok).toBe(true);
    expect(validateBulkInput({ ...base, reason_not_buy: "Terlalu mahal" }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, reason_buy: "", reason_not_buy: "" }, master).ok).toBe(false);
  });

  it("alasan harus ada di master; SKU & qty divalidasi", () => {
    expect(validateBulkInput({ ...base, reason_buy: "Asal ketik" }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, items: [{ item_code: "XXX", item_qty: 1 }] }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, items: [{ item_code: "SKU2", item_qty: 0 }] }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, items: [] }, master).ok).toBe(false);
  });

  it("customer & telepon wajib, institusi opsional", () => {
    expect(validateBulkInput({ ...base, customer_name: "" }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, customer_phone: "123" }, master).ok).toBe(false);
    expect(validateBulkInput({ ...base, customer_institution: "" }, master).ok).toBe(true);
    expect(validateBulkInput({ ...base, source_store: "" }, master).ok).toBe(false);
  });
});

describe("baris sheet & pengelompokan", () => {
  it("satu input = beberapa baris ber-id sama dengan data customer disalin", () => {
    const r = validateBulkInput(base, master);
    if (!r.ok) throw new Error("x");
    const rows = buildBulkRows("uuid-1", r.value, "11 Nov 2026, 09.00.00", "cirebon");
    expect(rows).toHaveLength(2);
    expect(rows.every((x) => x[0] === "uuid-1" && x[7] === "Budi" && x[9] === "6281234567890" && x[12] === "SO-1")).toBe(true);
    expect(rows[0].slice(2, 7)).toEqual(["TUCGW615600RB", "Nexus Backpack", "Backpack", 10, 1079200]); // qty & harga berupa angka
    expect(rows[0]).toHaveLength(18);
    expect(rows[0].slice(14)).toEqual(["11 Nov 2026, 09.00.00", "cirebon", "11 Nov 2026, 09.00.00", "cirebon"]); // update_* = created_* saat dibuat
  });

  it("grup: total qty & nilai", () => {
    const r = validateBulkInput(base, master);
    if (!r.ok) throw new Error("x");
    const cols = ["id","source_store","item_code","item_name","item_category","item_qty","item_price","customer_name","customer_institution","customer_phone_number","reason_buy","reason_not_buy","sales_order","note","created_at","created_by"];
    const objs = buildBulkRows("u", r.value, "t", "me").map((row) => toBulkRow(Object.fromEntries(cols.map((c, i) => [c, row[i]]))));
    const g = groupBulkRows(objs);
    expect(g).toHaveLength(1);
    expect(g[0].total_qty).toBe(15);
    expect(g[0].total_value).toBe(10 * 1079200 + 5 * 269000);
  });

  it("ringkasan 1 baris per input: kode ';', nama/kategori 'n x ...', qty & nilai dijumlah", () => {
    const m2 = masterFromRows([
      { SKU: "A1", Product_name: "Tas A", Category: "Backpack", HPJ: "100000", reason_buy: "X", reason_not_buy: "Y" },
      { SKU: "A2", Product_name: "Tas B", Category: "Backpack", HPJ: "50000", reason_buy: "", reason_not_buy: "" },
      { SKU: "P1", Product_name: "Pouch", Category: "Travel Pouch", HPJ: "20000", reason_buy: "", reason_not_buy: "" },
    ]);
    const r = validateBulkInput({ ...base, reason_buy: "X", items: [{ item_code: "A1", item_qty: 2 }, { item_code: "A2", item_qty: 3 }, { item_code: "P1", item_qty: 4 }] }, m2);
    if (!r.ok) throw new Error(r.error);
    const cols = ["id","source_store","item_code","item_name","item_category","item_qty","item_price","customer_name","customer_institution","customer_phone_number","reason_buy","reason_not_buy","sales_order","note","created_at","created_by"];
    const g = groupBulkRows(buildBulkRows("u", r.value, "t", "me").map((row) => toBulkRow(Object.fromEntries(cols.map((c, i) => [c, row[i]]))))) [0];
    const s = summarizeGroup(g);
    expect(s.codes).toBe("A1;A2;P1");
    expect(s.names).toBe("2 x Tas A; 3 x Tas B; 4 x Pouch");
    expect(s.categories).toBe("5 x Backpack; 4 x Travel Pouch");
    expect(s.products).toEqual([{ code: "A1", name: "Tas A", qty: 2 }, { code: "A2", name: "Tas B", qty: 3 }, { code: "P1", name: "Pouch", qty: 4 }]);
    expect(s.categoryList).toEqual([{ category: "Backpack", qty: 5 }, { category: "Travel Pouch", qty: 4 }]);
    expect(s.qty).toBe(9);
    expect(s.value).toBe(2 * 100000 + 3 * 50000 + 4 * 20000);
  });

  it("input admin untuk toko Margonda terlihat oleh akun Margonda, bukan toko lain", () => {
    expect(canSeeBulkRow("Torch Margonda", { name: "Torch Margonda", user_name: "margonda" })).toBe(true);
    expect(canSeeBulkRow("Torch Margonda", { name: "Margonda Store", user_name: "Torch Margonda" })).toBe(true);
    expect(canSeeBulkRow("torch margonda", { name: "X", user_name: "margonda" })).toBe(true);
    expect(canSeeBulkRow("Torch Margonda", { name: "Torch Cirebon", user_name: "cirebon" })).toBe(false);
    expect(canSeeBulkRow("", { name: "Torch Margonda", user_name: "margonda" })).toBe(false);
  });

  it("report: total, closing rate, per toko, produk, tren harian terisi 0 di hari kosong", () => {
    const m2 = masterFromRows([
      { SKU: "A1", Product_name: "Tas A", Category: "Backpack", HPJ: "100000", reason_buy: "Harga", reason_not_buy: "Mahal" },
      { SKU: "P1", Product_name: "Pouch", Category: "Travel Pouch", HPJ: "20000", reason_buy: "", reason_not_buy: "" },
    ]);
    const cols = ["id","source_store","item_code","item_name","item_category","item_qty","item_price","customer_name","customer_institution","customer_phone_number","reason_buy","reason_not_buy","sales_order","note","created_at","created_by"];
    const mkGroup = (id: string, store: string, phone: string, buy: boolean, at: string, items: { item_code: string; item_qty: number }[]) => {
      const r = validateBulkInput({ source_store: store, customer_name: "C" + id, customer_phone: phone, reason_buy: buy ? "Harga" : "", reason_not_buy: buy ? "" : "Mahal", sales_order: buy ? "SO" : "", items }, m2);
      if (!r.ok) throw new Error(r.error);
      return buildBulkRows(id, r.value, at, "x").map((row) => toBulkRow(Object.fromEntries(cols.map((c, i) => [c, row[i]]))));
    };
    const groups = groupBulkRows([
      ...mkGroup("1", "Torch Cirebon", "0812111111", true, "10 Nov 2026, 09.00.00", [{ item_code: "A1", item_qty: 2 }]),
      ...mkGroup("2", "Torch Margonda", "0812222222", false, "12 Nov 2026, 10.00.00", [{ item_code: "P1", item_qty: 5 }, { item_code: "A1", item_qty: 1 }]),
      ...mkGroup("3", "Torch Cirebon", "0812111111", true, "12 Nov 2026, 11.00.00", [{ item_code: "A1", item_qty: 3 }]),
    ]);
    const r = buildBulkReport(groups);
    expect(r.totals).toMatchObject({ inputs: 3, customers: 2, qty: 11, value: 2 * 100000 + (5 * 20000 + 100000) + 3 * 100000, buy: 2, notBuy: 1, closingRate: 66.7 });
    expect(r.byStore[0]).toMatchObject({ store: "Torch Cirebon", inputs: 2, buy: 2, value: 500000 });
    expect(r.topProducts[0]).toMatchObject({ code: "A1", qty: 6 });
    expect(r.byCategory.map((c) => c.category)).toEqual(["Backpack", "Travel Pouch"]);
    expect(r.reasonBuy).toEqual([{ name: "Harga", count: 2 }]);
    expect(r.trendUnit).toBe("day");
    expect(r.trend.map((t) => [t.label, t.inputs])).toEqual([["10 Nov", 1], ["11 Nov", 0], ["12 Nov", 2]]);
    expect(r.topCustomers[0]).toMatchObject({ name: "C1", inputs: 2 });
  });

  it("format rupiah ringkas", () => {
    expect(fmtCompactRp(26054000)).toBe("Rp 26,1 jt");
    expect(fmtCompactRp(1250000000)).toBe("Rp 1,25 M");
    expect(fmtCompactRp(85000)).toBe("Rp 85 rb");
    expect(fmtCompactRp(500)).toBe("Rp 500");
  });

  it("report: input dengan Sales Order tapi tanpa Reason Buy (data impor) tetap dihitung beli", () => {
    const cols = ["id","source_store","item_code","item_name","item_category","item_qty","item_price","customer_name","customer_institution","customer_phone_number","reason_buy","reason_not_buy","sales_order","note","created_at","created_by"];
    const row = (id: string, rb: string, rn: string, so: string) => toBulkRow(Object.fromEntries(cols.map((c, i) => [c, ["" + id, "Torch X", "S1", "Tas", "Backpack", "6", "10000", "C", "", "6281", rb, rn, so, "", "10 Nov 2026, 09.00.00", "system"][i]])));
    const r = buildBulkReport(groupBulkRows([row("a", "", "", "#1"), row("b", "", "Stock Kosong", ""), row("c", "Keperluan Pribadi", "", "SO"), row("d", "", "", "")]));
    expect(r.totals).toMatchObject({ inputs: 4, buy: 2, notBuy: 1 }); // d (belum ada SO/alasan) tidak dihitung beli
  });
});
