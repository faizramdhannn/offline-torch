// Menu Customer → Bulk (spreadsheet SPREADSHEET_BULK: tab `master_bulk` dan `raw_data`).
// Satu kali input = beberapa item dengan id (uuid) yang sama; data customer, alasan, sales order & note disalin di tiap baris.
// Murni (tanpa DB/Sheets) supaya bisa dipakai klien & dites.
import { normalizePhone } from "./profileRules";
import { normStore } from "./shipmentVisibility";
import { parseIdDateTime } from "./idDate";

// raw_data (urutan kolom sheet). created_at & created_by = tambahan di ujung kanan (disetujui pemilik).
export const BULK_COLUMNS = [
  "id", "source_store", "item_code", "item_name", "item_category", "item_qty", "item_price", "item_net",
  "customer_name", "customer_institution", "customer_phone_number", "reason_buy", "reason_not_buy",
  "sales_order", "note", "created_at", "created_by", "update_at", "update_by",
] as const;
export type BulkColumn = (typeof BULK_COLUMNS)[number];
export type BulkRow = Record<BulkColumn, string>;

export interface BulkMasterItem { sku: string; product_name: string; category: string; price: number }
export interface BulkMaster { items: BulkMasterItem[]; reasonBuy: string[]; reasonNotBuy: string[] }

const str = (v: unknown) => String(v ?? "").trim();

// "Rp269.000" / "269000" / "Rp 1.079.200" → 269000
export function parsePrice(v: unknown): number {
  const n = parseInt(str(v).replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// Sheet master: kolom SKU, Product_name, Category, HPJ (per produk) + reason_buy, reason_not_buy (daftar pilihan, tiap kolom berdiri sendiri).
export function masterFromRows(rows: any[]): BulkMaster {
  const items: BulkMasterItem[] = [];
  const seen = new Set<string>();
  const uniq = (list: string[], v: string) => { if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v); };
  const reasonBuy: string[] = [];
  const reasonNotBuy: string[] = [];
  for (const r of rows) {
    const sku = str(r.SKU ?? r.sku);
    if (sku && !seen.has(sku.toUpperCase())) {
      seen.add(sku.toUpperCase());
      items.push({ sku, product_name: str(r.Product_name ?? r.product_name), category: str(r.Category ?? r.category), price: parsePrice(r.HPJ ?? r.hpj) });
    }
    uniq(reasonBuy, str(r.reason_buy));
    uniq(reasonNotBuy, str(r.reason_not_buy));
  }
  return { items, reasonBuy, reasonNotBuy };
}

export interface BulkInput {
  source_store?: string;
  customer_name?: string;
  customer_institution?: string;
  customer_phone?: string;
  reason_buy?: string;
  reason_not_buy?: string;
  sales_order?: string;
  note?: string;
  diskon?: number | string; // persen (0–100), berlaku untuk semua item; kosong = 0
  items?: { item_code?: string; item_qty?: number | string; item_price?: number | string }[];
}

export interface BulkValid {
  source_store: string;
  customer_name: string;
  customer_institution: string;
  phone: string; // 62…
  reason_buy: string;
  reason_not_buy: string;
  sales_order: string;
  note: string;
  diskon: number; // persen
  items: { master: BulkMasterItem; qty: number; price: number }[]; // price = harga satuan gross yang dipakai (default harga master, boleh diubah)
}

const PHONE_RE = /^62\d{9,13}$/;

// Validasi sisi server (sumber kebenaran): nama/kategori/harga item SELALU diambil dari master, bukan dari klien.
export function validateBulkInput(input: BulkInput, master: BulkMaster): { ok: true; value: BulkValid } | { ok: false; error: string } {
  const source_store = str(input.source_store);
  if (!source_store) return { ok: false, error: "Toko sumber wajib diisi" };
  const customer_name = str(input.customer_name);
  if (!customer_name) return { ok: false, error: "Nama customer wajib diisi" };
  const phone = normalizePhone(input.customer_phone);
  if (!phone) return { ok: false, error: "No. telepon customer wajib diisi" };
  if (!PHONE_RE.test(phone)) return { ok: false, error: "No. telepon customer tidak valid (contoh 0812xxxxxxxx)" };

  const reason_buy = str(input.reason_buy);
  const reason_not_buy = str(input.reason_not_buy);
  if (!reason_buy && !reason_not_buy) return { ok: false, error: "Pilih Reason Buy atau Reason Not Buy" };
  if (reason_buy && reason_not_buy) return { ok: false, error: "Isi salah satu saja: Reason Buy atau Reason Not Buy" };
  const inList = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());
  const canon = (list: string[], v: string) => list.find((x) => x.toLowerCase() === v.toLowerCase()) ?? v;
  if (reason_buy && !inList(master.reasonBuy, reason_buy)) return { ok: false, error: "Reason Buy tidak ada di master" };
  if (reason_not_buy && !inList(master.reasonNotBuy, reason_not_buy)) return { ok: false, error: "Reason Not Buy tidak ada di master" };
  const sales_order = str(input.sales_order);
  if (reason_buy && !sales_order) return { ok: false, error: "Sales Order wajib diisi bila Reason Buy dipilih" };

  const diskonRaw = String(input.diskon ?? "").replace(",", ".").trim();
  const diskon = diskonRaw === "" ? 0 : Number(diskonRaw);
  if (!isFinite(diskon) || diskon < 0 || diskon > 100) return { ok: false, error: "Diskon harus antara 0 dan 100 persen" };

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) return { ok: false, error: "Tambahkan minimal satu item" };
  const bySku = new Map(master.items.map((i) => [i.sku.toUpperCase(), i]));
  const items: BulkValid["items"] = [];
  for (const it of rawItems) {
    const code = str(it.item_code).toUpperCase();
    const m = bySku.get(code);
    if (!m) return { ok: false, error: `SKU ${str(it.item_code) || "(kosong)"} tidak ada di master` };
    const qty = Number(String(it.item_qty ?? "").replace(/[^\d]/g, ""));
    if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: `Qty ${m.sku} harus angka lebih dari 0` };
    // Harga satuan: boleh diisi/diubah per item; kosong → harga master (HPJ).
    const priceRaw = String(it.item_price ?? "").replace(/[^\d]/g, "");
    const price = priceRaw === "" ? m.price : parseInt(priceRaw, 10);
    if (!(price > 0)) return { ok: false, error: `Harga ${m.sku} harus lebih dari 0` };
    items.push({ master: m, qty, price });
  }

  return {
    ok: true,
    value: {
      source_store,
      customer_name,
      customer_institution: str(input.customer_institution),
      phone,
      reason_buy: reason_buy ? canon(master.reasonBuy, reason_buy) : "",
      reason_not_buy: reason_not_buy ? canon(master.reasonNotBuy, reason_not_buy) : "",
      sales_order,
      note: str(input.note),
      diskon,
      items,
    },
  };
}

