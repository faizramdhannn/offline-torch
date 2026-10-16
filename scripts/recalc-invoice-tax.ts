// Hitung ulang PPN dokumen LAMA (tax_mode='legacy') dengan rumus baru: harga sudah termasuk PPN →
// subtotal = DPP (tanpa PPN), tax_amount = PPN = total − DPP, grand_total tetap. Item tidak diubah (tampilan dihitung saat render).
//   DRY_RUN=1 npx tsx scripts/recalc-invoice-tax.ts   # hanya tampilkan perubahan
//   npx tsx scripts/recalc-invoice-tax.ts             # terapkan (nilai lama dicadangkan di tabel invoice_tax_backup; aman diulang)
// Dokumen yang total itemnya tidak sama dengan grand_total tersimpan DILEWATI (perlu dicek manual).
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
}

async function main() {
  const dry = !!process.env.DRY_RUN;
  const { sql } = await import("../lib/neon");
  const { ensureInvoiceSchema } = await import("../lib/invoices");
  const { taxBreakdown } = await import("../lib/invoiceTax");
  await ensureInvoiceSchema();
  await sql`CREATE TABLE IF NOT EXISTS invoice_tax_backup (
    invoice_id TEXT PRIMARY KEY, subtotal NUMERIC, tax_percent NUMERIC, tax_amount NUMERIC, grand_total NUMERIC, tax_mode TEXT,
    backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

  const docs = await sql`SELECT invoice_id, invoice_number, doc_type, status, subtotal::float8 AS subtotal, tax_percent::float8 AS tax_percent,
                                tax_amount::float8 AS tax_amount, grand_total::float8 AS grand_total
                         FROM invoices WHERE tax_mode = 'legacy' AND status <> 'deleted' ORDER BY created_at`;
  let changed = 0, same = 0, skipped = 0;
  for (const d of docs as any[]) {
    const items = await sql`SELECT qty::float8 AS qty, unit_price::float8 AS unit_price FROM invoice_items WHERE invoice_id = ${d.invoice_id} ORDER BY line_no, item_id`;
    const bd = taxBreakdown(items as any[], d.tax_percent);
    if (Math.round(bd.total) !== Math.round(d.grand_total)) {
      skipped++;
      console.log(`LEWATI ${d.invoice_id} ${d.invoice_number || d.doc_type}: total item ${bd.total} ≠ grand_total ${d.grand_total}`);
      continue;
    }
    if (d.tax_percent > 0) {
      changed++;
      console.log(`${d.status.padEnd(8)} ${String(d.invoice_number || "(quotation)").padEnd(12)} PPN ${d.tax_percent}%: subtotal ${d.subtotal} → ${bd.dpp} | PPN ${d.tax_amount} → ${bd.ppn} | total ${d.grand_total} (tetap)`);
    } else same++;
    if (dry) continue;
    await sql`INSERT INTO invoice_tax_backup (invoice_id, subtotal, tax_percent, tax_amount, grand_total, tax_mode)
              VALUES (${d.invoice_id}, ${d.subtotal}, ${d.tax_percent}, ${d.tax_amount}, ${d.grand_total}, 'legacy') ON CONFLICT (invoice_id) DO NOTHING`;
    await sql`UPDATE invoices SET subtotal = ${bd.dpp}, tax_amount = ${bd.ppn}, grand_total = ${bd.total}, tax_mode = 'inclusive' WHERE invoice_id = ${d.invoice_id}`;
  }
  console.log(`${dry ? "[DRY RUN] " : ""}berubah: ${changed} | tanpa PPN (hanya ditandai): ${same} | dilewati: ${skipped}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
