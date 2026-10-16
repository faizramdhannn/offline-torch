import { sql, ensureOnce } from "./neon";
import { terbilang } from "./terbilang";
import { taxBreakdown } from "./invoiceTax";
import { canView, type Actor, type InvoiceAction, type InvoiceStatus } from "./invoiceFlow";
import type { UserRow } from "./users";

// Invoice & Quotation di Neon (dulu Google Sheets: invoices, invoice_items, master_invoice).
// Tabel: invoice_master (1 baris), invoices, invoice_items, invoice_events (riwayat dokumen).

let schemaReady: Promise<void> | null = null;
export function ensureInvoiceSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureOnce("invoices", "v2", async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS invoice_master (
          id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          header_image_url TEXT NOT NULL DEFAULT '',
          company_name TEXT NOT NULL DEFAULT '',
          company_address TEXT NOT NULL DEFAULT '',
          company_phone TEXT NOT NULL DEFAULT '',
          company_email TEXT NOT NULL DEFAULT '',
          signature_image_url TEXT NOT NULL DEFAULT '',
          default_use_signature BOOLEAN NOT NULL DEFAULT false,
          default_use_ppn BOOLEAN NOT NULL DEFAULT false,
          ppn_percentage NUMERIC NOT NULL DEFAULT 11,
          invoice_prefix TEXT NOT NULL DEFAULT 'INV',
          next_invoice_number INT NOT NULL DEFAULT 1,
          updated_by TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS invoices (
          invoice_id TEXT PRIMARY KEY,
          invoice_number TEXT NOT NULL DEFAULT '',
          doc_type TEXT NOT NULL DEFAULT 'invoice',
          invoice_date TEXT NOT NULL DEFAULT '',
          customer_name TEXT NOT NULL DEFAULT '',
          customer_address TEXT NOT NULL DEFAULT '',
          subtotal NUMERIC NOT NULL DEFAULT 0,
          tax_percent NUMERIC NOT NULL DEFAULT 0,
          tax_amount NUMERIC NOT NULL DEFAULT 0,
          grand_total NUMERIC NOT NULL DEFAULT 0,
          amount_in_words TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft',
          use_signature BOOLEAN NOT NULL DEFAULT false,
          signature_store TEXT NOT NULL DEFAULT '',
          signature_pic TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          submitted_by TEXT NOT NULL DEFAULT '',
          submitted_at TIMESTAMPTZ,
          approved_by TEXT NOT NULL DEFAULT '',
          approved_at TIMESTAMPTZ,
          reject_note TEXT NOT NULL DEFAULT '',
          rejected_by TEXT NOT NULL DEFAULT '',
          rejected_at TIMESTAMPTZ,
          void_note TEXT NOT NULL DEFAULT '',
          voided_by TEXT NOT NULL DEFAULT '',
          voided_at TIMESTAMPTZ
        )
      `;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_mode TEXT NOT NULL DEFAULT 'legacy'`; // 'legacy' = PPN hanya info (dokumen lama); 'inclusive' = harga sudah termasuk PPN
      await sql`CREATE INDEX IF NOT EXISTS invoices_owner_idx ON invoices (created_by, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status)`;
      await sql`CREATE INDEX IF NOT EXISTS invoices_number_idx ON invoices (invoice_number)`;
      await sql`
        CREATE TABLE IF NOT EXISTS invoice_items (
          item_id BIGSERIAL PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
          line_no INT NOT NULL DEFAULT 0,
          product_name TEXT NOT NULL DEFAULT '',
          variant TEXT NOT NULL DEFAULT '',
          qty NUMERIC NOT NULL DEFAULT 0,
          unit_price NUMERIC NOT NULL DEFAULT 0,
          total_price NUMERIC NOT NULL DEFAULT 0
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (invoice_id, line_no)`;
      await sql`
        CREATE TABLE IF NOT EXISTS invoice_events (
          id BIGSERIAL PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          action TEXT NOT NULL,
          from_status TEXT NOT NULL DEFAULT '',
          to_status TEXT NOT NULL DEFAULT '',
          by_user TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx ON invoice_events (invoice_id, at)`;
    }).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

// Kolom NUMERIC dikembalikan sebagai angka biasa (bukan string) supaya UI/PDF/Word tidak perlu mengonversi.
const SELECT_INVOICE = `
  invoice_id, invoice_number, doc_type, invoice_date, customer_name, customer_address,
  subtotal::float8 AS subtotal, tax_percent::float8 AS tax_percent, tax_amount::float8 AS tax_amount, grand_total::float8 AS grand_total,
  amount_in_words, status, tax_mode, use_signature, signature_store, signature_pic,
  created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, approved_by, approved_at,
  reject_note, rejected_by, rejected_at, void_note, voided_by, voided_at`;

