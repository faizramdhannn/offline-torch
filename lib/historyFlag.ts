// Penanda "tampilkan riwayat lengkap" per halaman (localStorage; hanya klien). Dipakai bersama `?all=1` di API (lihat lib/rowWindow.ts).
export function historyAll(mod: string): boolean {
  try { return localStorage.getItem(`history_all_${mod}`) === "1"; } catch { return false; }
}
export function withHistory(url: string, mod: string): string {
  return historyAll(mod) ? `${url}${url.includes("?") ? "&" : "?"}all=1` : url;
}
export function setHistoryAll(mod: string, on: boolean) {
  try { on ? localStorage.setItem(`history_all_${mod}`, "1") : localStorage.removeItem(`history_all_${mod}`); } catch {}
}
