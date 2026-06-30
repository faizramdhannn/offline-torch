import type { DateEntry } from "./types";

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
