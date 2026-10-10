import { sql, ensureOnce } from "./neon";

// Perangkat toko (tablet pemutar & PC kerja). Status LIVE ada di Ably (presence);
// tabel ini = daftar perangkat, "terakhir terlihat", riwayat, dan musik per toko.
// Satu akun boleh login di banyak perangkat: identitas perangkat = device_id (per browser), bukan akun.
export type DeviceKind = "tablet" | "pc";

let schemaReady: Promise<void> | null = null;
export function ensureDevicesSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("devices", "v7", async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS store_devices (
          device_id TEXT PRIMARY KEY,
          user_name TEXT NOT NULL,
          store_name TEXT NOT NULL DEFAULT '',
          kind TEXT NOT NULL DEFAULT 'pc',
          label TEXT NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT '',
          first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS store_devices_user_idx ON store_devices (user_name)`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS online BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS offline_since TIMESTAMPTZ`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS battery INT`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS charging BOOLEAN`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ`;
      await sql`
        CREATE TABLE IF NOT EXISTS device_events (
          id BIGSERIAL PRIMARY KEY,
          device_id TEXT NOT NULL,
          event TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS device_events_dev_idx ON device_events (device_id, at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS music_playlists (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          yt_list TEXT NOT NULL DEFAULT '',
          yt_video TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS store_music (
          user_name TEXT PRIMARY KEY,
          playlist_id INT,
          volume INT NOT NULL DEFAULT 50,
          muted BOOLEAN NOT NULL DEFAULT false,
          playing BOOLEAN NOT NULL DEFAULT true,
          updated_by TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS music_schedule (
          id SERIAL PRIMARY KEY,
          user_name TEXT NOT NULL,
          days TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
          start_min INT NOT NULL,
          end_min INT NOT NULL,
          playlist_id INT,
          volume INT NOT NULL DEFAULT 50
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS music_schedule_user_idx ON music_schedule (user_name)`;
      await sql`ALTER TABLE store_devices ADD COLUMN IF NOT EXISTS music_player BOOLEAN`;
      await sql`
        CREATE TABLE IF NOT EXISTS announce_schedule (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          text TEXT NOT NULL,
          seconds INT NOT NULL DEFAULT 30,
          all_stores BOOLEAN NOT NULL DEFAULT true,
          user_names JSONB NOT NULL DEFAULT '[]'::jsonb,
          recurrence TEXT NOT NULL DEFAULT 'daily',
          days TEXT NOT NULL DEFAULT '',
          day_of_month INT,
          run_date TEXT NOT NULL DEFAULT '',
          time_min INT NOT NULL,
          start_date TEXT NOT NULL DEFAULT '',
          end_date TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          created_by TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS store_hours (
          user_name TEXT PRIMARY KEY,
          weekly JSONB NOT NULL,
          closed_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
          follow BOOLEAN NOT NULL DEFAULT false,
          updated_by TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE TABLE IF NOT EXISTS monitor_prefs (key TEXT PRIMARY KEY, value JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sql`ALTER TABLE store_music ADD COLUMN IF NOT EXISTS shuffle BOOLEAN NOT NULL DEFAULT true`;
      await sql`ALTER TABLE music_schedule ADD COLUMN IF NOT EXISTS shuffle BOOLEAN NOT NULL DEFAULT true`;
    });
  }
  return schemaReady;
}

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const normalizeKind = (v: unknown): DeviceKind => (v === "tablet" ? "tablet" : "pc");

export async function logDeviceEvent(deviceId: string, event: string, detail = "") {
  await sql`INSERT INTO device_events (device_id, event, detail) VALUES (${deviceId}, ${event}, ${detail.slice(0, 300)})`;
}

// Ambil id playlist / video YouTube dari tautan. Playlist (list=) diutamakan.
export function parseYouTube(url: string): { list: string; video: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (!["youtube.com", "youtu.be", "music.youtube.com"].includes(host)) return null;
    const list = u.searchParams.get("list") || "";
    let video = u.searchParams.get("v") || "";
    if (host === "youtu.be") video = u.pathname.slice(1);
    if (!/^[A-Za-z0-9_-]*$/.test(list) || !/^[A-Za-z0-9_-]*$/.test(video)) return null;
    if (!list && !video) return null;
    return { list, video };
  } catch {
    return null;
  }
}

export { activeRule, wibNow, type ScheduleRule } from "./musicSchedule";
