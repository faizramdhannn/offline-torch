import { sql, ensureOnce } from "./neon";

// Activity log di Neon (dulu sheet `activity_log`: tiap aksi = 1 panggilan Sheets API + seluruh sheet dibaca saat dilihat).
// Kolom/format output sengaja sama dengan sheet lama: id, timestamp, user, method, activity_log, entity_type, entity_id.

export interface ActivityRow {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
  entity_type: string;
  entity_id: string;
}

let schemaReady: Promise<void> | null = null;
export function ensureActivityLogSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("activity_log", "v2", async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_activity_log (
          pk BIGSERIAL PRIMARY KEY,
          id TEXT NOT NULL DEFAULT '',
          seq BIGINT NOT NULL DEFAULT 0,
          ts_text TEXT NOT NULL DEFAULT '',
          user_name TEXT NOT NULL DEFAULT '',
          method TEXT NOT NULL DEFAULT '',
          activity_log TEXT NOT NULL DEFAULT '',
          entity_type TEXT NOT NULL DEFAULT '',
          entity_id TEXT NOT NULL DEFAULT ''
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_activity_seq ON app_activity_log (seq DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_activity_entity ON app_activity_log (entity_type, entity_id, seq DESC)`;

      // Impor dari sheet lama: hanya baris yang LEBIH BARU dari data yang sudah ada di Neon, jadi aman
      // diulang (v2 = menyusul log yang masih tertulis ke sheet oleh versi lama sebelum deploy ini).
      {
        const max = await sql`SELECT COALESCE(MAX(seq), 0)::bigint AS m FROM app_activity_log`;
        const maxSeq = Number(max[0].m);
        const { getSheetData } = await import("./sheets");
        const rows = (await getSheetData("activity_log", { skipCache: true })) as any[];
        const clean = rows.filter((r) => (r.id || r.activity_log) && (parseInt(r.id) || 0) > maxSeq);
        for (let i = 0; i < clean.length; i += 1000) {
          const c = clean.slice(i, i + 1000);
          await sql`
            INSERT INTO app_activity_log (id, seq, ts_text, user_name, method, activity_log, entity_type, entity_id)
            SELECT * FROM unnest(
              ${c.map((r) => String(r.id || ""))}::text[],
              ${c.map((r) => parseInt(r.id) || 0)}::bigint[],
              ${c.map((r) => String(r.timestamp || ""))}::text[],
              ${c.map((r) => String(r.user || ""))}::text[],
              ${c.map((r) => String(r.method || ""))}::text[],
              ${c.map((r) => String(r.activity_log || ""))}::text[],
              ${c.map((r) => String(r.entity_type || ""))}::text[],
              ${c.map((r) => String(r.entity_id || ""))}::text[]
            )
          `;
        }
      }
    });
  }
  return schemaReady;
}

const SELECT = `id, ts_text AS timestamp, user_name AS "user", method, activity_log, entity_type, entity_id`;

export function formatTimestamp(d = new Date()): string {
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta",
  });
}

export async function insertActivity(a: {
  user: string; method: string; activity_log: string; entity_type?: string; entity_id?: string;
}): Promise<string> {
  await ensureActivityLogSchema();
  const id = Date.now().toString();
  await sql`
    INSERT INTO app_activity_log (id, seq, ts_text, user_name, method, activity_log, entity_type, entity_id)
    VALUES (${id}, ${Number(id)}, ${formatTimestamp()}, ${a.user}, ${a.method}, ${a.activity_log},
            ${a.entity_type || ""}, ${a.entity_id || ""})
  `;
  return id;
}

export async function countToday(): Promise<number> {
  await ensureActivityLogSchema();
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const start = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600 * 1000;
  const r = await sql`SELECT COUNT(*)::int AS n FROM app_activity_log WHERE seq >= ${start}`;
  return r[0].n;
}

export async function listPage(page: number, per: number, q: string): Promise<{ rows: ActivityRow[]; total: number }> {
  await ensureActivityLogSchema();
  const like = `%${q}%`;
  const total = await sql`
    SELECT COUNT(*)::int AS n FROM app_activity_log
    WHERE ${q} = '' OR user_name ILIKE ${like} OR activity_log ILIKE ${like} OR method ILIKE ${like}
  `;
  const rows = await sql(
    `SELECT ${SELECT} FROM app_activity_log
     WHERE $1 = '' OR user_name ILIKE $2 OR activity_log ILIKE $2 OR method ILIKE $2
     ORDER BY seq DESC, pk DESC LIMIT $3 OFFSET $4`,
    [q, like, per, (page - 1) * per]
  );
  return { rows: rows as ActivityRow[], total: total[0].n };
}

export async function listByEntity(entityType: string, entityId: string): Promise<ActivityRow[]> {
  await ensureActivityLogSchema();
  return (await sql(
    `SELECT ${SELECT} FROM app_activity_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY seq DESC, pk DESC`,
    [entityType, entityId]
  )) as ActivityRow[];
}

export async function listByEntityTypes(types: string[], limit = 100): Promise<ActivityRow[]> {
  await ensureActivityLogSchema();
  return (await sql(
    `SELECT ${SELECT} FROM app_activity_log WHERE entity_type = ANY($1) ORDER BY seq DESC, pk DESC LIMIT $2`,
    [types, limit]
  )) as ActivityRow[];
}

export async function listRecent(limit = 500): Promise<ActivityRow[]> {
  await ensureActivityLogSchema();
  return (await sql(`SELECT ${SELECT} FROM app_activity_log ORDER BY seq DESC, pk DESC LIMIT $1`, [limit])) as ActivityRow[];
}
