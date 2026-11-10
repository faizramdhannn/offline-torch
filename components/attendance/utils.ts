import type { DateEntry } from "./types";
import { WORK_HOURS, FULL_HOURS_SPECIAL, FULL_13H_STORES, OVERTIME_HOURS, FULL_OVERTIME_SPECIAL } from "./constants";

// ─── Shared Attendance Utilities ────────────────────────────────────────────
// Extracted verbatim from the original app/(main)/attendance/page.tsx.
// No logic changed — only made `export`-able for reuse across components.

export function parseCurrencyStr(val: string | undefined | null): number {
  if (!val) return 0;
  const s = String(val).replace(/Rp\s?/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function normalizeTime(raw: string | number | undefined | null): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim().replace(/^[`']+/, '');
  if (s === '' || s.toLowerCase() === 'none' || s === '-') return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m.slice(0, 2)}`;
  }
  const f = parseFloat(s);
  if (!isNaN(f)) {
    if (f > 0 && f < 1) {
      const totalMinutes = Math.round(f * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const h = Math.floor(f);
    const m = Math.round((f - h) * 100);
    return `${String(h).padStart(2, '0')}:${String(Math.min(m, 59)).padStart(2, '0')}`;
  }
  return s;
}

export function displayTime(val: string | number | undefined | null): string {
  if (val === null || val === undefined || val === '') return '-';
  const n = normalizeTime(val);
  return n || String(val);
}

export function parseDateSafe(str: string): Date | null {
  if (!str) return null;
  const dmY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function findCurrentDateRange(dateList: DateEntry[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const d of dateList) {
    if (d.week_start && d.week_end) {
      const start = parseDateSafe(d.week_start);
      const end   = parseDateSafe(d.week_end);
      if (!start || !end) continue;
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) return d.date_range;
    }
  }
  if (dateList.length > 0) return dateList[dateList.length - 1].date_range;
  return '';
}

export function buildTaftDateRange(month: string, startDay: number, endDay: number): { from: Date; to: Date } {
  const [year, mon] = month.split('-').map(Number);
  let from: Date;
  let to: Date;
  if (startDay >= endDay) {
    from = new Date(year, mon - 2, startDay);
    to   = new Date(year, mon - 1, endDay);
  } else {
    from = new Date(year, mon - 1, startDay);
    to   = new Date(year, mon - 1, endDay);
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function buildTaftDates(month: string, startDay: number, endDay: number): Date[] {
  const { from, to } = buildTaftDateRange(month, startDay, endDay);
  const dates: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export const fmtISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getWeekDates(dateList: DateEntry[], dateRange: string): Date[] | null {
  const entry = dateList.find(d => d.date_range === dateRange);
  if (!entry?.week_start) return null;
  const start = parseDateSafe(entry.week_start);
  if (!start) return null;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export const fmtDDMM = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

export const truncName = (s: string, n = 15) => s && s.length > n ? s.slice(0, n) + '…' : (s || '');

export const toTitleCase = (str: string) =>
  str ? str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : str;

export const fmtRupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');


/** Jam kerja satu kode jadwal (P/S/M = 8, F = 12 atau 13 di Karawang/Purwokerto/Jogja, MF = 10, lainnya 0). */
const isFull13Store = (storeName: string | undefined | null) =>
  FULL_13H_STORES.some(k => String(storeName ?? '').toLowerCase().includes(k));

export function codeHours(code: string | undefined | null, storeName: string | undefined | null): number {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return 0;
  if (c === 'F' && isFull13Store(storeName)) return FULL_HOURS_SPECIAL;
  return WORK_HOURS[c] ?? 0;
}

/** Total jam kerja dari daftar kode (mis. 7 hari jadwal mingguan). */
export const totalHours = (codes: (string | undefined | null)[], storeName: string | undefined | null) =>
  codes.reduce<number>((n, c) => n + codeHours(c, storeName), 0);

/** Jam lembur terjadwal satu kode (MF 2, F 4 — 5 di Karawang/Purwokerto/Jogja; P/S/M dan lainnya 0). */
export function codeOvertime(code: string | undefined | null, storeName: string | undefined | null): number {
  const c = String(code ?? '').trim().toUpperCase();
  if (c === 'F' && isFull13Store(storeName)) return FULL_OVERTIME_SPECIAL;
  return OVERTIME_HOURS[c] ?? 0;
}

export const totalOvertime = (codes: (string | undefined | null)[], storeName: string | undefined | null) =>
  codes.reduce<number>((n, c) => n + codeOvertime(c, storeName), 0);

/** Bulan "YYYY-MM" → daftar tanggal (hari 1 s.d. terakhir). */
export function monthDates(month: string): Date[] {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => new Date(y, m - 1, i + 1));
}

/** Kode jadwal untuk satu tanggal: cari minggu (week_start..week_end) yang memuat tanggal itu, ambil hari ke-n (Senin = 0). */
export function weekSlotOf(date: Date, dateList: DateEntry[]): { dateRange: string; dayIndex: number } | null {
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  for (const w of dateList) {
    const a = parseDateSafe(w.week_start);
    const b = parseDateSafe(w.week_end);
    if (!a || !b) continue;
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    if (t >= start && t <= end) {
      const dayIndex = Math.round((t - start) / 86400000);
      return dayIndex >= 0 && dayIndex < 7 ? { dateRange: w.date_range, dayIndex } : null;
    }
  }
  return null;
}

/** Daftar bulan "YYYY-MM" yang tercakup daftar minggu (terbaru dulu). */
export function monthsCovered(dateList: DateEntry[]): string[] {
  const set = new Set<string>();
  for (const w of dateList) {
    const a = parseDateSafe(w.week_start);
    const b = parseDateSafe(w.week_end);
    if (!a || !b) continue;
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }
  return [...set].sort().reverse();
}

/** Rentang tanggal "YYYY-MM-DD" s.d. "YYYY-MM-DD" (inklusif) → daftar tanggal. Terbalik ditukar; maksimal `max` hari. */
export function dateRangeDates(fromISO: string, toISO: string, max = 93): Date[] {
  let a = parseDateSafe(fromISO);
  let b = parseDateSafe(toISO);
  if (!a || !b) return [];
  if (a > b) [a, b] = [b, a];
  const out: Date[] = [];
  for (let d = new Date(a.getFullYear(), a.getMonth(), a.getDate()); d <= b && out.length < max; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

// ── Filter periode: yang sudah lebih dari 2 bulan lalu disembunyikan dari pilihan (datanya tetap ada) ──
export const HIDE_PERIOD_AFTER_MONTHS = 2;

function periodCutoff(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - HIDE_PERIOD_AFTER_MONTHS, now.getDate());
}

/** Minggu (periode) yang masih ditampilkan di filter: berakhir 2 bulan terakhir atau lebih baru. `keep` = pilihan aktif, tetap tampil. */
export function visiblePeriods(dateList: DateEntry[], keep = '', now: Date = new Date()): DateEntry[] {
  const cut = periodCutoff(now);
  return dateList.filter(w => {
    if (keep && w.date_range === keep) return true;
    const end = parseDateSafe(w.week_end);
    return !end || end >= cut; // tanggal tak terbaca → jangan disembunyikan
  });
}

/** Bulan "YYYY-MM" yang masih ditampilkan di filter: dari bulan 2 bulan lalu sampai seterusnya. */
export function visibleMonths(months: string[], now: Date = new Date()): string[] {
  const c = periodCutoff(now);
  const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`;
  return months.filter(m => m >= key);
}
