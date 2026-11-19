import { z } from "zod";

// Bentuk & batas input dokumen invoice/quotation (dipakai normalizeInput). Aturan bisnis (nomor invoice wajib,
// hitung pajak, dsb.) tetap di lib/invoices.ts. Pesan error berbahasa Indonesia karena langsung tampil di popup.
// Teks dipotong (bukan ditolak) bila kepanjangan — sama seperti perilaku sebelumnya.
const text = (max: number, trim = true) =>
  z.preprocess((v) => { const s = String(v ?? ""); return (trim ? s.trim() : s).slice(0, max); }, z.string());

const item = z.object({
  product_name: text(300).pipe(z.string().min(1, "Nama produk wajib diisi")),
  variant: text(100, false),
  qty: z.coerce.number("Qty harus > 0 dan harga tidak boleh negatif").refine((n) => Number.isFinite(n) && n > 0, "Qty harus > 0 dan harga tidak boleh negatif"),
  unit_price: z.coerce.number("Qty harus > 0 dan harga tidak boleh negatif").refine((n) => Number.isFinite(n) && n >= 0, "Qty harus > 0 dan harga tidak boleh negatif"),
});

export const invoiceInputSchema = z.object({
  doc_type: z.any().optional().transform((v) => (v === "quotation" ? "quotation" : "invoice") as "invoice" | "quotation"),
  customer_name: text(200).pipe(z.string().min(1, "Nama customer wajib diisi")),
  invoice_date: text(10).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")),
  invoice_number: text(60),
  customer_address: text(500, false),
  tax_percent: z.any().optional().transform((v) => Math.max(0, Math.min(100, Number(v) || 0))),
  pph21_percent: z.any().optional().transform((v) => Number(v) || 0),
  use_signature: z.any().optional().transform((v) => !!v),
  signature_store: text(100, false),
  signature_pic: text(100, false),
  items: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 200) : []), z.array(item).min(1, "Minimal satu item")),
});
export type ParsedInvoiceInput = z.infer<typeof invoiceInputSchema>;
