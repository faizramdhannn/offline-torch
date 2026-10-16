// Isi "Pembuat" dokumen lama (created_by kosong) dari TOKO PENANDA TANGAN: "Torch Lembong" → akun `lembong` (hanya bila akun itu ada).
// Dokumen tanpa toko penanda tangan tetap tanpa pembuat (hanya terlihat approver). Aman diulang.
//   DRY_RUN=1 npx tsx scripts/assign-invoice-owner.ts
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}
async function main() {
  const dry = !!process.env.DRY_RUN;
  const { sql } = await import("../lib/neon");
  const users = new Set(((await sql`SELECT user_name FROM app_users`) as any[]).map((u) => String(u.user_name)));
  const docs = (await sql`SELECT invoice_id, signature_store FROM invoices WHERE created_by = '' AND signature_store <> '' AND status <> 'deleted'`) as any[];
  const tally: Record<string, number> = {};
  let skipped = 0;
  for (const d of docs) {
    const user = String(d.signature_store).replace(/^torch\s+/i, "").trim().toLowerCase();
    if (!users.has(user)) { skipped++; console.log(`dilewati: toko "${d.signature_store}" tidak punya akun "${user}"`); continue; }
    tally[user] = (tally[user] || 0) + 1;
    if (!dry) await sql`UPDATE invoices SET created_by = ${user} WHERE invoice_id = ${d.invoice_id} AND created_by = ''`;
  }
  console.log(`${dry ? "[DRY RUN] " : ""}pembuat diisi:`, JSON.stringify(tally), `| dilewati: ${skipped}`);
  const left = await sql`SELECT count(*)::int n FROM invoices WHERE created_by = '' AND status <> 'deleted'`;
  console.log("masih tanpa pembuat:", left[0].n);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
