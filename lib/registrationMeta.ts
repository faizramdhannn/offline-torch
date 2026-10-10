import { sql, ensureOnce } from "./neon";
import type { ClientInfo } from "./clientInfo";

// Jejak pendaftar (IP, lokasi perkiraan, perangkat) per permintaan registrasi + pembatas laju per IP.
// Disimpan di Neon karena sheet registration_request punya kolom tetap (A–F).
let schemaReady: Promise<void> | null = null;
export function ensureRegistrationMetaSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("registration_meta", "v1", async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS registration_meta (
          request_id TEXT PRIMARY KEY,
          ip TEXT NOT NULL DEFAULT '',
          country TEXT NOT NULL DEFAULT '',
          region TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          latitude TEXT NOT NULL DEFAULT '',
          longitude TEXT NOT NULL DEFAULT '',
          timezone TEXT NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT '',
          device_type TEXT NOT NULL DEFAULT '',
          os TEXT NOT NULL DEFAULT '',
          browser TEXT NOT NULL DEFAULT '',
          model TEXT NOT NULL DEFAULT '',
          client JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS registration_meta_ip_idx ON registration_meta (ip, created_at DESC)`;
    }).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

// Laporan dari browser (bisa dipalsukan, hanya pelengkap): zona waktu, bahasa, ukuran layar.
export interface ClientReported { tz?: string; lang?: string; screen?: string }

export async function saveRegistrationMeta(requestId: string, c: ClientInfo, reported: ClientReported) {
  await ensureRegistrationMetaSchema();
  const client = JSON.stringify({
    tz: String(reported.tz || "").slice(0, 60),
    lang: String(reported.lang || "").slice(0, 30),
    screen: String(reported.screen || "").slice(0, 20),
  });
  await sql`
    INSERT INTO registration_meta (request_id, ip, country, region, city, latitude, longitude, timezone, user_agent, device_type, os, browser, model, client)
    VALUES (${requestId}, ${c.ip}, ${c.country}, ${c.region}, ${c.city}, ${c.latitude}, ${c.longitude}, ${c.timezone}, ${c.user_agent},
            ${c.device_type}, ${c.os}, ${c.browser}, ${c.model}, ${client}::jsonb)
    ON CONFLICT (request_id) DO NOTHING`;
}

export async function getRegistrationMeta(ids: string[]): Promise<Record<string, any>> {
  if (!ids.length) return {};
  await ensureRegistrationMetaSchema();
  const rows = await sql`SELECT * FROM registration_meta WHERE request_id = ANY(${ids})`;
  const out: Record<string, any> = {};
  for (const r of rows as any[]) out[r.request_id] = r;
  return out;
}

// Pembatas laju per IP: berapa permintaan dari IP ini dalam `minutes` menit terakhir.
export async function recentFromIp(ip: string, minutes: number): Promise<number> {
  if (!ip) return 0;
  await ensureRegistrationMetaSchema();
  const r = await sql`SELECT count(*)::int AS n FROM registration_meta WHERE ip = ${ip} AND created_at > now() - make_interval(mins => ${minutes})`;
  return r[0]?.n ?? 0;
}

// Berapa permintaan registrasi (semua IP) dalam sehari terakhir — rem darurat terhadap spam.
export async function recentTotal(hours: number): Promise<number> {
  await ensureRegistrationMetaSchema();
  const r = await sql`SELECT count(*)::int AS n FROM registration_meta WHERE created_at > now() - make_interval(hours => ${hours})`;
  return r[0]?.n ?? 0;
}
