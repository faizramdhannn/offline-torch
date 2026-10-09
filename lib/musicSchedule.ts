// Murni (tanpa database) supaya aman dipakai di browser.
// Aturan jadwal aktif sekarang (zona WIB). days = "0,1,..." (0=Minggu).
export interface ScheduleRule { id: number; days: string; start_min: number; end_min: number; playlist_id: number | null; volume: number; shuffle?: boolean }
export function wibNow(d = new Date()): { day: number; min: number; dayStartMs: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value || "0";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const min = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return { day, min, dayStartMs: d.getTime() - min * 60000 - d.getSeconds() * 1000 - d.getMilliseconds() };
}
export function activeRule(rules: ScheduleRule[], d = new Date()): { rule: ScheduleRule; startMs: number } | null {
  const { day, min, dayStartMs } = wibNow(d);
  for (const r of rules) {
    if (!r.days.split(",").map(Number).includes(day)) continue;
    if (min >= r.start_min && min < r.end_min) return { rule: r, startMs: dayStartMs + r.start_min * 60000 };
  }
  return null;
}
