import { sql, ensureOnce } from "./neon";
import { ensureUsersSchema, PERMISSION_KEYS } from "./users";

export interface RoleRow {
  key: string;
  name: string;
  perms: Record<string, string>;
  is_system: boolean;
  user_count: number;
}

let schemaReady: Promise<void> | null = null;

export function ensureRolesSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("roles", "v2", async () => {
      await ensureUsersSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS app_roles (
          key TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          perms JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_system BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      const n = await sql`SELECT COUNT(*)::int AS n FROM app_roles`;
      if (n[0].n === 0) {
        const all: Record<string, string> = {};
        for (const k of PERMISSION_KEYS) all[k] = "TRUE";
        await sql`INSERT INTO app_roles (key, name, perms, is_system) VALUES ('super_admin', 'Super Admin', ${JSON.stringify(all)}::jsonb, true) ON CONFLICT DO NOTHING`;
        // Admin/Store: permission yang dimiliki minimal separuh user di role itu (titik awal; bisa diubah).
        for (const [key, name] of [["admin", "Admin"], ["store", "Store"]] as const) {
          const users = await sql`SELECT perms FROM app_users WHERE role = ${key}`;
          const perms: Record<string, string> = {};
          for (const k of PERMISSION_KEYS) {
            const have = users.filter((u: any) => u.perms?.[k] === "TRUE").length;
            perms[k] = users.length > 0 && have * 2 >= users.length ? "TRUE" : "FALSE";
          }
          await sql`INSERT INTO app_roles (key, name, perms, is_system) VALUES (${key}, ${name}, ${JSON.stringify(perms)}::jsonb, true) ON CONFLICT DO NOTHING`;
        }
      }
      // Guest: hanya Dashboard (titik awal, bisa diubah Super Admin).
      const guest: Record<string, string> = {};
      for (const k of PERMISSION_KEYS) guest[k] = k === "dashboard" ? "TRUE" : "FALSE";
      await sql`INSERT INTO app_roles (key, name, perms, is_system) VALUES ('guest', 'Guest', ${JSON.stringify(guest)}::jsonb, true) ON CONFLICT DO NOTHING`;
    }).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

function clean(perms: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of PERMISSION_KEYS) out[k] = perms?.[k] === true || perms?.[k] === "TRUE" ? "TRUE" : "FALSE";
  return out;
}

export async function listRoles(): Promise<RoleRow[]> {
  await ensureRolesSchema();
  const rows = await sql`
    SELECT r.key, r.name, r.perms, r.is_system,
      (SELECT COUNT(*)::int FROM app_users u WHERE u.role = r.key) AS user_count
    FROM app_roles r ORDER BY r.is_system DESC, r.created_at ASC
  `;
  return rows as RoleRow[];
}

export async function getRole(key: string): Promise<RoleRow | null> {
  return (await listRoles()).find((r) => r.key === key) || null;
}

export async function createRole(name: string, perms: Record<string, any>): Promise<RoleRow> {
  await ensureRolesSchema();
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "role";
  let key = base;
  for (let i = 2; await getRole(key); i++) key = `${base}_${i}`;
  await sql`INSERT INTO app_roles (key, name, perms) VALUES (${key}, ${name.trim()}, ${JSON.stringify(clean(perms))}::jsonb)`;
  return (await getRole(key))!;
}

export async function updateRole(key: string, name: string | undefined, perms: Record<string, any> | undefined) {
  await ensureRolesSchema();
  if (key === "super_admin") perms = undefined; // Super Admin selalu penuh
  await sql`
    UPDATE app_roles SET
      name = COALESCE(${name?.trim() || null}, name),
      perms = COALESCE(${perms ? JSON.stringify(clean(perms)) : null}::jsonb, perms)
    WHERE key = ${key}
  `;
}

export async function deleteRole(key: string): Promise<"ok" | "system" | "in_use"> {
  const r = await getRole(key);
  if (!r || r.is_system) return "system";
  if (r.user_count > 0) return "in_use";
  await sql`DELETE FROM app_roles WHERE key = ${key}`;
  return "ok";
}

// Salin permission role ke semua user dengan role itu (menimpa pengaturan per-user).
export async function applyRoleToUsers(key: string): Promise<number> {
  const r = await getRole(key);
  if (!r) return 0;
  const res = await sql`UPDATE app_users SET perms = ${JSON.stringify(r.perms)}::jsonb, updated_at = now() WHERE role = ${key} RETURNING id`;
  return res.length;
}

export async function applyRoleToUser(key: string, userName: string): Promise<void> {
  const r = await getRole(key);
  if (!r) return;
  await sql`UPDATE app_users SET perms = ${JSON.stringify(r.perms)}::jsonb, updated_at = now() WHERE user_name = ${userName}`;
}
