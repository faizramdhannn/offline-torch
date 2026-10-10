// Jam buka per toko (WIB), termasuk hari libur. Murni (tanpa database): dipakai server (peringatan), tablet (musik), dashboard.
import { wibParts } from "./announceSchedule";

export interface DayHours { open: number; close: number } // menit sejak 00:00
export interface StoreHours {
  weekly: (DayHours | null)[]; // indeks 0 = Minggu … 6 = Sabtu; null = tutup
  closed_dates: string[];      // hari libur khusus: YYYY-MM-DD
  follow: boolean;             // musik otomatis mengikuti jam buka (bila tidak ada jadwal musik)
}

// Bawaan (sama seperti sebelumnya): setiap hari 09:00–22:00.
export const DEFAULT_HOURS: StoreHours = {
  weekly: Array.from({ length: 7 }, () => ({ open: 9 * 60, close: 22 * 60 })),
  closed_dates: [],
  follow: false,
};

export function isOpenNow(h: StoreHours | null | undefined, now = new Date()): boolean {
  const hours = h || DEFAULT_HOURS;
  const w = wibParts(now);
  if (hours.closed_dates.includes(w.ymd)) return false;
  const d = hours.weekly[w.day];
  return !!d && w.min >= d.open && w.min < d.close;
}

// Validasi/normalisasi masukan (dari klien atau kolom JSON database).
export function normalizeHours(raw: any): StoreHours | null {
  if (!raw || !Array.isArray(raw.weekly) || raw.weekly.length !== 7) return null;
  const weekly: (DayHours | null)[] = [];
  for (const d of raw.weekly) {
    if (d === null || d === undefined) { weekly.push(null); continue; }
    const open = Number(d.open), close = Number(d.close);
    if (!Number.isInteger(open) || !Number.isInteger(close) || open < 0 || close > 1440 || close <= open) return null;
    weekly.push({ open, close });
  }
  const closed = Array.isArray(raw.closed_dates) ? raw.closed_dates.map(String) : [];
  if (closed.length > 200 || closed.some((s: string) => !/^\d{4}-\d{2}-\d{2}$/.test(s))) return null;
  return { weekly, closed_dates: [...new Set<string>(closed)].sort(), follow: raw.follow === true };
}
