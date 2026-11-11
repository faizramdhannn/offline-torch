// Beri akses menu Bulk: role admin → bulk_order + bulk_order_all; role store & merchant → bulk_order saja.
// Diterapkan ke TEMPLATE role (app_roles) dan ke akun yang sudah ada (app_users.perms) — hanya menambah dua izin itu (jsonb merge),
// izin lain tidak disentuh, Super Admin tidak perlu (semua akses). Aman diulang.
//   DRY_RUN=1 npx tsx scripts/grant-bulk-access.ts     (hanya melaporkan)
//   npx tsx scripts/grant-bulk-access.ts               (menerapkan)
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

const GRANTS: Record<string, Record<string, string>> = {
  admin: { bulk_order: "TRUE", bulk_order_all: "TRUE" },
  store: { bulk_order: "TRUE" },
  merchant: { bulk_order: "TRUE" },
};

async function main() {
  const dry = !!process.env.DRY_RUN;
  const { sql } = await import("../lib/neon");
  const roles = ((await sql`SELECT key FROM app_roles`) as any[]).map((r) => String(r.key));
  console.log("role di database:", roles.join(", "));
  for (const [role, perms] of Object.entries(GRANTS)) {
    const json = JSON.stringify(perms);
    const keys = Object.keys(perms);
    const users = (await sql`SELECT user_name, perms FROM app_users WHERE role = ${role}`) as any[];
    const need = users.filter((u) => keys.some((k) => u.perms?.[k] !== "TRUE"));
    console.log(`${dry ? "[DRY RUN] " : ""}role ${role}: ${users.length} akun, ${need.length} perlu diberi ${keys.join("+")}${roles.includes(role) ? "" : " (template role tidak ada, dilewati)"}`);
    if (dry) continue;
    if (roles.includes(role)) await sql`UPDATE app_roles SET perms = perms || ${json}::jsonb WHERE key = ${role}`;
    if (need.length) await sql`UPDATE app_users SET perms = perms || ${json}::jsonb WHERE role = ${role}`;
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
