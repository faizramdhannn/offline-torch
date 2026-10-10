// Murni (tanpa database): dipakai server untuk validasi dan perangkat toko untuk menentukan kapan pengumuman tampil.
export type Recurrence = "once" | "daily" | "weekly" | "monthly";

export interface AnnounceRule {
  id: number;
  name: string;
  text: string;
  seconds: number;
  all_stores: boolean;
  user_names: string[];
  recurrence: Recurrence;
  days: string;            // weekly: "1,2,3" (0 = Minggu)
  day_of_month: number | null; // monthly
  run_date: string;        // once: YYYY-MM-DD
  time_min: number;        // menit sejak 00:00 WIB
  start_date: string;      // opsional (daily/weekly/monthly)
  end_date: string;
  active: boolean;
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: "Sekali",
  daily: "Setiap hari",
  weekly: "Hari tertentu tiap minggu",
  monthly: "Tanggal tertentu tiap bulan",
};

// Tanggal/jam dalam zona WIB.
export function wibParts(d = new Date()): { ymd: string; day: number; dom: number; min: number; daysInMonth: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value || "0";
  const y = Number(get("year")), mo = Number(get("month")), dom = Number(get("day"));
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    dom,
    min: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
    daysInMonth: new Date(Date.UTC(y, mo, 0)).getUTCDate(),
  };
}

// Apakah hari ini termasuk jadwal aturan (tanpa memperhatikan jam)?
function dayMatches(r: AnnounceRule, w: ReturnType<typeof wibParts>): boolean {
  if (!r.active) return false;
  if (r.recurrence === "once") return w.ymd === r.run_date;
  if (r.start_date && w.ymd < r.start_date) return false;
  if (r.end_date && w.ymd > r.end_date) return false;
  if (r.recurrence === "daily") return true;
  if (r.recurrence === "weekly") return r.days.split(",").filter(Boolean).map(Number).includes(w.day);
  if (r.recurrence === "monthly") return !!r.day_of_month && w.dom === Math.min(r.day_of_month, w.daysInMonth);
  return false;
}

// Apakah aturan ini jatuh tempo SEKARANG? Berlaku pada menit yang ditentukan sampai `graceMin` menit sesudahnya
// (toleransi bila perangkat baru memuat halaman sesaat setelah jamnya). Lewat dari itu, dilewati.
export function isDue(r: AnnounceRule, now = new Date(), graceMin = 2): boolean {
  const w = wibParts(now);
  if (w.min < r.time_min || w.min >= r.time_min + graceMin) return false;
  return dayMatches(r, w);
}

// Pengumuman berikutnya HARI INI (jamnya belum lewat), untuk layar standby.
export function nextToday(rules: AnnounceRule[], now = new Date()): AnnounceRule | null {
  const w = wibParts(now);
  return rules.filter((r) => r.time_min > w.min && dayMatches(r, w)).sort((a, b) => a.time_min - b.time_min)[0] || null;
}

// Ringkasan satu baris untuk daftar di dashboard.
export function describeRule(r: AnnounceRule): string {
  const t = `${String(Math.floor(r.time_min / 60)).padStart(2, "0")}:${String(r.time_min % 60).padStart(2, "0")}`;
  const names = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  if (r.recurrence === "once") return `Sekali · ${r.run_date} ${t}`;
  if (r.recurrence === "daily") return `Setiap hari ${t}`;
  if (r.recurrence === "weekly") return `${r.days.split(",").filter(Boolean).map((d) => names[Number(d)]).join(", ")} ${t}`;
  return `Tanggal ${r.day_of_month} tiap bulan ${t}`;
}
