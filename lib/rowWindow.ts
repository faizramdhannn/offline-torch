// Jendela waktu untuk daftar besar dari Google Sheets (hemat CPU Fluid & transfer): secara bawaan hanya baris dari N hari
// terakhir + baris yang BELUM SELESAI (apa pun umurnya, supaya request lama yang masih pending tidak hilang).
// `?all=1` = seluruh riwayat. Murni (tanpa DB) — dipakai route GET.
import { parseIdDateTime } from "./idDate";

export const WINDOW_DAYS = 120;

export function wantsAll(request: Request): boolean {
  try { return new URL(request.url).searchParams.get("all") === "1"; } catch { return false; }
}

export function windowRows<T>(
  rows: T[],
  all: boolean,
  opts: { dateOf: (r: T) => string | undefined; keep?: (r: T) => boolean; days?: number; now?: number }
): T[] {
  if (all) return rows;
  const cutoff = (opts.now ?? Date.now()) - (opts.days ?? WINDOW_DAYS) * 86400_000;
  return rows.filter((r) => {
    if (opts.keep?.(r)) return true;
    const t = parseIdDateTime(opts.dateOf(r));
    return t === 0 || t >= cutoff; // tanggal tak terbaca → tetap dikirim (jangan menyembunyikan data)
  });
}

// Halaman detail memuat satu dokumen: `?only=<id>` → hanya baris dengan id itu, tanpa jendela waktu (dokumen lama tetap bisa dibuka).
export function onlyId(request: Request): string {
  try { return new URL(request.url).searchParams.get("only") || ""; } catch { return ""; }
}
export function windowOrOnly<T extends { id?: unknown }>(
  rows: T[],
  request: Request,
  opts: Parameters<typeof windowRows<T>>[2]
): T[] {
  const only = onlyId(request);
  if (only) return rows.filter((r) => String(r.id) === only);
  return windowRows(rows, wantsAll(request), opts);
}
