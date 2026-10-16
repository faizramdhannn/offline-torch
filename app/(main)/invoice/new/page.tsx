"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import InvoiceForm, { type InvoiceFormValues } from "@/components/invoice/InvoiceForm";
import type { MasterInvoice, MasterItem } from "@/components/invoice/shared";

// Buat dokumen baru → tersimpan sebagai Draft (milik pembuat); opsional langsung diajukan (Need Approval).
export default function NewInvoicePage() {
  const router = useRouter();
  const from = useSearchParams().get("from"); // id Quotation sumber (Jadikan Invoice)
  const [initial, setInitial] = useState<Partial<InvoiceFormValues> | undefined>();
  const [fromLabel, setFromLabel] = useState("");
  useSessionGuard();
  const [ready, setReady] = useState(false);
  const [master, setMaster] = useState<MasterInvoice>({});
  const [items, setItems] = useState<MasterItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lockedStore, setLockedStore] = useState<string | undefined>();
  useEffect(() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); if (u.role === "store" || u.role === "merchant") setLockedStore(u.name); } catch {} }, []);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login?next=/invoice/new"); return; }
    const u = JSON.parse(raw);
    if (!u.invoice || !(u.invoice_create || u.invoice_approval)) { router.push("/invoice"); return; }
    Promise.all([
      fetch("/api/invoice/master").then((r) => r.json()),
      fetch("/api/master-item?mode=invoice").then((r) => r.json()),
      from ? fetch(`/api/invoice?id=${from}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null),
    ])
      .then(([m, it, src]) => {
        setMaster(m || {});
        setItems(Array.isArray(it) ? it : []);
        if (src?.invoice) {
          // Salin customer, item, PPN, dan tanda tangan dari Quotation; nomor invoice diisi manual, tanggal hari ini.
          const q = src.invoice;
          setInitial({
            doc_type: "invoice", invoice_number: "", customer_name: q.customer_name, customer_address: q.customer_address,
            tax_percent: q.tax_percent, use_signature: q.use_signature, signature_store: q.signature_store, signature_pic: q.signature_pic,
            items: (src.items || []).map((i: any) => ({ product_name: i.product_name, variant: i.variant, qty: i.qty, unit_price: i.unit_price })),
          });
          setFromLabel(q.customer_name);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [router, from]);

  const save = async (v: InvoiceFormValues) => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Gagal menyimpan"); return; }
      router.push(`/invoice/${d.invoice_id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <p className="p-6 text-sm text-gray-400">Memuat…</p>;
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4"><Link href="/invoice" className="text-xs text-gray-500 hover:underline">← Kembali</Link><h1 className="mt-1 text-xl font-bold text-primary">{fromLabel ? "Invoice dari Quotation" : "Dokumen baru"}</h1>{fromLabel && <p className="mt-1 text-xs text-gray-500">Isi disalin dari Quotation {fromLabel}. Lengkapi nomor invoice, periksa isinya, lalu simpan sebagai Draft.</p>}</div>
      <InvoiceForm lockedStore={lockedStore} key={fromLabel || "new"} mode="create" initial={initial} master={master} masterItems={items} saving={saving} error={error} onSave={save} onCancel={() => router.push("/invoice")} />
    </div>
  );
}
