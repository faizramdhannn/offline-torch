// Migrasi satu kali (aman diulang): Invoice dari Google Sheets → Neon, plus izin baru invoice_approval.
//   npx tsx scripts/migrate-invoices.ts          # jalankan
//   DRY_RUN=1 npx tsx scripts/migrate-invoices.ts # hanya hitung
// - Dokumen yang sudah ada di Neon TIDAK ditimpa (id yang sama dilewati); sheet lama tidak diubah/dihapus.
// - Dokumen lama tidak punya pembuat (kolom created_by tidak ada di header sheet) → hanya terlihat oleh pemegang invoice_approval.
// - Pemegang invoice_master otomatis diberi invoice_approval (di user & di template role).
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

async function main() {
  const dry = !!process.env.DRY_RUN;
  const { sql } = await import("../lib/neon");
  const { getSheetData } = await import("../lib/sheets");
  const { ensureInvoiceSchema } = await import("../lib/invoices");
  await ensureInvoiceSchema();

  const [inv, items, master] = await Promise.all([
    getSheetData("invoices", { skipCache: true }),
    getSheetData("invoice_items", { skipCache: true }),
    getSheetData("master_invoice", { skipCache: true }),
  ]);
  const num = (v: any) => Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;
  const bool = (v: any) => String(v ?? "").toUpperCase() === "TRUE";
  const ts = (v: any) => { const d = new Date(String(v || "")); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); };

  let nInv = 0, nItems = 0, skipped = 0;
  for (const r of inv as any[]) {
    if (!r.invoice_id) continue;
    const exists = await sql`SELECT 1 FROM invoices WHERE invoice_id = ${String(r.invoice_id)}`;
    if (exists.length) { skipped++; continue; }
    const status = ["draft", "submitted", "approved", "deleted", "void"].includes(String(r.status)) ? String(r.status) : "draft";
    const docType = String(r.doc_type || "invoice").toLowerCase() === "quotation" ? "quotation" : "invoice";
    const sub = num(r.subtotal);
    nInv++;
    if (dry) continue;
    await sql`
      INSERT INTO invoices (invoice_id, invoice_number, doc_type, invoice_date, customer_name, customer_address, subtotal, tax_percent, tax_amount, grand_total,
                            amount_in_words, status, use_signature, signature_store, signature_pic, created_by, created_at, updated_at,
                            approved_by, approved_at)
      VALUES (${String(r.invoice_id)}, ${String(r.invoice_number || "").trim()}, ${docType}, ${String(r.invoice_date || "").slice(0, 10)},
              ${String(r.customer_name || "")}, ${String(r.customer_address || "").trim()}, ${sub}, ${num(r.tax_percent)}, ${num(r.tax_amount)}, ${num(r.grand_total) || sub},
              ${String(r.amount_in_words || "")}, ${status}, ${bool(r.use_signature)}, ${String(r.signature_store || "")}, ${String(r.signature_pic || "")},
              ${String(r.created_by || "")}, ${ts(r.created_at)}, ${ts(r.created_at)},
              ${status === "approved" ? "(migrasi)" : ""}, ${status === "approved" ? ts(r.created_at) : null})`;
    await sql`INSERT INTO invoice_events (invoice_id, action, to_status, by_user, note, at) VALUES (${String(r.invoice_id)}, 'migrated', ${status}, 'sistem', 'Dipindahkan dari spreadsheet', ${ts(r.created_at)})`;
    let line = 0;
    for (const it of (items as any[]).filter((x) => String(x.invoice_id) === String(r.invoice_id))) {
      line++;
      nItems++;
      const q = num(it.qty), p = num(it.unit_price);
      await sql`INSERT INTO invoice_items (invoice_id, line_no, product_name, variant, qty, unit_price, total_price)
                VALUES (${String(r.invoice_id)}, ${line}, ${String(it.product_name || "")}, ${String(it.variant || "")}, ${q}, ${p}, ${num(it.total_price) || Math.round(q * p)})`;
    }
  }

  let masterDone = false;
  const m: any = (master as any[])[0];
  if (m) {
    const ex = await sql`SELECT 1 FROM invoice_master WHERE id = 1`;
    if (!ex.length) {
      masterDone = true;
      if (!dry) {
        await sql`
          INSERT INTO invoice_master (id, header_image_url, company_name, company_address, company_phone, company_email, signature_image_url,
                                      default_use_signature, default_use_ppn, ppn_percentage, invoice_prefix, next_invoice_number, updated_by)
          VALUES (1, ${String(m.header_image_url || "")}, ${String(m.company_name || "")}, ${String(m.company_address || "")}, ${String(m.company_phone || "")},
                  ${String(m.company_email || "")}, ${String(m.signature_image_url || "")}, ${bool(m.default_use_signature)}, ${bool(m.default_use_ppn)},
                  ${num(m.ppn_percentage) || 11}, ${String(m.invoice_prefix || "INV")}, ${Math.round(num(m.next_invoice_number)) || 1}, ${String(m.updated_by || "")})`;
      }
    }
  }

  // Izin baru: pemegang invoice_master → juga invoice_approval (user & template role)
  let granted = 0;
  if (!dry) {
    const u = await sql`
      UPDATE app_users SET perms = jsonb_set(perms, '{invoice_approval}', '"TRUE"')
      WHERE perms->>'invoice_master' = 'TRUE' AND COALESCE(perms->>'invoice_approval', '') <> 'TRUE' RETURNING user_name`;
    granted = u.length;
    await sql`
      UPDATE app_roles SET perms = jsonb_set(perms, '{invoice_approval}', '"TRUE"')
      WHERE perms->>'invoice_master' = 'TRUE' AND COALESCE(perms->>'invoice_approval', '') <> 'TRUE'`;
  }

  console.log(`${dry ? "[DRY RUN] " : ""}invoice baru: ${nInv} | item: ${nItems} | dilewati (sudah ada): ${skipped} | master dipindah: ${masterDone} | akun diberi invoice_approval: ${granted}`);
  const c = await sql`SELECT status, doc_type, count(*)::int AS n FROM invoices GROUP BY status, doc_type ORDER BY 1, 2`;
  console.log("isi Neon:", (c as any[]).map((x) => `${x.status}/${x.doc_type}=${x.n}`).join(", "));
  const ap = await sql`SELECT user_name FROM app_users WHERE perms->>'invoice_approval' = 'TRUE' ORDER BY user_name`;
  console.log("pemegang invoice_approval:", (ap as any[]).map((x) => x.user_name).join(", ") || "(tidak ada)");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
