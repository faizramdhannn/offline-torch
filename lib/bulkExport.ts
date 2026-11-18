import { BULK_COLUMNS, isBulkBought, parsePrice, type BulkGroup } from "./bulkOrder";
import { parseIdDateTime } from "./idDate";

// Isi file export Bulk (XLSX dibuat di browser): sheet 1 = data mentah, sheet 2 = rekap per customer.
// Murni (tanpa DB/XLSX) supaya bisa dites.

const intOf = (s: string) => parseInt(String(s ?? "").replace(/[^\d-]/g, ""), 10) || 0;
const NUMERIC = new Set(["item_qty", "item_price", "item_net"]);

// Sheet 1 — persis kolom `raw_data` (satu baris per item), angka sebagai angka.
export function bulkRawRows(groups: BulkGroup[]): Record<string, string | number>[] {
  return groups.flatMap((g) =>
    g.rows.map((r) => {
      const o: Record<string, string | number> = {};
      for (const c of BULK_COLUMNS) {
        const v = r[c] ?? "";
        o[c] = NUMERIC.has(c) ? (c === "item_qty" ? intOf(v) : parsePrice(v)) : v;
      }
      return o;
    })
  );
}

const fmtDay = (t: number) => (t ? new Date(t).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "");

// Customer yang sama = nomor HP yang sama (hanya angka); tanpa HP → nama.
const customerKey = (g: BulkGroup) => g.customer_phone_number.replace(/\D/g, "") || `nama:${g.customer_name.trim().toLowerCase()}`;

// Sheet 2 — satu baris per customer: berapa kali bulk, di toko mana saja, beli/tidak beli, total qty & nilai.
export function bulkRecapRows(groups: BulkGroup[]): Record<string, string | number>[] {
  type Acc = {
    name: string; phone: string; institution: string; inputs: number; bought: number; notBought: number;
    qty: number; gross: number; net: number; first: number; last: number; stores: Map<string, number>; latestT: number;
  };
  const map = new Map<string, Acc>();
  for (const g of groups) {
    const k = customerKey(g);
    const t = parseIdDateTime(g.created_at);
    let a = map.get(k);
    if (!a) {
      a = { name: g.customer_name, phone: g.customer_phone_number, institution: g.customer_institution, inputs: 0, bought: 0, notBought: 0, qty: 0, gross: 0, net: 0, first: 0, last: 0, stores: new Map(), latestT: -1 };
      map.set(k, a);
    }
    a.inputs++;
    if (isBulkBought(g)) a.bought++;
    if (g.reason_not_buy) a.notBought++;
    a.qty += g.total_qty; a.gross += g.total_value; a.net += g.total_net;
    a.stores.set(g.source_store, (a.stores.get(g.source_store) ?? 0) + 1);
    if (t) { a.first = a.first ? Math.min(a.first, t) : t; a.last = Math.max(a.last, t); }
    // Nama/institusi dari input paling baru (data lama bisa belum lengkap)
    if (t >= a.latestT) { a.latestT = t; if (g.customer_name) a.name = g.customer_name; if (g.customer_institution) a.institution = g.customer_institution; if (g.customer_phone_number) a.phone = g.customer_phone_number; }
  }
  return [...map.values()]
    .sort((x, y) => y.inputs - x.inputs || y.gross - x.gross)
    .map((a) => {
      const stores = [...a.stores].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]));
      return {
        Customer: a.name,
        "No. HP": a.phone,
        Institusi: a.institution,
        "Jumlah Bulk (input)": a.inputs,
        "Jumlah Toko": stores.length,
        "Toko (jumlah bulk)": stores.map(([s, n]) => `${s} (${n}×)`).join("; "),
        "Beli (closing)": a.bought,
        "Tidak Beli": a.notBought,
        "Total Qty (pcs)": a.qty,
        "Total Gross": Math.round(a.gross),
        "Total Net": Math.round(a.net),
        "Bulk Pertama": fmtDay(a.first),
        "Bulk Terakhir": fmtDay(a.last),
      };
    });
}
