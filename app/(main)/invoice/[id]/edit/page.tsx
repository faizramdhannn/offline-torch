"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import InvoiceForm, { type InvoiceFormValues } from "@/components/invoice/InvoiceForm";
import type { InvoiceDoc, InvoiceLine, MasterInvoice, MasterItem } from "@/components/invoice/shared";

// Ubah dokumen: tim toko hanya Draft miliknya; approver semua status kecuali Void (server memeriksa ulang).
export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useSessionGuard();
  const [state, setState] = useState<"loading" | "ok" | "denied" | "missing">("loading");
  const [doc, setDoc] = useState<(InvoiceDoc & { items: InvoiceLine[] }) | null>(null);
  const [master, setMaster] = useState<MasterInvoice>({});
  const [items, setItems] = useState<MasterItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("user")) { router.push(`/login?next=/invoice/${id}/edit`); return; }
    Promise.all([
      fetch(`/api/invoice?id=${id}`, { cache: "no-store" }),
      fetch("/api/invoice/master").then((r) => r.json()),
      fetch("/api/master-item?mode=invoice").then((r) => r.json()),
    ]).then(async ([r, m, it]) => {
      if (!r.ok) { setState("missing"); return; }
      const d = await r.json();
      if (!d.can_edit) { setState("denied"); return; }
      setDoc({ ...d.invoice, items: d.items });
      setMaster(m || {});
      setItems(Array.isArray(it) ? it : []);
      setState("ok");
    }).catch(() => setState("missing"));
  }, [id, router]);

  const save = async (v: InvoiceFormValues) => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/invoice", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, invoice_id: id }) });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error || "Gagal menyimpan"); return; }
      router.push(`/invoice/${id}`);
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") return <p className="p-6 text-sm text-gray-400">Memuat…</p>;
  if (state !== "ok" || !doc) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {state === "denied" ? "Dokumen ini tidak bisa diubah (tim toko: hanya Draft miliknya; approver: semua status kecuali Void; dokumen Void: Super Admin)." : "Dokumen tidak ditemukan."}{" "}
        <Link href={`/invoice/${id}`} className="underline">Kembali</Link>
      </div>
    );
  }
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4"><Link href={`/invoice/${id}`} className="text-xs text-gray-500 hover:underline">← Kembali</Link><h1 className="mt-1 text-xl font-bold text-primary">Ubah dokumen</h1>{doc.status !== "draft" && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Dokumen berstatus <b>{doc.status === "submitted" ? "Need Approval" : doc.status === "void" ? "Void" : "Approved"}</b>. Perubahan Anda langsung berlaku dan tercatat di riwayat{doc.status === "approved" ? "; PDF/Word yang dibuat ulang akan memakai isi terbaru" : ""}.</p>}</div>
      <InvoiceForm mode="edit" initial={{ ...doc, items: doc.items }} master={master} masterItems={items} saving={saving} error={error} onSave={save} onCancel={() => router.push(`/invoice/${id}`)} />
    </div>
  );
}
