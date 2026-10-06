import { sql } from "./neon";

// Pembatas percobaan login (anti tebak password): per username dan per IP.
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const USER_MAX = 8;
const IP_MAX = 40;

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS login_attempts (
          key TEXT PRIMARY KEY,
          fails INT NOT NULL DEFAULT 0,
          first_at BIGINT NOT NULL DEFAULT 0,
          locked_until BIGINT NOT NULL DEFAULT 0
        )
      `;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export function loginKeys(username: string, ip: string) {
  return { userKey: `u:${String(username || "").trim().toLowerCase()}`, ipKey: `ip:${ip || "unknown"}` };
}

// Mengembalikan sisa detik terkunci (0 = boleh mencoba).
export async function lockedSeconds(userKey: string, ipKey: string): Promise<number> {
  await ensureSchema();
  const now = Date.now();
  const rows = await sql`SELECT locked_until FROM login_attempts WHERE key IN (${userKey}, ${ipKey})`;
  const until = Math.max(0, ...rows.map((r: any) => Number(r.locked_until)));
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

async function bump(key: string, max: number) {
  const now = Date.now();
  await sql`
    INSERT INTO login_attempts (key, fails, first_at, locked_until)
    VALUES (${key}, 1, ${now}, ${max <= 1 ? now + LOCK_MS : 0})
    ON CONFLICT (key) DO UPDATE SET
      fails = CASE WHEN login_attempts.first_at < ${now - WINDOW_MS} THEN 1 ELSE login_attempts.fails + 1 END,
      first_at = CASE WHEN login_attempts.first_at < ${now - WINDOW_MS} THEN ${now} ELSE login_attempts.first_at END,
      locked_until = CASE
        WHEN (CASE WHEN login_attempts.first_at < ${now - WINDOW_MS} THEN 1 ELSE login_attempts.fails + 1 END) >= ${max}
        THEN ${now + LOCK_MS} ELSE login_attempts.locked_until END
  `;
}

export async function recordFailure(userKey: string, ipKey: string) {
  await ensureSchema();
  await Promise.all([bump(userKey, USER_MAX), bump(ipKey, IP_MAX)]);
}

export async function clearFailures(userKey: string) {
  await ensureSchema();
  await sql`DELETE FROM login_attempts WHERE key = ${userKey}`;
}