export interface InvoiceRow {
  invoice_id: string; invoice_number: string; doc_type: string; invoice_date: string;
  customer_name: string; customer_address: string;
  subtotal: number; tax_percent: number; tax_amount: number; grand_total: number; amount_in_words: string;
  status: InvoiceStatus; tax_mode: string; use_signature: boolean; signature_store: string; signature_pic: string;
  created_by: string; created_at: string; updated_by: string; updated_at: string;
  submitted_by: string; submitted_at: string | null; approved_by: string; approved_at: string | null;
  reject_note: string; rejected_by: string; rejected_at: string | null;
  void_note: string; voided_by: string; voided_at: string | null;
}
export interface ItemRow { item_id: number; invoice_id: string; line_no: number; product_name: string; variant: string; qty: number; unit_price: number; total_price: number }

export async function listInvoices(actor: Actor): Promise<(InvoiceRow & { item_count: number; qty_total: number })[]> {
  await ensureInvoiceSchema();
  // Approver melihat semua; selain itu hanya dokumen buatannya sendiri (ditegakkan di query, bukan di UI).
  const EXTRA = `,
    (SELECT count(*)::int FROM invoice_items i WHERE i.invoice_id = invoices.invoice_id) AS item_count,
    (SELECT COALESCE(sum(qty), 0)::float8 FROM invoice_items i WHERE i.invoice_id = invoices.invoice_id) AS qty_total`;
  const rows = actor.isApprover
    ? await sql(`SELECT ${SELECT_INVOICE}${EXTRA} FROM invoices WHERE status <> 'deleted' ORDER BY created_at DESC`)
    : await sql(`SELECT ${SELECT_INVOICE}${EXTRA} FROM invoices WHERE status <> 'deleted' AND created_by = $1 ORDER BY created_at DESC`, [actor.userName]);
  return rows as (InvoiceRow & { item_count: number; qty_total: number })[];
}

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  await ensureInvoiceSchema();
  const rows = await sql(`SELECT ${SELECT_INVOICE} FROM invoices WHERE invoice_id = $1`, [id]);
  return (rows[0] as InvoiceRow) || null;
}

export async function getItems(id: string): Promise<ItemRow[]> {
  await ensureInvoiceSchema();
  return (await sql(
    `SELECT item_id, invoice_id, line_no, product_name, variant, qty::float8 AS qty, unit_price::float8 AS unit_price, total_price::float8 AS total_price
     FROM invoice_items WHERE invoice_id = $1 ORDER BY line_no, item_id`, [id])) as ItemRow[];
}

export async function getEvents(id: string) {
  await ensureInvoiceSchema();
  return sql`SELECT action, from_status, to_status, by_user, note, at FROM invoice_events WHERE invoice_id = ${id} ORDER BY at ASC, id ASC`;
}

export async function addEvent(id: string, action: string, by: string, from = "", to = "", note = "") {
  await sql`INSERT INTO invoice_events (invoice_id, action, from_status, to_status, by_user, note) VALUES (${id}, ${action}, ${from}, ${to}, ${by}, ${note.slice(0, 500)})`;
}

// Satu pintu untuk dokumen yang boleh dilihat user (404 jika tidak ada ATAU bukan miliknya — tidak membocorkan keberadaan).
export async function getVisibleInvoice(id: string, actor: Actor): Promise<{ invoice: InvoiceRow; items: ItemRow[] } | null> {
  const invoice = await getInvoice(id);
  if (!invoice || invoice.status === "deleted" || !canView(invoice, actor)) return null;
  return { invoice, items: await getItems(id) };
}

// Hak user dari izin di akun (untuk invoiceFlow).
export function actorOf(u: UserRow): Actor {
  const t = (k: string) => u[k] === "TRUE";
  const superAdmin = u.role === "super_admin";
  return { userName: u.user_name, isApprover: superAdmin || t("invoice_approval"), isSuperAdmin: superAdmin, canCreate: t("invoice_create"), canEdit: t("invoice_edit"), canDelete: t("invoice_delete") };
}

// ── Validasi & hitung ───────────────────────────────────────────────────────
export interface InvoiceInput {
  doc_type?: string;
  invoice_number?: string;
  invoice_date?: string;
  customer_name?: string;
  customer_address?: string;
  tax_percent?: number;
  use_signature?: boolean;
  signature_store?: string;
  signature_pic?: string;
  items?: { product_name: string; variant?: string; qty: number; unit_price: number }[];
}

export interface NormalizedInvoice {
  doc_type: "invoice" | "quotation"; invoice_number: string; invoice_date: string; customer_name: string; customer_address: string;
  tax_percent: number; use_signature: boolean; signature_store: string; signature_pic: string;
  items: { product_name: string; variant: string; qty: number; unit_price: number; total_price: number }[];
  subtotal: number; tax_amount: number; grand_total: number; amount_in_words: string;
}