/** Harga satuan setelah diskon persen (dibulatkan ke rupiah). */
export const netPrice = (gross: number, diskonPct: number) => Math.round(gross * (1 - diskonPct / 100));

// Satu baris sheet per item (urutan = BULK_COLUMNS). item_qty & item_price ditulis sebagai ANGKA (bukan teks) supaya bisa dijumlah di Sheets.
export function buildBulkRows(
  id: string, v: BulkValid, createdAt: string, createdBy: string, updatedAt: string = createdAt, updatedBy: string = createdBy
): (string | number)[][] {
  return v.items.map(({ master, qty, price }) => [
    id, v.source_store, master.sku, master.product_name, master.category, qty, price,
    netPrice(price, v.diskon),
    v.customer_name, v.customer_institution, v.phone, v.reason_buy, v.reason_not_buy, v.sales_order, v.note, createdAt, createdBy, updatedAt, updatedBy,
  ]);
}

export interface BulkGroup {
  id: string;
  source_store: string;
  customer_name: string;
  customer_institution: string;
  customer_phone_number: string;
  reason_buy: string;
  reason_not_buy: string;
  sales_order: string;
  note: string;
  created_at: string;
  created_by: string;
  update_at: string;
  update_by: string;
  rows: BulkRow[];
  total_qty: number;
  total_value: number; // gross: jumlah × harga normal
  total_net: number; // net: jumlah × harga setelah diskon (item_net; kosong → sama dengan gross)
}

