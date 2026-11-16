import { groupBulkRows, isBulkBought, type BulkGroup } from "./bulkOrder";
import { parseIdDateTime } from "./idDate";

// Filter data Bulk (dipakai tab Data & Report). Murni (tanpa DB) supaya bisa dites dan diimpor klien.

export type BulkPeriod = "all" | "today" | "7" | "30" | "60" | "90" | "this_month" | "last_month" | "custom";

export interface BulkFilters {
  search: string;
  period: BulkPeriod;
  from: string; // YYYY-MM-DD (hanya period "custom")
  to: string;
  stores: string[];
  institutions: string[];
  items: string[]; // item_code
  categories: string[];
  reasonBuy: string[];
  reasonNotBuy: string[];
  createdBy: string[];
  status: "" | "buy" | "not_buy" | "none"; // none = belum ada alasan/SO
  hasSO: "" | "yes" | "no";
  qtyMin: string; qtyMax: string; // total qty per input
  valueMin: string; valueMax: string; // total gross per input (Rp)
}

export const emptyBulkFilters = (period: BulkPeriod = "all"): BulkFilters => ({
  search: "", period, from: "", to: "",
  stores: [], institutions: [], items: [], categories: [], reasonBuy: [], reasonNotBuy: [], createdBy: [],
  status: "", hasSO: "", qtyMin: "", qtyMax: "", valueMin: "", valueMax: "",
});

export const PERIOD_OPTIONS: { key: BulkPeriod; label: string }[] = [
  { key: "all", label: "Semua tanggal" },
  { key: "today", label: "Hari ini" },
  { key: "7", label: "7 hari terakhir" },
  { key: "30", label: "30 hari terakhir" },
  { key: "60", label: "60 hari terakhir" },
  { key: "90", label: "90 hari terakhir" },
  { key: "this_month", label: "Bulan ini" },
  { key: "last_month", label: "Bulan lalu" },
  { key: "custom", label: "Pilih tanggal…" },
];

const DAY = 86400000;
const startOfDay = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();
const parseDay = (s: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : 0;
};

// Rentang waktu (ms, lokal): from = awal hari, to = akhir hari (eksklusif). 0 = tanpa batas.
export function periodRange(f: Pick<BulkFilters, "period" | "from" | "to">, now = Date.now()): { from: number; to: number } {
  const today = startOfDay(now);
  switch (f.period) {
    case "today": return { from: today, to: today + DAY };
    case "7": case "30": case "60": case "90": return { from: today - (Number(f.period) - 1) * DAY, to: today + DAY };
    case "this_month": { const d = new Date(now); return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() }; }
    case "last_month": { const d = new Date(now); return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: new Date(d.getFullYear(), d.getMonth(), 1).getTime() }; }
    case "custom": {
      const a = parseDay(f.from), b = parseDay(f.to);
      return { from: a, to: b ? b + DAY : 0 };
    }
    default: return { from: 0, to: 0 };
  }
}

const num = (s: string): number | null => {
  const n = Number(String(s ?? "").replace(/[^\d]/g, ""));
  return String(s ?? "").trim() === "" || !isFinite(n) ? null : n;
};

// Jumlah filter yang aktif (untuk lencana "Reset (n)"); `search` ikut dihitung.
export function activeFilterCount(f: BulkFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.period !== "all") n++;
  for (const k of ["stores", "institutions", "items", "categories", "reasonBuy", "reasonNotBuy", "createdBy"] as const) if (f[k].length) n++;
  if (f.status) n++;
  if (f.hasSO) n++;
  if (f.qtyMin.trim() || f.qtyMax.trim()) n++;
  if (f.valueMin.trim() || f.valueMax.trim()) n++;
  return n;
}

export interface BulkOption { value: string; label: string }
export interface BulkFilterOptions {
  stores: BulkOption[]; institutions: BulkOption[]; items: BulkOption[]; categories: BulkOption[];
  reasonBuy: BulkOption[]; reasonNotBuy: BulkOption[]; createdBy: BulkOption[];
}