export function normalizeInput(b: InvoiceInput): { ok: true; v: NormalizedInvoice } | { ok: false; error: string } {
  const doc_type = b.doc_type === "quotation" ? "quotation" : "invoice";
  const customer_name = String(b.customer_name || "").trim().slice(0, 200);
  const invoice_date = String(b.invoice_date || "").slice(0, 10);
  if (!customer_name) return { ok: false, error: "Nama customer wajib diisi" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice_date)) return { ok: false, error: "Tanggal tidak valid" };
  const invoice_number = String(b.invoice_number || "").trim().slice(0, 60);
  if (doc_type === "invoice" && !invoice_number) return { ok: false, error: "Nomor invoice wajib diisi" };
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map((it) => {
    const qty = Number(it.qty), unit = Number(it.unit_price);
    return { product_name: String(it.product_name || "").trim().slice(0, 300), variant: String(it.variant || "").slice(0, 100), qty, unit_price: unit, total_price: Math.round(qty * unit) };
  });
  if (!items.length) return { ok: false, error: "Minimal satu item" };
  if (items.some((it) => !it.product_name)) return { ok: false, error: "Nama produk wajib diisi" };
  if (items.some((it) => !Number.isFinite(it.qty) || !Number.isFinite(it.unit_price) || !(it.qty > 0) || !(it.unit_price >= 0))) {
    return { ok: false, error: "Qty harus > 0 dan harga tidak boleh negatif" };
  }
  const tax_percent = Math.max(0, Math.min(100, Number(b.tax_percent) || 0));
  // Harga barang SUDAH TERMASUK PPN. Dengan PPN dicentang: subtotal = DPP (tanpa PPN), PPN = total − DPP, total tetap = total harga.
  const bd = taxBreakdown(items, tax_percent);
  const subtotal = bd.dpp;
  const tax_amount = bd.ppn;
  const grand_total = bd.total;
  return {
    ok: true,
    v: {
      doc_type, invoice_number, invoice_date, customer_name,
      customer_address: String(b.customer_address || "").slice(0, 500),
      tax_percent, use_signature: !!b.use_signature,
      signature_store: String(b.signature_store || "").slice(0, 100),
      signature_pic: String(b.signature_pic || "").slice(0, 100),
      items, subtotal, tax_amount, grand_total, amount_in_words: terbilang(grand_total),
    },
  };
}

// Nomor invoice (manual) tidak boleh kembar dengan dokumen lain yang masih berlaku.
export async function numberTaken(number: string, exceptId = ""): Promise<boolean> {
  if (!number) return false;
  await ensureInvoiceSchema();
  const r = await sql`SELECT 1 FROM invoices WHERE invoice_number = ${number} AND invoice_id <> ${exceptId} AND status NOT IN ('deleted', 'void') LIMIT 1`;
  return r.length > 0;
}

async function writeItems(id: string, items: { product_name: string; variant: string; qty: number; unit_price: number; total_price: number }[]) {
  await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
  let n = 0;
  for (const it of items) {
    n++;
    await sql`INSERT INTO invoice_items (invoice_id, line_no, product_name, variant, qty, unit_price, total_price)
              VALUES (${id}, ${n}, ${it.product_name}, ${it.variant}, ${it.qty}, ${it.unit_price}, ${it.total_price})`;
  }
}

