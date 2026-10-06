import { sql } from "./neon";
import { getSheetData } from "./sheets";

// Kolom permission di sheet `users` (urutan = header sheet). Nilainya disimpan
// sebagai 'TRUE'/'FALSE' supaya semua pemanggil lama (u.stock === 'TRUE') tetap jalan.
export const PERMISSION_KEYS = [
  "dashboard", "order_report", "stock", "registration_request", "user_setting",
  "petty_cash", "petty_cash_add", "petty_cash_export", "petty_cash_balance",
  "order_report_import", "order_report_export", "customer", "voucher", "bundling",
  "canvasing", "canvasing_export", "request", "edit_request", "analytics_order",
  "stock_opname", "stock_import", "stock_export", "stock_view_store", "stock_view_pca",
  "stock_view_master", "stock_view_hpp", "stock_view_hpt", "stock_view_hpj",
  "stock_refresh_javelin", "traffic_store", "report_store", "request_tracking",
  "tracking_edit", "stock_opname_report", "attendance", "attendance_report",
  "invoice", "invoice_create", "invoice_edit", "invoice_delete", "invoice_master",
  "sales_view", "sales_view_all", "attendance_store", "attendance_store_all",
  "material_issue", "material_issue_all", "asset_store", "step_erp", "step_erp_all",
  "employee_discount", "employee_discount_approval", "daily_checklist",
  "daily_checklist_all", "stock_pca_view", "affiliate_view", "jastiper",
];

// Role dinamis (tabel app_roles, lib/roles.ts). Tiga bawaan: super_admin, admin, store.
export type Role = string;

export interface UserRow {
  id: string;
  name: string;
  user_name: string;
  password: string;
  last_activity: string;
  email: string;
  phone: string;
  address: string;
  photo_url: string;
  role: Role;
  active: string; // 'TRUE' | 'FALSE'
  sessions_valid_after: string; // epoch ms; sesi yang diterbitkan sebelumnya dianggap tidak sah
  [permission: string]: string;
}

let schemaReady: Promise<void> | null = null;

