import { sql } from "./neon";
import { ensureUsersSchema } from "./users";
import { ensureRolesSchema } from "./roles";

// Snapshot tabel app_users + app_roles (termasuk hash password) di tabel app_users_backup.
// Berguna untuk membatalkan kesalahan (mis. salah "terapkan role") — bukan pengganti backup Neon.
const KEEP = 60;

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureUsersSchema();
      await ensureRolesSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS app_users_backup (
          id BIGSERIAL PRIMARY KEY,
          taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          reason TEXT NOT NULL DEFAULT '',
          taken_by TEXT NOT NULL DEFAULT '',
          user_count INT NOT NULL DEFAULT 0,
          data JSONB NOT NULL
        )
      `;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export async function takeSnapshot(reason: string, by = "system"): Promise<number> {
  await ensureSchema();
  const users = await sql`SELECT * FROM app_users`;
  const roles = await sql`SELECT * FROM app_roles`;
  const r = await sql`
    INSERT INTO app_users_backup (reason, taken_by, user_count, data)
    VALUES (${reason}, ${by}, ${users.length}, ${JSON.stringify({ users, roles })}::jsonb)
    RETURNING id
  `;
  await sql`DELETE FROM app_users_backup WHERE id NOT IN (SELECT id FROM app_users_backup ORDER BY id DESC LIMIT ${KEEP})`;
  return Number(r[0].id);
}

export async function listSnapshots() {
  await ensureSchema();
  return sql`SELECT id::text AS id, taken_at::text AS taken_at, reason, taken_by, user_count FROM app_users_backup ORDER BY id DESC`;
}

export async function getSnapshot(id: string) {
  await ensureSchema();
  const r = await sql`SELECT id::text AS id, taken_at::text AS taken_at, reason, taken_by, data FROM app_users_backup WHERE id = ${id}`;
  return r[0] || null;
}

// Pulihkan dari snapshot: user yang ada di snapshot dikembalikan (insert/update); user yang dibuat
// SETELAH snapshot tidak dihapus. Snapshot "sebelum pemulihan" dibuat otomatis dulu.
export async function restoreSnapshot(id: string, by: string) {
  const snap = await getSnapshot(id);
  if (!snap) return null;
  await takeSnapshot(`sebelum pemulihan #${id}`, by);
  const { users, roles } = snap.data as { users: any[]; roles: any[] };

  for (const r of roles || []) {
    await sql`
      INSERT INTO app_roles (key, name, perms, is_system)
      VALUES (${r.key}, ${r.name}, ${JSON.stringify(r.perms)}::jsonb, ${!!r.is_system})
      ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, perms = EXCLUDED.perms
    `;
  }
  let skipped = 0;
  for (const u of users || []) {
    try {
    await sql`
      INSERT INTO app_users (id, name, user_name, password, perms, last_activity, email, phone, address, photo_url, role, active, sessions_valid_after)
      VALUES (${u.id}, ${u.name}, ${u.user_name}, ${u.password}, ${JSON.stringify(u.perms)}::jsonb, ${u.last_activity || ""},
              ${u.email || ""}, ${u.phone || ""}, ${u.address || ""}, ${u.photo_url || ""}, ${u.role || "store"},
              ${u.active !== false}, ${Date.now()})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, user_name = EXCLUDED.user_name, password = EXCLUDED.password, perms = EXCLUDED.perms,
        email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address, photo_url = EXCLUDED.photo_url,
        role = EXCLUDED.role, active = EXCLUDED.active, sessions_valid_after = EXCLUDED.sessions_valid_after, updated_at = now()
    `;
    } catch (e) {
      skipped++; // mis. username yang sama sudah dipakai id lain
      console.error("restore user dilewati:", u.user_name, e);
    }
  }
  return { users: (users || []).length - skipped, roles: (roles || []).length, skipped };
}