export async function createInvoice(v: NormalizedInvoice, by: string): Promise<string> {
  await ensureInvoiceSchema();
  const id = `${Date.now()}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
  await sql`
    INSERT INTO invoices (invoice_id, invoice_number, doc_type, invoice_date, customer_name, customer_address, subtotal, tax_percent, tax_amount, grand_total,
                          amount_in_words, status, tax_mode, use_signature, signature_store, signature_pic, created_by, updated_by)
    VALUES (${id}, ${v.doc_type === "quotation" ? "" : v.invoice_number}, ${v.doc_type}, ${v.invoice_date}, ${v.customer_name}, ${v.customer_address},
            ${v.subtotal}, ${v.tax_percent}, ${v.tax_amount}, ${v.grand_total}, ${v.amount_in_words}, 'draft', 'inclusive', ${v.use_signature},
            ${v.signature_store}, ${v.signature_pic}, ${by}, ${by})`;
  await writeItems(id, v.items);
  await addEvent(id, "created", by, "", "draft");
  return id;
}

export async function updateInvoice(id: string, v: NormalizedInvoice, by: string, status = "draft") {
  await ensureInvoiceSchema();
  await sql`
    UPDATE invoices SET invoice_number = ${v.doc_type === "quotation" ? "" : v.invoice_number}, doc_type = ${v.doc_type}, invoice_date = ${v.invoice_date},
      customer_name = ${v.customer_name}, customer_address = ${v.customer_address}, subtotal = ${v.subtotal}, tax_percent = ${v.tax_percent},
      tax_amount = ${v.tax_amount}, grand_total = ${v.grand_total}, amount_in_words = ${v.amount_in_words}, tax_mode = 'inclusive', use_signature = ${v.use_signature},
      signature_store = ${v.signature_store}, signature_pic = ${v.signature_pic}, updated_by = ${by}, updated_at = now()
    WHERE invoice_id = ${id}`;
  await writeItems(id, v.items);
  await addEvent(id, "updated", by, status, status, status === "draft" ? "" : `Diubah oleh ${status === "void" ? "Super Admin" : "approver"} saat ${status}`);
}

// Terapkan perpindahan status (sudah divalidasi oleh invoiceFlow.transition) + catat riwayat.
export async function applyTransition(id: string, action: InvoiceAction, from: string, to: InvoiceStatus, by: string, note: string) {
  await ensureInvoiceSchema();
  if (action === "submit") {
    await sql`UPDATE invoices SET status = ${to}, submitted_by = ${by}, submitted_at = now(), reject_note = '', updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "recall") {
    await sql`UPDATE invoices SET status = ${to}, updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "approve") {
    await sql`UPDATE invoices SET status = ${to}, approved_by = ${by}, approved_at = now(), updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "reject") {
    await sql`UPDATE invoices SET status = ${to}, reject_note = ${note.slice(0, 500)}, rejected_by = ${by}, rejected_at = now(), updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "void") {
    await sql`UPDATE invoices SET status = ${to}, void_note = ${note.slice(0, 500)}, voided_by = ${by}, voided_at = now(), updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "restore") {
    // Void → Approved (Super Admin): jejak void tetap ada di riwayat; kolom void dikosongkan agar tampilan tidak menyesatkan
    await sql`UPDATE invoices SET status = ${to}, void_note = '', voided_by = '', voided_at = NULL, updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  } else if (action === "delete") {
    await sql`UPDATE invoices SET status = ${to}, updated_by = ${by}, updated_at = now() WHERE invoice_id = ${id}`;
  }
  await addEvent(id, action, by, from, to, note);
}

// ── Master (kop, tanda tangan, PPN) ─────────────────────────────────────────
export async function getMaster(): Promise<Record<string, any>> {
  await ensureInvoiceSchema();
  const r = await sql`SELECT header_image_url, company_name, company_address, company_phone, company_email, signature_image_url,
                             default_use_signature, default_use_ppn, ppn_percentage::float8 AS ppn_percentage, invoice_prefix, next_invoice_number, updated_by, updated_at
                      FROM invoice_master WHERE id = 1`;
  return r[0] || {};
}

export async function saveMaster(b: Record<string, any>, by: string) {
  await ensureInvoiceSchema();
  const cur = await getMaster();
  const pick = (k: string, d: any = "") => (b[k] !== undefined ? b[k] : cur[k] ?? d);
  await sql`
    INSERT INTO invoice_master (id, header_image_url, company_name, company_address, company_phone, company_email, signature_image_url,
                                default_use_signature, default_use_ppn, ppn_percentage, invoice_prefix, next_invoice_number, updated_by)
    VALUES (1, ${String(pick("header_image_url"))}, ${String(pick("company_name"))}, ${String(pick("company_address"))}, ${String(pick("company_phone"))},
            ${String(pick("company_email"))}, ${String(pick("signature_image_url"))}, ${!!pick("default_use_signature", false)}, ${!!pick("default_use_ppn", false)},
            ${Number(pick("ppn_percentage", 11)) || 11}, ${String(pick("invoice_prefix", "INV")) || "INV"}, ${Number(pick("next_invoice_number", 1)) || 1}, ${by})
    ON CONFLICT (id) DO UPDATE SET header_image_url = EXCLUDED.header_image_url, company_name = EXCLUDED.company_name, company_address = EXCLUDED.company_address,
      company_phone = EXCLUDED.company_phone, company_email = EXCLUDED.company_email, signature_image_url = EXCLUDED.signature_image_url,
      default_use_signature = EXCLUDED.default_use_signature, default_use_ppn = EXCLUDED.default_use_ppn, ppn_percentage = EXCLUDED.ppn_percentage,
      invoice_prefix = EXCLUDED.invoice_prefix, next_invoice_number = EXCLUDED.next_invoice_number, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export async function countNeedApproval(): Promise<number> {
  await ensureInvoiceSchema();
  const r = await sql`SELECT count(*)::int AS n FROM invoices WHERE status = 'submitted'`;
  return r[0]?.n ?? 0;
}