export function ensureUsersSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          user_name TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL DEFAULT '',
          perms JSONB NOT NULL DEFAULT '{}'::jsonb,
          last_activity TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT '',
          photo_url TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`;
      await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sessions_valid_after BIGINT NOT NULL DEFAULT 0`;
      const count = await sql`SELECT COUNT(*)::int AS n FROM app_users`;
      if (count[0].n === 0) {
        // Migrasi satu kali dari sheet `users`.
        const rows = await getSheetData("users", { skipCache: true });
        for (const u of rows as any[]) {
          if (!u.user_name) continue;
          const perms: Record<string, string> = {};
          for (const k of PERMISSION_KEYS) perms[k] = u[k] === "TRUE" ? "TRUE" : "FALSE";
          await sql`
            INSERT INTO app_users (id, name, user_name, password, perms, last_activity)
            VALUES (${String(u.id || u.user_name)}, ${u.name || ""}, ${u.user_name}, ${u.password || ""},
                    ${JSON.stringify(perms)}::jsonb, ${u.last_activity || ""})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      // Backfill role sekali: akun pemilik = super_admin, yang punya akses setting = admin, sisanya store.
      await sql`UPDATE app_users SET role = 'super_admin' WHERE role = '' AND user_name = 'faizramdhann'`;
      await sql`UPDATE app_users SET role = 'admin' WHERE role = '' AND perms->>'user_setting' = 'TRUE'`;
      await sql`UPDATE app_users SET role = 'store' WHERE role = ''`;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

function toUser(r: any): UserRow {
  const out: UserRow = {
    id: r.id,
    name: r.name,
    user_name: r.user_name,
    password: r.password,
    last_activity: r.last_activity,
    email: r.email,
    phone: r.phone,
    address: r.address,
    photo_url: r.photo_url,
    role: r.role || "store",
    active: r.active === false ? "FALSE" : "TRUE",
    sessions_valid_after: String(r.sessions_valid_after ?? 0),
  };
  for (const k of PERMISSION_KEYS) out[k] = r.perms?.[k] === "TRUE" ? "TRUE" : "FALSE";
  return out;
}

// Pengganti getSheetData("users"): bentuk baris sama (permission 'TRUE'/'FALSE').
export async function getUsersData(): Promise<UserRow[]> {
  await ensureUsersSchema();
  const rows = await sql`SELECT * FROM app_users ORDER BY created_at ASC, id ASC`;
  return rows.map(toUser);
}

export async function getUserByUserName(userName: string): Promise<UserRow | null> {
  await ensureUsersSchema();
  const rows = await sql`SELECT * FROM app_users WHERE user_name = ${userName} LIMIT 1`;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function updateUserPermissions(id: string, changes: Record<string, boolean>): Promise<boolean> {
  await ensureUsersSchema();
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (PERMISSION_KEYS.includes(k)) patch[k] = v ? "TRUE" : "FALSE";
  }
  const res = await sql`
    UPDATE app_users SET perms = perms || ${JSON.stringify(patch)}::jsonb, updated_at = now()
    WHERE id = ${id} RETURNING id
  `;
  return res.length > 0;
}

export async function createUser(u: { id: string; name: string; user_name: string; password: string }, permissions: Record<string, boolean>, role: Role = "store") {
  await ensureUsersSchema();
  const perms: Record<string, string> = {};
  for (const k of PERMISSION_KEYS) perms[k] = permissions?.[k] ? "TRUE" : "FALSE";
  await sql`
    INSERT INTO app_users (id, name, user_name, password, perms, role)
    VALUES (${u.id}, ${u.name}, ${u.user_name}, ${u.password}, ${JSON.stringify(perms)}::jsonb, ${role})
    ON CONFLICT (user_name) DO NOTHING
  `;
}

export async function touchLastActivity(userName: string, ts: string) {
  await ensureUsersSchema();
  await sql`UPDATE app_users SET last_activity = ${ts} WHERE user_name = ${userName}`;
}

export interface ProfilePatch {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  photo_url?: string;
  password?: string;
}

export async function updateUserProfile(userName: string, p: ProfilePatch) {
  await ensureUsersSchema();
  await sql`
    UPDATE app_users SET
      name = COALESCE(${p.name ?? null}, name),
      email = COALESCE(${p.email ?? null}, email),
      phone = COALESCE(${p.phone ?? null}, phone),
      address = COALESCE(${p.address ?? null}, address),
      photo_url = COALESCE(${p.photo_url ?? null}, photo_url),
      password = COALESCE(${p.password ?? null}, password),
      updated_at = now()
    WHERE user_name = ${userName}
  `;
}

// Dipakai Super Admin untuk mengatur profil + role user lain.
export async function adminUpdateUser(
  userName: string,
  p: { name?: string; email?: string; phone?: string; address?: string; role?: Role; remove_photo?: boolean; active?: boolean }
) {
  await ensureUsersSchema();
  await sql`
    UPDATE app_users SET
      name = COALESCE(${p.name ?? null}, name),
      email = COALESCE(${p.email ?? null}, email),
      phone = COALESCE(${p.phone ?? null}, phone),
      address = COALESCE(${p.address ?? null}, address),
      role = COALESCE(${p.role ?? null}, role),
      active = COALESCE(${p.active ?? null}, active),
      sessions_valid_after = CASE WHEN ${p.active === false} THEN ${Date.now()} ELSE sessions_valid_after END,
      photo_url = CASE WHEN ${p.remove_photo === true} THEN '' ELSE photo_url END,
      updated_at = now()
    WHERE user_name = ${userName}
  `;
}

export async function countSuperAdmins(): Promise<number> {
  await ensureUsersSchema();
  const r = await sql`SELECT COUNT(*)::int AS n FROM app_users WHERE role = 'super_admin'`;
  return r[0].n;
}

// Paksa logout: semua sesi yang terbit sebelum sekarang jadi tidak sah.
export async function invalidateSessions(opts: { userName?: string; exceptRole?: string }): Promise<number> {
  await ensureUsersSchema();
  const now = Date.now();
  const res = opts.userName
    ? await sql`UPDATE app_users SET sessions_valid_after = ${now} WHERE user_name = ${opts.userName} RETURNING id`
    : await sql`UPDATE app_users SET sessions_valid_after = ${now} WHERE role <> ${opts.exceptRole ?? ""} RETURNING id`;
  return res.length;
}
