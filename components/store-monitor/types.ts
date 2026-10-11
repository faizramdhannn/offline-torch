export interface Device {
  device_id: string;
  user_name: string;
  store_name: string;
  kind: "tablet" | "pc";
  label: string;
  last_seen: string;
  online: boolean;
  battery: number | null;
  charging: boolean | null;
  music_player?: boolean | null;
  role?: string;
}
export interface Live {
  kind?: string;
  page?: string;
  battery?: number | null;
  charging?: boolean | null;
  visible?: boolean;
  ack?: { id: string; t: number };
  music?: { state?: string; title?: string; playlist?: string; volume?: number; muted?: boolean; note?: string };
}
export interface Playlist { id: number; name: string; url: string }
export interface StoreMusic { user_name: string; playlist_id: number | null; volume: number; muted: boolean; playing: boolean; shuffle?: boolean }
export interface Rule { id?: number; user_name?: string; days: string; start_min: number; end_min: number; playlist_id: number | null; volume: number; shuffle?: boolean }
export interface DeviceEvent { device_id: string; event: string; detail: string; at: string; store_name?: string; kind?: string; label?: string }

export const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
};
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
