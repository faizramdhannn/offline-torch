import { sql, ensureOnce } from "./neon";

// Versi katalog = bagian dari URL PDF (?v=...). CDN meng-cache tiap versi
// permanen; "refresh" cukup menaikkan versi, jadi PDF dibuat ulang tepat satu kali.
export const CATALOG_KEYS = ["online", "clearance"] as const;
export type CatalogKey = (typeof CATALOG_KEYS)[number];

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("catalog_state", "v2", async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS catalog_state (
          key TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by TEXT NOT NULL DEFAULT ''
        )
      `;
      await sql`ALTER TABLE catalog_state ADD COLUMN IF NOT EXISTS blob_url TEXT NOT NULL DEFAULT ''`;
    }).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export async function getCatalogVersion(key: string): Promise<string> {
  await ensureSchema();
  const rows = await sql`SELECT version FROM catalog_state WHERE key = ${key}`;
  if (rows[0]) return rows[0].version as string;
  await sql`INSERT INTO catalog_state (key, version) VALUES (${key}, '1') ON CONFLICT DO NOTHING`;
  const again = await sql`SELECT version FROM catalog_state WHERE key = ${key}`;
  return again[0].version as string;
}

// Versi baru = PDF lama tidak berlaku lagi (blob_url dikosongkan sampai PDF baru diunggah).
export async function bumpCatalogVersion(key: string, by: string): Promise<string> {
  await ensureSchema();
  const version = String(Date.now());
  await sql`
    INSERT INTO catalog_state (key, version, updated_by) VALUES (${key}, ${version}, ${by})
    ON CONFLICT (key) DO UPDATE SET version = ${version}, blob_url = '', updated_at = now(), updated_by = ${by}
  `;
  return version;
}

export async function getCatalogState(key: string): Promise<{ version: string; blob_url: string }> {
  await ensureSchema();
  await getCatalogVersion(key); // memastikan baris ada
  const r = await sql`SELECT version, blob_url FROM catalog_state WHERE key = ${key}`;
  return { version: r[0].version as string, blob_url: (r[0].blob_url as string) || "" };
}

// Versi + URL Blob dalam satu langkah (PDF sudah jadi) — dipakai unggahan Super Admin dan cron.
export async function publishCatalogBlob(key: string, by: string, blobUrl: string): Promise<string> {
  await ensureSchema();
  const version = String(Date.now());
  await sql`
    INSERT INTO catalog_state (key, version, blob_url, updated_by) VALUES (${key}, ${version}, ${blobUrl}, ${by})
    ON CONFLICT (key) DO UPDATE SET version = ${version}, blob_url = ${blobUrl}, updated_at = now(), updated_by = ${by}
  `;
  return version;
}

export async function getCatalogMeta(): Promise<Record<string, { version: string; updated_at: string; updated_by: string }>> {
  await ensureSchema();
  const rows = await sql`SELECT key, version, updated_at::text AS updated_at, updated_by FROM catalog_state`;
  return Object.fromEntries(rows.map((r: any) => [r.key, { version: r.version, updated_at: r.updated_at, updated_by: r.updated_by }]));
}

export function catalogPdfPath(key: string): string {
  return key === "clearance" ? "/clearance-catalog/pdf" : "/online-catalog/pdf";
}
