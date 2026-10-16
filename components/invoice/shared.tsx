"use client";

import { STATUS_LABEL } from "@/lib/invoiceFlow";

// ── Tipe data (bentuk balasan /api/invoice) ──────────────────────────────────
export interface InvoiceDoc {
  invoice_id: string; invoice_number: string; doc_type: "invoice" | "quotation"; invoice_date: string;
  customer_name: string; customer_address: string;
  subtotal: number; tax_percent: number; tax_amount: number; grand_total: number; amount_in_words: string;
  status: "draft" | "submitted" | "approved" | "void" | "deleted";
  tax_mode?: string;
  use_signature: boolean; signature_store: string; signature_pic: string;
  created_by: string; created_at: string; updated_by: string; updated_at: string;
  submitted_by: string; submitted_at: string | null; approved_by: string; approved_at: string | null;
  reject_note: string; rejected_by: string; rejected_at: string | null;
  void_note: string; voided_by: string; voided_at: string | null;
}
export interface InvoiceLine { product_name: string; variant?: string; qty: number; unit_price: number; total_price?: number }
export interface InvoiceEvent { action: string; from_status: string; to_status: string; by_user: string; note: string; at: string }
export interface MasterInvoice {
  header_image_url?: string; company_name?: string; company_address?: string; company_phone?: string; company_email?: string;
  signature_image_url?: string; default_use_signature?: boolean; default_use_ppn?: boolean; ppn_percentage?: number;
}
export interface MasterItem { SKU: string; Product_name: string; HPJ: string; Stock?: string }

export const rupiah = (n: number | string) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
// Harga satuan tanpa PPN bisa berdesimal (mis. Rp 359.459,33); selain itu bulat.
export const rupiahDec = (n: number | string) => {
  const v = Number(n) || 0;
  return "Rp " + (Number.isInteger(v) ? v.toLocaleString("id-ID") : v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};
export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
};
export const docLabel = (t: string) => (t === "quotation" ? "Quotation" : "Invoice");

// Penanda toko untuk tanda tangan di dokumen
export const TORCH_STORES = ["Torch Lembong", "Torch Margonda", "Torch Karawaci", "Torch Jogja", "Torch Makassar", "Torch Cirebon", "Torch Purwokerto", "Torch Karawang", "Torch Pekalongan", "Torch Lampung", "Torch Surabaya", "Torch Malang"];

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-600",
  deleted: "bg-red-100 text-red-600",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status] || "bg-gray-100 text-gray-500"} ${className}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// Stepper alur dokumen: Draft → Need Approval → Approved (Void = berakhir di Approved yang dibatalkan)
export function StatusStepper({ status }: { status: string }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "submitted", label: "Need Approval" },
    { key: "approved", label: "Approved" },
  ];
  const idx = status === "void" ? 2 : Math.max(0, steps.findIndex((s) => s.key === status));
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && status !== "void");
        const current = i === idx;
        const isVoid = status === "void" && i === 2;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              isVoid ? "bg-red-500 text-white" : done ? (current ? "bg-gray-900 text-white" : "bg-green-500 text-white") : "bg-gray-200 text-gray-500"}`}>
              {isVoid ? "×" : done && !current ? "✓" : i + 1}
            </span>
            <span className={`truncate ${current ? "font-semibold text-gray-800" : "text-gray-400"}`}>{isVoid ? "Void" : s.label}</span>
            {i < steps.length - 1 && <span className={`h-px flex-1 ${i < idx ? "bg-green-400" : "bg-gray-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

const ACTION_TEXT: Record<string, string> = {
  created: "Dibuat", updated: "Diubah", submitted: "Diajukan (Need Approval)", submit: "Diajukan (Need Approval)",
  recall: "Ditarik kembali ke Draft", approve: "Di-approve", reject: "Dikembalikan ke Draft (Reject)", void: "Di-void",
  delete: "Dihapus", migrated: "Dipindahkan dari spreadsheet",
};
export function EventTimeline({ events }: { events: InvoiceEvent[] }) {
  if (!events.length) return <p className="text-xs text-gray-400">Belum ada riwayat.</p>;
  return (
    <ol className="relative space-y-3 border-l border-gray-200 pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-400" />
          <p className="text-xs font-medium text-gray-700">{ACTION_TEXT[e.action] || e.action}</p>
          {e.note && <p className="mt-0.5 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">{e.note}</p>}
          <p className="text-[11px] text-gray-400">{e.by_user || "sistem"} · {fmtDateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
