"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import Popup from "@/components/Popup";
import {
  EventTimeline, StatusBadge, StatusStepper, docLabel, fmtDate, fmtDateTime, rupiah,
  rupiahDec, type InvoiceDoc, type InvoiceEvent, type InvoiceLine,
} from "@/components/invoice/shared";

type Action = "submit" | "recall" | "approve" | "reject" | "void" | "restore" | "delete";
interface Detail { invoice: InvoiceDoc; items: (InvoiceLine & { total_price: number })[]; events: InvoiceEvent[]; actions: Action[]; can_edit: boolean }

// Halaman dokumen ala ERP: status + alur, aksi sesuai peran, isi dokumen, dan riwayat.
export default function InvoiceDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useSessionGuard();
  const [d, setD] = useState<Detail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [busy, setBusy] = useState("");
  const [noteFor, setNoteFor] = useState<"reject" | "void" | "restore" | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { try { const u = JSON.parse(localStorage.getItem("user") || "{}"); setCanCreate(!!(u.invoice_create || u.invoice_approval)); } catch {} }, []);

  const load = useCallback(async () => {
    const r = await fetch(`/api/invoice?id=${id}`, { cache: "no-store" });
    if (!r.ok) { setState("missing"); return; }
    setD(await r.json());
    setState("ok");
  }, [id]);
  useEffect(() => {
    if (!localStorage.getItem("user")) { router.push(`/login?next=/invoice/${id}`); return; }
    load();
  }, [id, router, load]);

  const act = async (action: Action, withNote = "") => {
    setBusy(action);
    try {
      if (action === "delete") {
        const r = await fetch(`/api/invoice?id=${id}`, { method: "DELETE" });
        if (!r.ok) { setToast({ msg: (await r.json().catch(() => ({}))).error || "Gagal menghapus", type: "error" }); return; }
        router.push("/invoice");
        return;
      }
      const r = await fetch("/api/invoice/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: id, action, note: withNote }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setToast({ msg: j.error || "Gagal", type: "error" }); return; }
      setNoteFor(null);
      setNote("");
      setToast({ msg: { submit: "Diajukan ke approver", recall: "Ditarik kembali ke Draft", approve: "Dokumen di-approve", reject: "Dikembalikan ke Draft", void: "Dokumen di-void", restore: "Dokumen dikembalikan ke Approved" }[action] || "Berhasil", type: "success" });
      await load();
    } finally {
      setBusy("");
    }
  };

  // Pratinjau PDF di halaman (layar lebar); di HP PDF tertanam sering kosong, jadi pakai "Lihat PDF"
  const showPreview = async () => {
    setBusy("preview");
    try {
      const r = await fetch("/api/invoice/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: id }) });
      if (!r.ok) throw new Error();
      setPreviewUrl(URL.createObjectURL(await r.blob()));
    } catch {
      setToast({ msg: "Gagal membuat pratinjau PDF", type: "error" });
    } finally {
      setBusy("");
    }
  };

  const file = async (kind: "pdf" | "word", mode: "view" | "download") => {
    if (!d) return;
    setBusy(kind);
    try {
      const r = await fetch(`/api/invoice/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: id }) });
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      if (mode === "view") { window.open(url, "_blank"); return; }
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docLabel(d.invoice.doc_type)}_${d.invoice.invoice_number || d.invoice.customer_name}.${kind === "pdf" ? "pdf" : "docx"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setToast({ msg: `Gagal membuat ${kind === "pdf" ? "PDF" : "Word"}`, type: "error" });
    } finally {
      setBusy("");
    }
  };

  if (state === "loading") return <p className="p-6 text-sm text-gray-400">Memuat…</p>;
  if (state === "missing" || !d) return <div className="p-6 text-sm text-gray-500">Dokumen tidak ditemukan. <Link href="/invoice" className="underline">Kembali ke daftar</Link></div>;

  const inv = d.invoice;
  const has = (a: Action) => d.actions.includes(a);
  const title = inv.doc_type === "quotation" ? "Quotation" : `Invoice ${inv.invoice_number || ""}`;
  const btn = "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50";
  const ghost = `${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;
  const solid = `${btn} bg-gray-900 text-white hover:bg-gray-800`;

  return (
    <div className="p-4 pb-28 md:p-6 md:pb-6">
      <Link href="/invoice" className="text-xs text-gray-500 hover:underline">← Daftar dokumen</Link>
      <div className="mt-1 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">{title}</h1>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-xs text-gray-500">{inv.customer_name} · {fmtDate(inv.invoice_date)} · dibuat oleh {inv.created_by || "—"}</p>
        </div>
        {/* Aksi (desktop) */}
        <div className="hidden flex-wrap gap-2 md:flex">
          {d.can_edit && <Link href={`/invoice/${id}/edit`} className={ghost}>Ubah</Link>}
          {has("recall") && <button disabled={!!busy} onClick={() => confirm("Tarik kembali ke Draft?") && act("recall")} className={ghost}>Tarik kembali</button>}
          {has("delete") && <button disabled={!!busy} onClick={() => confirm("Hapus draft ini?") && act("delete")} className={`${ghost} text-red-600`}>Hapus</button>}
          {has("reject") && <button disabled={!!busy} onClick={() => setNoteFor("reject")} className={`${ghost} text-red-600`}>Reject</button>}
          {has("void") && <button disabled={!!busy} onClick={() => setNoteFor("void")} className={`${ghost} text-red-600`}>Void</button>}
          {has("restore") && <button disabled={!!busy} onClick={() => setNoteFor("restore")} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Kembalikan ke Approved</button>}
          {inv.doc_type === "quotation" && inv.status === "approved" && canCreate && <Link href={`/invoice/new?from=${id}`} className={ghost}>Jadikan Invoice</Link>}
          {has("submit") && <button disabled={!!busy} onClick={() => confirm("Ajukan dokumen ini untuk di-approve? Setelah diajukan, dokumen tidak bisa diubah.") && act("submit")} className={solid}>Ajukan (Need Approval)</button>}
          {has("approve") && <button disabled={!!busy} onClick={() => confirm("Approve dokumen ini?") && act("approve")} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Approve</button>}
        </div>
      </div>

      {inv.status === "draft" && inv.reject_note && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Dikembalikan oleh {inv.rejected_by || "approver"}</p>
          <p className="mt-0.5">{inv.reject_note}</p>
          <p className="mt-1 text-xs opacity-70">Perbaiki, lalu ajukan kembali.</p>
        </div>
      )}
      {inv.status === "void" && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Di-void oleh {inv.voided_by || "approver"} · {fmtDateTime(inv.voided_at)}</p>
          <p className="mt-0.5">{inv.void_note}</p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4"><StatusStepper status={inv.status} /></div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Informasi</h2>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-gray-400">Tipe</dt><dd>{docLabel(inv.doc_type)}</dd></div>
              <div><dt className="text-xs text-gray-400">Nomor</dt><dd>{inv.invoice_number || "—"}</dd></div>
              <div><dt className="text-xs text-gray-400">Customer</dt><dd>{inv.customer_name}</dd></div>
              <div><dt className="text-xs text-gray-400">Tanggal</dt><dd>{fmtDate(inv.invoice_date)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Alamat</dt><dd className="whitespace-pre-line">{inv.customer_address || "—"}</dd></div>
              {inv.use_signature && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Tanda tangan</dt><dd>{inv.signature_store || "—"}{inv.signature_pic ? ` · ${inv.signature_pic}` : ""}</dd></div>}
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Item</h2>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="py-2 pr-3">Produk</th><th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Harga</th><th className="py-2 text-right">Total</th></tr>
              </thead>
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3 text-gray-800">{it.product_name}{it.variant ? <span className="text-gray-400"> · {it.variant}</span> : null}</td>
                    <td className="py-2 pr-3 text-right">{it.qty}</td>
                    <td className="py-2 pr-3 text-right">{rupiahDec(it.unit_price)}</td>
                    <td className="py-2 text-right font-medium">{rupiah(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">{inv.tax_percent > 0 && inv.tax_mode === "inclusive" ? "Subtotal (tanpa PPN)" : "Subtotal"}</dt><dd>{rupiah(inv.subtotal)}</dd></div>
              {inv.tax_percent > 0 && <div className="flex justify-between"><dt className="text-gray-500">PPN{inv.tax_mode === "inclusive" ? "" : " (info)"}</dt><dd className={inv.tax_mode === "inclusive" ? "" : "text-gray-500"}>{rupiah(inv.tax_amount)}</dd></div>}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold"><dt>Total</dt><dd>{rupiah(inv.grand_total)}</dd></div>
            </dl>
            <p className="mt-2 text-xs italic text-gray-500">Terbilang: {inv.amount_in_words}</p>
          </section>

          {previewUrl && (
            <section className="hidden rounded-xl border border-gray-200 bg-white p-4 md:block">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-gray-800">Pratinjau PDF</h2><button onClick={() => setPreviewUrl(null)} className="text-xs text-gray-400 hover:underline">Tutup</button></div>
              <iframe src={previewUrl} title="Pratinjau PDF" className="h-[80vh] w-full rounded-lg border border-gray-100" />
            </section>
          )}
        </div>

        <div className="space-y-4">
          {inv.status === "approved" && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">Unduh dokumen</h2>
              <div className="grid gap-2">
                <button disabled={!!busy} onClick={showPreview} className={`${ghost} hidden md:inline-flex`}>{busy === "preview" ? "Membuat…" : previewUrl ? "Muat ulang pratinjau" : "Tampilkan pratinjau"}</button>
                <button disabled={!!busy} onClick={() => file("pdf", "view")} className={ghost}>{busy === "pdf" ? "Membuat…" : "Lihat PDF"}</button>
                <button disabled={!!busy} onClick={() => file("pdf", "download")} className={ghost}>Unduh PDF</button>
                <button disabled={!!busy} onClick={() => file("word", "download")} className={ghost}>{busy === "word" ? "Membuat…" : "Unduh Word"}</button>
              </div>
            </section>
          )}
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-800">Riwayat</h2>
            <EventTimeline events={d.events} />
          </section>
        </div>
      </div>

      {/* Aksi (HP): bar bawah */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 border-t border-gray-200 bg-white/95 p-3 backdrop-blur md:hidden">
        {d.can_edit && <Link href={`/invoice/${id}/edit`} className={`${ghost} flex-1`}>Ubah</Link>}
        {inv.doc_type === "quotation" && inv.status === "approved" && canCreate && <Link href={`/invoice/new?from=${id}`} className={`${ghost} flex-1`}>Jadikan Invoice</Link>}
        {has("recall") && <button disabled={!!busy} onClick={() => confirm("Tarik kembali ke Draft?") && act("recall")} className={`${ghost} flex-1`}>Tarik kembali</button>}
        {has("delete") && <button disabled={!!busy} onClick={() => confirm("Hapus draft ini?") && act("delete")} className={`${ghost} flex-1 text-red-600`}>Hapus</button>}
        {has("reject") && <button disabled={!!busy} onClick={() => setNoteFor("reject")} className={`${ghost} flex-1 text-red-600`}>Reject</button>}
        {has("void") && <button disabled={!!busy} onClick={() => setNoteFor("void")} className={`${ghost} flex-1 text-red-600`}>Void</button>}
        {has("restore") && <button disabled={!!busy} onClick={() => setNoteFor("restore")} className={`${btn} flex-1 bg-green-600 text-white`}>Kembalikan ke Approved</button>}
        {has("submit") && <button disabled={!!busy} onClick={() => confirm("Ajukan dokumen ini untuk di-approve? Setelah diajukan, dokumen tidak bisa diubah.") && act("submit")} className={`${solid} flex-1`}>Ajukan</button>}
        {has("approve") && <button disabled={!!busy} onClick={() => confirm("Approve dokumen ini?") && act("approve")} className={`${btn} flex-1 bg-green-600 text-white`}>Approve</button>}
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setNoteFor(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">{noteFor === "reject" ? "Reject (kembalikan ke Draft)" : noteFor === "restore" ? "Kembalikan ke Approved" : "Void dokumen"}</h3>
            <p className="mb-3 text-xs text-gray-500">{noteFor === "reject" ? "Tim toko akan melihat alasan ini, memperbaiki, lalu mengajukan ulang." : noteFor === "restore" ? "Dokumen Void menjadi Approved lagi (PDF/Word tersedia kembali). Riwayat void tetap tercatat." : "Dokumen Approved dibatalkan; nomor tetap tercatat. Hanya Super Admin yang bisa mengembalikannya."}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Alasan (wajib)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNoteFor(null)} className="rounded-lg px-4 py-2 text-xs text-gray-500 hover:bg-gray-100">Batal</button>
              <button disabled={!note.trim() || !!busy} onClick={() => act(noteFor, note.trim())} className={`rounded-lg px-5 py-2 text-xs font-medium text-white disabled:opacity-50 ${noteFor === "restore" ? "bg-green-600" : "bg-red-600"}`}>{noteFor === "reject" ? "Reject" : noteFor === "restore" ? "Kembalikan" : "Void"}</button>
            </div>
          </div>
        </div>
      )}
      <Popup show={!!toast} message={toast?.msg || ""} type={toast?.type || "success"} onClose={() => setToast(null)} />
    </div>
  );
}