// Kelompokkan baris per id (urutan kemunculan pertama dipertahankan); data customer diambil dari baris pertama.
export function groupBulkRows(rows: BulkRow[]): BulkGroup[] {
  const map = new Map<string, BulkGroup>();
  for (const r of rows) {
    if (!r.id) continue;
    let g = map.get(r.id);
    if (!g) {
      g = {
        id: r.id, source_store: r.source_store, customer_name: r.customer_name, customer_institution: r.customer_institution,
        customer_phone_number: r.customer_phone_number, reason_buy: r.reason_buy, reason_not_buy: r.reason_not_buy,
        sales_order: r.sales_order, note: r.note, created_at: r.created_at, created_by: r.created_by, update_at: r.update_at, update_by: r.update_by,
        rows: [], total_qty: 0, total_value: 0, total_net: 0,
      };
      map.set(r.id, g);
    }
    g.rows.push(r);
    const qty = parseInt(r.item_qty, 10) || 0;
    g.total_qty += qty;
    g.total_value += qty * parsePrice(r.item_price);
    g.total_net += qty * (r.item_net ? parsePrice(r.item_net) : parsePrice(r.item_price));
  }
  return [...map.values()];
}

// Baris sheet (objek berdasarkan header) → BulkRow dengan semua kolom berupa string.
export function toBulkRow(o: any): BulkRow {
  const r = {} as BulkRow;
  for (const c of BULK_COLUMNS) r[c] = str(o?.[c]);
  return r;
}

// Ringkasan satu input untuk tabel (1 baris per input): kode dipisah ";", nama & kategori berbentuk "<jumlah> x <teks>"
// (kategori yang sama digabung & dijumlah), qty dijumlah, harga = total nilai (jumlah × harga tiap item).
export interface BulkSummary {
  codes: string; names: string; categories: string; qty: number; value: number; net: number;
  products: { code: string; name: string; qty: number }[]; // rincian untuk dropdown "N product"
  categoryList: { category: string; qty: number }[]; // rincian untuk dropdown "N category"
}
export function summarizeGroup(g: BulkGroup): BulkSummary {
  const qtyOf = (r: BulkRow) => parseInt(r.item_qty, 10) || 0;
  const cats = new Map<string, number>();
  for (const r of g.rows) {
    const c = r.item_category || "-";
    cats.set(c, (cats.get(c) ?? 0) + qtyOf(r));
  }
  return {
    codes: g.rows.map((r) => r.item_code).join(";"),
    names: g.rows.map((r) => `${qtyOf(r)} x ${r.item_name}`).join("; "),
    categories: [...cats].map(([c, q]) => `${q} x ${c}`).join("; "),
    qty: g.total_qty,
    value: g.total_value,
    net: g.total_net,
    products: g.rows.map((r) => ({ code: r.item_code, name: r.item_name, qty: qtyOf(r) })),
    categoryList: [...cats].map(([category, qty]) => ({ category, qty })),
  };
}

// Akun toko (Store/Merchant) hanya melihat input yang source_store-nya = tokonya sendiri — termasuk input yang dibuat ADMIN
// untuk toko itu. Dicocokkan dengan nama akun (name) atau user_name; huruf besar-kecil & awalan "Torch" diabaikan.
export function canSeeBulkRow(sourceStore: unknown, account: { name?: unknown; user_name?: unknown }): boolean {
  const store = normStore(sourceStore);
  if (!store) return false;
  return store === normStore(account.name) || store === normStore(account.user_name);
}

// ─── Report (khusus Bulk All) ──────────────────────────────────────────────────────────────────────────────────────
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** 26.054.000 → "Rp 26,1 jt"; 1.250.000.000 → "Rp 1,25 M"; 85.000 → "Rp 85 rb". */
export function fmtCompactRp(n: number): string {
  const v = Math.round(n);
  const f = (x: number, d = 1) => x.toFixed(d).replace(".", ",").replace(/,0+$/, "");
  if (v >= 1e9) return `Rp ${f(v / 1e9, 2)} M`;
  if (v >= 1e6) return `Rp ${f(v / 1e6)} jt`;
  if (v >= 1e3) return `Rp ${f(v / 1e3, 0)} rb`;
  return `Rp ${v}`;
}

