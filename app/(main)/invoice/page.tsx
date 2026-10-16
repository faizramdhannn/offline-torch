"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import Popup from "@/components/Popup";
import MasterSettingsModal from "@/components/invoice/MasterSettingsModal";
import { StatusBadge, docLabel, fmtDate, rupiah, type InvoiceDoc, type MasterInvoice } from "@/components/invoice/shared";

// Daftar Invoice/Quotation. Tanpa izin invoice_approval, server hanya mengirim dokumen buatan user itu sendiri.
const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Need Approval" },
  { key: "approved", label: "Approved" },
  { key: "void", label: "Void" },
];
const PER_PAGE = 20;

export default function InvoicePage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  useSessionGuard();
  const [user, setUser] = useState<any>(null);
  const [docs, setDocs] = useState<InvoiceDoc[]>([]);
  const [master, setMaster] = useState<MasterInvoice>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "all");
  const [type, setType] = useState(sp.get("type") ?? "all");
  const [page, setPage] = useState(1);
  const [showMaster, setShowMaster] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const u = JSON.parse(raw);
    if (!u.invoice) { router.push("/dashboard"); return; }
    setUser(u);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([fetch("/api/invoice", { cache: "no-store" }), fetch("/api/invoice/master", { cache: "no-store" })]);
      const list = await a.json();
      setDocs(Array.isArray(list) ? list : []);
      setMaster((await b.json()) || {});
    } catch {
      setToast({ msg: "Gagal memuat data", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    if (type !== "all") p.set("type", type);
    const s = p.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    setPage(1);
  }, [q, status, type, pathname, router]);

  const isApprover = !!user?.invoice_approval;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    for (const d of docs) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [docs]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return docs.filter((d) =>
      (status === "all" || d.status === status) &&
      (type === "all" || d.doc_type === type) &&
      (!s || d.invoice_number.toLowerCase().includes(s) || d.customer_name.toLowerCase().includes(s) || d.created_by.toLowerCase().includes(s))
    );
  }, [docs, q, status, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Ringkasan (dihitung dari dokumen yang boleh dilihat user): menunggu approval, Approved bulan ini, rata-rata waktu approval (30 hari)
  const stats = useMemo(() => {
    const wib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 7);
    const month = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
    const approvedNow = docs.filter((d) => d.status === "approved" && d.approved_at && wib(d.approved_at) === month);
    const invoiceValue = approvedNow.filter((d) => d.doc_type === "invoice").reduce((s, d) => s + d.grand_total, 0);
    const since = Date.now() - 30 * 86400_000;
    const times = docs
      .filter((d) => d.approved_at && d.submitted_at && new Date(d.approved_at).getTime() >= since)
      .map((d) => new Date(d.approved_at as string).getTime() - new Date(d.submitted_at as string).getTime())
      .filter((ms) => ms >= 0);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const fmt = (ms: number) => {
      const m = Math.round(ms / 60000);
      if (m < 60) return `${m} menit`;
      if (m < 60 * 48) return `${Math.floor(m / 60)} jam ${m % 60} mnt`;
      return `${Math.round(m / 1440)} hari`;
    };
    return { waiting: docs.filter((d) => d.status === "submitted").length, drafts: docs.filter((d) => d.status === "draft").length, approvedCount: approvedNow.length, invoiceValue, avg: avg === null ? "—" : fmt(avg), avgN: times.length };
  }, [docs]);

  if (!user) return null;
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Invoice</h1>
          <p className="text-xs text-gray-500">{isApprover ? "Semua dokumen" : "Dokumen buatan Anda"}</p>
        </div>
        <div className="flex gap-2">
          {user.invoice_master && <button onClick={() => setShowMaster(true)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">Pengaturan master</button>}
          {(user.invoice_create || isApprover) && <Link href="/invoice/new" className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800">+ Buat dokumen</Link>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Menunggu approval", value: String(stats.waiting), sub: isApprover ? "perlu tindakan" : "dokumen Anda", tone: stats.waiting ? "text-amber-600" : "text-gray-800" },
          { label: "Draft", value: String(stats.drafts), sub: "belum diajukan", tone: "text-gray-800" },
          { label: "Approved bulan ini", value: String(stats.approvedCount), sub: `Invoice ${rupiah(stats.invoiceValue)}`, tone: "text-green-700" },
          { label: "Rata-rata waktu approval", value: stats.avg, sub: stats.avgN ? `${stats.avgN} dokumen · 30 hari` : "belum ada data", tone: "text-gray-800" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-3.5">
            <p className="text-[11px] text-gray-500">{c.label}</p>
            <p className={`mt-0.5 text-xl font-bold ${c.tone}`}>{c.value}</p>
            <p className="truncate text-[11px] text-gray-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {isApprover && (counts.submitted || 0) > 0 && (
        <button onClick={() => setStatus("submitted")} className="mb-4 flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
          <span><b>{counts.submitted}</b> dokumen menunggu approval Anda</span><span className="text-xs underline">Lihat</span>
        </button>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)} className={`rounded-full border px-3 py-1.5 text-xs ${status === f.key ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-600"}`}>
            {f.label} <span className="opacity-60">{counts[f.key] || 0}</span>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor, customer, pembuat…" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm md:max-w-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="all">Semua tipe</option>
          <option value="invoice">Invoice</option>
          <option value="quotation">Quotation</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Memuat…</p>
        ) : shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">Tidak ada dokumen.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Dokumen</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
                {isApprover && <th className="px-4 py-2.5">Pembuat</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.invoice_id} onClick={() => router.push(`/invoice/${d.invoice_id}`)} className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{d.doc_type === "quotation" ? "Quotation" : d.invoice_number || "—"}</p>
                    <p className="text-[11px] text-gray-400">{docLabel(d.doc_type)}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{d.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(d.invoice_date)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{rupiah(d.grand_total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  {isApprover && <td className="px-4 py-3 text-gray-500">{d.created_by || "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} dari {filtered.length}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40">Sebelumnya</button>
            <button disabled={page === pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      )}

      {showMaster && (
        <MasterSettingsModal
          initial={master}
          onClose={() => setShowMaster(false)}
          onSave={async (m) => {
            const r = await fetch("/api/invoice/master", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
            if (!r.ok) { setToast({ msg: "Gagal menyimpan pengaturan", type: "error" }); return; }
            setShowMaster(false);
            setToast({ msg: "Pengaturan disimpan", type: "success" });
            load();
          }}
        />
      )}
      <Popup show={!!toast} message={toast?.msg || ""} type={toast?.type || "success"} onClose={() => setToast(null)} />
    </div>
  );
}