const uniq = (vals: string[]): BulkOption[] =>
  [...new Set(vals.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" })).map((v) => ({ value: v, label: v }));

// Pilihan dropdown diambil dari data yang sedang dimuat (tidak perlu panggilan server tambahan).
export function bulkFilterOptions(groups: BulkGroup[]): BulkFilterOptions {
  const items = new Map<string, string>();
  for (const g of groups) for (const r of g.rows) if (r.item_code && !items.has(r.item_code)) items.set(r.item_code, r.item_name);
  return {
    stores: uniq(groups.map((g) => g.source_store)),
    institutions: uniq(groups.map((g) => g.customer_institution)),
    items: [...items].sort((a, b) => a[0].localeCompare(b[0])).map(([code, name]) => ({ value: code, label: name ? `${code} · ${name}` : code })),
    categories: uniq(groups.flatMap((g) => g.rows.map((r) => r.item_category))),
    reasonBuy: uniq(groups.map((g) => g.reason_buy)),
    reasonNotBuy: uniq(groups.map((g) => g.reason_not_buy)),
    createdBy: uniq(groups.map((g) => g.created_by)),
  };
}

const inSet = (set: string[], v: string) => set.length === 0 || set.includes(v);

/**
 * Terapkan filter ke input (grup) Bulk.
 * - Filter data input (toko, tanggal, alasan, SO, pembuat, institusi, cari) menyaring seluruh input.
 * - Filter Item & Kategori: `narrow=false` (tabel Data) → input yang punya item itu tetap tampil utuh;
 *   `narrow=true` (Report) → hanya item yang cocok yang dihitung (qty/nilai ikut menyempit).
 * - Rentang qty/nilai berlaku pada total input setelah penyempitan.
 */
export function applyBulkFilters(groups: BulkGroup[], f: BulkFilters, opts: { narrow?: boolean; now?: number } = {}): BulkGroup[] {
  const q = f.search.trim().toLowerCase();
  const range = periodRange(f, opts.now);
  let out = groups.filter((g) => {
    if (!inSet(f.stores, g.source_store)) return false;
    if (!inSet(f.institutions, g.customer_institution)) return false;
    if (!inSet(f.reasonBuy, g.reason_buy)) return false;
    if (!inSet(f.reasonNotBuy, g.reason_not_buy)) return false;
    if (!inSet(f.createdBy, g.created_by)) return false;
    if (f.status === "buy" && !isBulkBought(g)) return false;
    if (f.status === "not_buy" && !g.reason_not_buy) return false;
    if (f.status === "none" && (g.reason_buy || g.reason_not_buy || g.sales_order)) return false;
    if (f.hasSO === "yes" && !g.sales_order) return false;
    if (f.hasSO === "no" && g.sales_order) return false;
    if (range.from || range.to) {
      const t = parseIdDateTime(g.created_at);
      if (!t || (range.from && t < range.from) || (range.to && t >= range.to)) return false;
    }
    if (q) {
      const hay = [g.source_store, g.customer_name, g.customer_institution, g.customer_phone_number, g.sales_order, g.note, g.reason_buy, g.reason_not_buy, g.created_by,
        ...g.rows.flatMap((r) => [r.item_code, r.item_name, r.item_category])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (f.items.length || f.categories.length) {
    const match = (r: BulkGroup["rows"][number]) => inSet(f.items, r.item_code) && inSet(f.categories, r.item_category);
    if (opts.narrow) out = groupBulkRows(out.flatMap((g) => g.rows.filter(match)));
    else out = out.filter((g) => g.rows.some(match));
  }

  const qMin = num(f.qtyMin), qMax = num(f.qtyMax), vMin = num(f.valueMin), vMax = num(f.valueMax);
  if (qMin !== null || qMax !== null || vMin !== null || vMax !== null) {
    out = out.filter((g) =>
      (qMin === null || g.total_qty >= qMin) && (qMax === null || g.total_qty <= qMax) &&
      (vMin === null || g.total_value >= vMin) && (vMax === null || g.total_value <= vMax));
  }
  return out;
}