export interface BulkReport {
  totals: { inputs: number; customers: number; qty: number; value: number; net: number; buy: number; notBuy: number; closingRate: number; avgValue: number };
  trend: { key: string; label: string; inputs: number; value: number }[];
  trendUnit: "day" | "week";
  byStore: { store: string; inputs: number; qty: number; value: number; buy: number }[];
  reasonBuy: { name: string; count: number }[];
  reasonNotBuy: { name: string; count: number }[];
  topProducts: { code: string; name: string; qty: number; value: number }[];
  byCategory: { category: string; qty: number; value: number }[];
  topCustomers: { name: string; institution: string; store: string; inputs: number; qty: number; value: number }[];
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mondayOf = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const shortLabel = (t: number) => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]}`; };

// Agregasi untuk grafik. `groups` = input (sudah difilter periode/toko oleh pemanggil). Tanpa tanggal terbaca → tidak masuk tren.
export function buildBulkReport(groups: BulkGroup[]): BulkReport {
  const totals = { inputs: groups.length, customers: 0, qty: 0, value: 0, net: 0, buy: 0, notBuy: 0, closingRate: 0, avgValue: 0 };
  const phones = new Set<string>();
  const store = new Map<string, { inputs: number; qty: number; value: number; buy: number }>();
  const rb = new Map<string, number>();
  const rn = new Map<string, number>();
  const prod = new Map<string, { code: string; name: string; qty: number; value: number }>();
  const cat = new Map<string, { qty: number; value: number }>();
  const cust = new Map<string, { name: string; institution: string; store: string; inputs: number; qty: number; value: number }>();
  const times: { t: number; value: number }[] = [];

  for (const g of groups) {
    totals.qty += g.total_qty;
    totals.value += g.total_value;
    totals.net += g.total_net;
    // "Beli" = Reason Buy atau Sales Order terisi (data impor punya SO tapi alasannya belum diisi tim store); "tidak beli" = Reason Not Buy terisi.
    const bought = !g.reason_not_buy && !!(g.reason_buy || g.sales_order);
    if (bought) totals.buy++;
    if (g.reason_buy) rb.set(g.reason_buy, (rb.get(g.reason_buy) ?? 0) + 1);
    if (g.reason_not_buy) { totals.notBuy++; rn.set(g.reason_not_buy, (rn.get(g.reason_not_buy) ?? 0) + 1); }
    phones.add(g.customer_phone_number || g.customer_name);
    const st = store.get(g.source_store) ?? { inputs: 0, qty: 0, value: 0, buy: 0 };
    st.inputs++; st.qty += g.total_qty; st.value += g.total_value; if (bought) st.buy++;
    store.set(g.source_store, st);
    const ck = g.customer_phone_number || g.customer_name;
    const c = cust.get(ck) ?? { name: g.customer_name, institution: g.customer_institution, store: g.source_store, inputs: 0, qty: 0, value: 0 };
    c.inputs++; c.qty += g.total_qty; c.value += g.total_value;
    cust.set(ck, c);
    for (const r of g.rows) {
      const q = parseInt(r.item_qty, 10) || 0;
      const v = q * parsePrice(r.item_price);
      const p = prod.get(r.item_code) ?? { code: r.item_code, name: r.item_name, qty: 0, value: 0 };
      p.qty += q; p.value += v; prod.set(r.item_code, p);
      const k = r.item_category || "-";
      const cc = cat.get(k) ?? { qty: 0, value: 0 };
      cc.qty += q; cc.value += v; cat.set(k, cc);
    }
    const t = parseIdDateTime(g.created_at);
    if (t) times.push({ t, value: g.total_value });
  }
  totals.customers = phones.size;
  totals.closingRate = totals.inputs ? Math.round((totals.buy / totals.inputs) * 1000) / 10 : 0;
  totals.avgValue = totals.inputs ? Math.round(totals.value / totals.inputs) : 0;

  // Tren: harian bila rentang ≤ 62 hari, selain itu mingguan (awal minggu = Senin). Hari tanpa data diisi 0 supaya garis tidak "melompat".
  let trend: BulkReport["trend"] = [];
  let trendUnit: "day" | "week" = "day";
  if (times.length) {
    const min = Math.min(...times.map((x) => x.t));
    const max = Math.max(...times.map((x) => x.t));
    trendUnit = (max - min) / 86400000 > 62 ? "week" : "day";
    const bucket = new Map<string, { t: number; inputs: number; value: number }>();
    for (const x of times) {
      const start = trendUnit === "week" ? mondayOf(x.t) : new Date(new Date(x.t).setHours(0, 0, 0, 0)).getTime();
      const k = dayKey(start);
      const b = bucket.get(k) ?? { t: start, inputs: 0, value: 0 };
      b.inputs++; b.value += x.value; bucket.set(k, b);
    }
    const step = trendUnit === "week" ? 7 : 1;
    const first = trendUnit === "week" ? mondayOf(min) : new Date(new Date(min).setHours(0, 0, 0, 0)).getTime();
    const last = trendUnit === "week" ? mondayOf(max) : new Date(new Date(max).setHours(0, 0, 0, 0)).getTime();
    for (let d = new Date(first); d.getTime() <= last; d.setDate(d.getDate() + step)) {
      const k = dayKey(d.getTime());
      const b = bucket.get(k);
      trend.push({ key: k, label: shortLabel(d.getTime()), inputs: b?.inputs ?? 0, value: b?.value ?? 0 });
    }
  }

  return {
    totals,
    trend,
    trendUnit,
    byStore: [...store].map(([s, v]) => ({ store: s, ...v })).sort((a, b) => b.value - a.value || b.inputs - a.inputs),
    reasonBuy: [...rb].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    reasonNotBuy: [...rn].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    topProducts: [...prod.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    byCategory: [...cat].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.qty - a.qty),
    topCustomers: [...cust.values()].sort((a, b) => b.value - a.value).slice(0, 5),
  };
}

// ─── Pesan WhatsApp ke toko (format sama dengan form di grup WA "BULK Order") ───────────────────────────────────────
/** Input dianggap terbeli bila Reason Buy atau Sales Order terisi dan bukan "tidak beli". */
export const isBulkBought = (g: Pick<BulkGroup, "reason_buy" | "reason_not_buy" | "sales_order">) =>
  !g.reason_not_buy && !!(g.reason_buy || g.sales_order);

const rp = (n: number) => "Rp. " + Math.round(n).toLocaleString("id-ID");

export function buildBulkWaMessage(g: BulkGroup): string {
  const store = g.source_store.replace(/^\s*torch\s+/i, "").trim();
  const phone = g.customer_phone_number.startsWith("62") ? "0" + g.customer_phone_number.slice(2) : g.customer_phone_number;
  const kebutuhan = g.reason_buy.replace(/^keperluan\s+/i, "").trim();
  const lines: string[] = [`BULK Order Store ${store}`, "", `Nama : ${g.customer_name}`];
  if (g.customer_institution) lines.push(`Instansi : ${g.customer_institution}`);
  if (phone) lines.push(`No.tlp : ${phone}`);
  if (g.sales_order) lines.push(`SO : ${g.sales_order}`);
  if (kebutuhan) lines.push(`Kebutuhan : ${kebutuhan}`);

  const gross = (r: BulkRow) => parsePrice(r.item_price);
  const net = (r: BulkRow) => (r.item_net ? parsePrice(r.item_net) : gross(r));
  const pct = (r: BulkRow) => (gross(r) > 0 ? Math.round((1 - net(r) / gross(r)) * 1000) / 10 : 0);
  const uniform = new Set(g.rows.map((r) => `${gross(r)}|${pct(r)}`)).size === 1; // harga & diskon sama untuk semua item
  lines.push("", "Artikel :");
  for (const r of g.rows) {
    const code = r.item_code ? `${r.item_code} - ` : "";
    const detail = uniform ? "" : ` (${rp(gross(r))}${pct(r) > 0 ? `, diskon ${pct(r)}%` : ""})`;
    lines.push(`${code}${r.item_name} : ${parseInt(r.item_qty, 10) || 0}pcs${detail}`);
  }
  lines.push("");
  if (uniform && gross(g.rows[0]) > 0) {
    lines.push(`Harga : ${rp(gross(g.rows[0]))}`, `Diskon : ${pct(g.rows[0]) > 0 ? `${pct(g.rows[0])}%` : "-"}`);
  }
  // Harga gross = total sebelum diskon; Harga net = total setelah diskon (sama dengan "Harga net" di form grup)
  lines.push(`Qty : ${g.total_qty} pcs`, `Harga gross : ${rp(g.total_value)}`, `Harga net : ${rp(g.total_net)}`);
  return lines.join("\n");
}

/** Link wa.me ke nomor toko (62…) dengan pesan terisi; "" bila nomor tidak ada. */
export function bulkWaLink(storePhone: string | undefined, message: string): string {
  const d = String(storePhone ?? "").replace(/\D/g, "");
  if (!d) return "";
  const num = d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
