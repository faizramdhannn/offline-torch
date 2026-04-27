"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend,
} from "recharts";
import {
  exportStoreTab,
  exportTrafficTab,
  exportDiscountTab,
  exportProductTab,
  exportEmployeeTab,
} from "@/lib/analyticsExport";

const COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
  "#14b8a6","#e11d48","#a855f7","#22c55e","#fb923c",
  "#0ea5e9","#d946ef","#facc15","#4ade80","#fb7185",
];

function formatRupiah(val: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
}

function parseSubtotal(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function extractTrafficCode(notes: string | null | undefined, trafficMap: Record<string, string>): string | null {
  if (!notes) return null;
  const upper = notes.trim().toUpperCase();
  const tokens = upper
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^A-Z]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (trafficMap[token]) return token;
    if (token.length > 2) {
      const tail = token.slice(-2);
      if (trafficMap[tail]) return tail;
    }
  }
  return null;
}

function cleanLocationName(loc: string | null | undefined): string {
  if (!loc) return "Unknown";
  return loc
    .replace(/Torch Store\s*/i, "")
    .replace(/Torch\s*/i, "")
    .split(" - ")[0]
    .trim() || loc;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

interface Row {
  Name?: string;
  "Created at"?: string;
  "Paid at"?: string;
  Subtotal?: string;
  Notes?: string;
  "Discount Code"?: string;
  "Discount Amount"?: string;
  "Lineitem name"?: string;
  "Lineitem quantity"?: string;
  "Lineitem price"?: string;
  Employee?: string;
  Location?: string;
  [key: string]: string | null | undefined;
}

// ─── Order Detail Popup ───────────────────────────────────────────────────────
interface OrderDetailPopupProps {
  orderName: string | null;
  rows: Row[];
  trafficMap: Record<string, string>;
  onClose: () => void;
}

function OrderDetailPopup({ orderName, rows, trafficMap, onClose }: OrderDetailPopupProps) {
  if (!orderName) return null;

  const orderRows = rows.filter((r) => r.Name === orderName);
  if (orderRows.length === 0) return null;

  const first = orderRows[0];
  const paidAt = first["Paid at"] || first["Created at"] || "";
  const paidDate = paidAt.split(" ")[0];
  const subtotal = parseSubtotal(first.Subtotal);
  const discountCode = first["Discount Code"]?.trim() || null;
  const notes = first.Notes || "";
  const trafficCode = extractTrafficCode(notes, trafficMap);
  const trafficLabel = trafficCode ? (trafficMap[trafficCode] || trafficCode) : null;

  const lineitems = orderRows.map((r) => ({
    name: r["Lineitem name"] || "-",
    qty: parseInt(r["Lineitem quantity"] || "1") || 1,
    price: parseSubtotal(r["Lineitem price"]),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Order</p>
            <h2 className="text-lg font-bold text-white">{orderName}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Meta info */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Paid At</p>
            <p className="text-xs font-semibold text-gray-700">
              {paidDate ? formatDisplayDate(paidDate) : "-"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Subtotal</p>
            <p className="text-xs font-bold text-green-600">{formatRupiah(subtotal)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Discount Code</p>
            {discountCode ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono text-[11px] font-semibold">
                {discountCode}
              </span>
            ) : (
              <p className="text-xs text-gray-400">-</p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium mb-0.5">Traffic Source</p>
            {trafficCode ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono text-[11px] font-bold border border-blue-200">
                  {trafficCode}
                </span>
                {trafficLabel && (
                  <span className="text-[11px] text-gray-600 truncate">{trafficLabel}</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Tidak Diketahui</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="px-5 py-3 border-b">
            <p className="text-[10px] text-gray-400 font-medium mb-1">Notes</p>
            <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
              {notes}
            </p>
          </div>
        )}

        {/* Line items */}
        <div className="px-5 py-4">
          <p className="text-[10px] text-gray-400 font-medium mb-2 uppercase tracking-wider">
            Line Items ({lineitems.length})
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {lineitems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {item.qty}
                  </span>
                  <p className="text-xs text-gray-700 truncate font-medium">{item.name}</p>
                </div>
                <p className="text-xs font-semibold text-gray-700 flex-shrink-0">
                  {formatRupiah(item.price)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 bg-gray-50 border-t">
          <p className="text-[10px] text-gray-400 text-center">Klik di luar popup untuk menutup</p>
        </div>
      </div>
    </div>
  );
}

const CHART_TABS = [
  { id: "store", label: "Revenue per Store" },
  { id: "traffic", label: "Traffic Source" },
  { id: "discount", label: "Discount Code" },
  { id: "product", label: "Product Sales" },
  { id: "employee", label: "Employee" },
];

// ─── Custom dark tooltip ──────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.name || p.dataKey}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: p.fill || p.color || p.stroke || "#60a5fa" }}>
            {formatter ? formatter(p.value) : p.value?.toLocaleString?.() ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieLegend = ({ data }: { data: { name: string; value: number; color: string }[] }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
    {data.map((d, i) => (
      <div key={i} className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
        <span className="text-[10px] text-gray-500">{d.name}</span>
      </div>
    ))}
  </div>
);

// ─── View Toggle ──────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: "all" | "daily"; onChange: (v: "all" | "daily") => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {(["all", "daily"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            view === v
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {v === "all" ? "All" : "Daily"}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div className="flex items-center justify-between pt-3 border-t mt-2">
      <p className="text-xs text-gray-400">
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} dari {total}
      </p>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">‹</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={i} className="px-2 py-1 text-xs text-gray-400">…</span>
          ) : (
            <button key={i} onClick={() => onChange(p as number)}
              className={`px-2.5 py-1 text-xs border rounded ${page === p ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">›</button>
      </div>
    </div>
  );
}

// ─── Export Button ────────────────────────────────────────────────────────────
function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export XLSX
    </button>
  );
}

// ─── Master Traffic Modal ─────────────────────────────────────────────────────
function MasterTrafficModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<{ code_traffic: string; notes: string }[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [search, setSearch] = useState("");

  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<{ code_traffic: string; notes: string } | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ code_traffic: string; notes: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch("/api/master-traffic");
      const map: Record<string, string> = await res.json();
      const list = Object.entries(map)
        .map(([code_traffic, notes]) => ({ code_traffic, notes }))
        .sort((a, b) => a.code_traffic.localeCompare(b.code_traffic));
      setEntries(list);
    } catch {}
    setLoadingEntries(false);
  };

  useEffect(() => {
    if (open) { fetchEntries(); setSearch(""); setFormMode(null); setDeleteTarget(null); }
  }, [open]);

  const openAdd = () => {
    setFormMode("add");
    setEditTarget(null);
    setFormCode("");
    setFormNotes("");
    setFormError("");
    setTimeout(() => codeRef.current?.focus(), 60);
  };

  const openEdit = (entry: { code_traffic: string; notes: string }) => {
    setFormMode("edit");
    setEditTarget(entry);
    setFormCode(entry.code_traffic);
    setFormNotes(entry.notes);
    setFormError("");
    setTimeout(() => codeRef.current?.focus(), 60);
  };

  const closeForm = () => { setFormMode(null); setEditTarget(null); setFormError(""); };

  const handleSave = async () => {
    setFormError("");
    if (!formCode.trim() || !formNotes.trim()) { setFormError("Kode dan keterangan wajib diisi."); return; }
    setSaving(true);
    try {
      const body = formMode === "add"
        ? { code_traffic: formCode, notes: formNotes }
        : { original_code: editTarget!.code_traffic, code_traffic: formCode, notes: formNotes };
      const res = await fetch("/api/master-traffic", {
        method: formMode === "add" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Gagal menyimpan"); return; }
      closeForm();
      await fetchEntries();
      onSaved();
    } catch { setFormError("Terjadi kesalahan."); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/master-traffic", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code_traffic: deleteTarget.code_traffic }),
      });
      setDeleteTarget(null);
      await fetchEntries();
      onSaved();
    } catch {}
    setDeleting(false);
  };

  const filtered = entries.filter(
    (e) => e.code_traffic.toLowerCase().includes(search.toLowerCase()) || e.notes.toLowerCase().includes(search.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Master Traffic</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {formMode && (
          <div className="px-5 py-3 bg-blue-50 border-b flex-shrink-0">
            <p className="text-xs font-semibold text-blue-700 mb-2">
              {formMode === "add" ? "Tambah Kode Baru" : `Edit: ${editTarget?.code_traffic}`}
            </p>
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1">Kode</label>
                <input
                  ref={codeRef}
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder="WG"
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-gray-600 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Whatsapp Group"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors whitespace-nowrap">
                {saving ? "..." : formMode === "add" ? "Tambah" : "Simpan"}
              </button>
              <button onClick={closeForm} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors">
                Batal
              </button>
            </div>
            {formError && <p className="text-[10px] text-red-600 mt-1.5">{formError}</p>}
          </div>
        )}

        {deleteTarget && (
          <div className="px-5 py-3 bg-red-50 border-b flex-shrink-0 flex items-center justify-between gap-4">
            <p className="text-xs text-red-700">
              Hapus <strong>{deleteTarget.code_traffic}</strong> – {deleteTarget.notes}?
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">Batal</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-60 font-medium">
                {deleting ? "..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-3 flex items-center gap-2 border-b flex-shrink-0">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau keterangan..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-semibold text-gray-600 w-24">Kode</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Keterangan</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600 w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr><td colSpan={3} className="text-center py-10 text-gray-400">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-10 text-gray-400">
                  {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada kode traffic."}
                </td></tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.code_traffic} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-100">
                        {entry.code_traffic}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{entry.notes}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(entry)}
                          className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => { setDeleteTarget(entry); setFormMode(null); }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loadingEntries && entries.length > 0 && (
          <div className="px-5 py-2.5 border-t bg-gray-50 flex-shrink-0">
            <p className="text-[10px] text-gray-400">{filtered.length} dari {entries.length} kode traffic</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsOrderPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [trafficMap, setTrafficMap] = useState<Record<string, string>>({});
  const [trafficMapLoading, setTrafficMapLoading] = useState(true);
  const [masterTrafficOpen, setMasterTrafficOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "refresh" | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [activeTab, setActiveTab] = useState("store");
  const [chartView, setChartView] = useState<"all" | "daily">("all");

  // ─── Order detail popup ───────────────────────────────────────────────────
  const [selectedOrderName, setSelectedOrderName] = useState<string | null>(null);

  const [pageStore, setPageStore] = useState(1);
  const [pageTraffic, setPageTraffic] = useState(1);
  const [pageDiscount, setPageDiscount] = useState(1);
  const [pageProduct, setPageProduct] = useState(1);
  const [pageEmployee, setPageEmployee] = useState(1);
  const PAGE_SIZE = 10;
  const [hideUnknownTraffic, setHideUnknownTraffic] = useState(false);

  const [trafficFilter, setTrafficFilter] = useState<string[]>([]);
  const [showTrafficDropdown, setShowTrafficDropdown] = useState(false);
  const trafficDropdownRef = useRef<HTMLDivElement>(null);

  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const getTodayStr = () => toLocalDateStr(new Date());
  const getFirstOfMonthStr = () => {
    const now = new Date();
    return toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const [dateFrom, setDateFrom] = useState(getFirstOfMonthStr);
  const [dateTo, setDateTo] = useState(getTodayStr);
  const [storeFilter, setStoreFilter] = useState("all");
  const [stores, setStores] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (trafficDropdownRef.current && !trafficDropdownRef.current.contains(e.target as Node)) {
        setShowTrafficDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.analytics_order) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
    fetchTrafficMap();
  }, []);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchTrafficMap = async () => {
    try {
      setTrafficMapLoading(true);
      const res = await fetch("/api/master-traffic");
      const data: Record<string, string> = await res.json();
      setTrafficMap(data);
    } catch {
      console.error("Failed to fetch traffic map");
    } finally {
      setTrafficMapLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shopify-analytics");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      const uniq = [...new Set((Array.isArray(data) ? data : []).map((r: Row) => cleanLocationName(r.Location)).filter(Boolean))] as string[];
      setStores(uniq.sort());
    } catch {
      showMessage("Failed to fetch analytics data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importMode) return;
    setShowImportModal(false);
    setImporting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              const data = results.data as any[][];
              const res = await fetch("/api/shopify-analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, mode: importMode }),
              });
              const result = await res.json();
              if (res.ok && result.success) {
                showMessage(`Import berhasil!\n${result.message}`, "success");
                await fetchData();
              } else {
                showMessage(result.error || "Import failed", "error");
              }
              resolve();
            } catch (err) { reject(err); }
          },
          error: reject,
        });
      });
    } catch {
      showMessage("Gagal import data", "error");
    } finally {
      setImporting(false);
      setImportMode(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerImport = (mode: "append" | "refresh") => {
    setImportMode(mode);
    setShowImportModal(true);
  };

  const isTrafficActive = trafficFilter.length > 0;

  const trafficFilterLabel = (() => {
    if (!isTrafficActive) return "Semua Traffic";
    if (trafficFilter.length === 1) {
      const code = trafficFilter[0];
      if (code === "unknown") return "Tidak Diketahui";
      return `${code} – ${trafficMap[code] || code}`;
    }
    return `${trafficFilter.length} traffic dipilih`;
  })();

  const toggleTrafficCode = (code: string) => {
    setTrafficFilter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    resetPages();
  };

  const clearTrafficFilter = () => {
    setTrafficFilter([]);
    resetPages();
  };

  const filteredRows = useCallback(() => {
    return rows.filter((r) => {
      const rawDate = r["Created at"] || "";
      const dateStr = rawDate.split(" ")[0];
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;

      if (storeFilter !== "all") {
        const loc = cleanLocationName(r.Location);
        if (loc !== storeFilter) return false;
      }

      if (isTrafficActive) {
        const code = extractTrafficCode(r.Notes, trafficMap);
        const matchesAny = trafficFilter.some((selected) => {
          if (selected === "unknown") return code === null;
          return code === selected;
        });
        if (!matchesAny) return false;
      }

      return true;
    });
  }, [rows, dateFrom, dateTo, storeFilter, trafficFilter, trafficMap, isTrafficActive]);

  const fr = filteredRows();

  const dataDateRange = (() => {
    const dates = rows
      .map((r) => (r["Created at"] || "").split(" ")[0])
      .filter((d) => d && d.length === 10)
      .sort();
    if (dates.length === 0) return null;
    return { min: dates[0], max: dates[dates.length - 1] };
  })();

  // ─── Aggregated data ──────────────────────────────────────────────────────

  const revenueByStore = (() => {
    const orderSeen = new Set<string>();
    const map: Record<string, number> = {};
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const store = cleanLocationName(r.Location);
      map[store] = (map[store] || 0) + parseSubtotal(r.Subtotal);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })();

  const orderCountByStore = (() => {
    const map: Record<string, Set<string>> = {};
    fr.forEach((r) => {
      const store = cleanLocationName(r.Location);
      if (!map[store]) map[store] = new Set();
      if (r.Name) map[store].add(r.Name);
    });
    return Object.entries(map).map(([name, s]) => ({ name, count: s.size }));
  })();

  const dailyRevenueByStore = (() => {
    const orderSeen = new Set<string>();
    const map: Record<string, Record<string, number>> = {};
    const allStoreSet = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const store = cleanLocationName(r.Location);
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date) return;
      allStoreSet.add(store);
      if (!map[date]) map[date] = {};
      map[date][store] = (map[date][store] || 0) + parseSubtotal(r.Subtotal);
    });
    const storeNames = [...allStoreSet].sort();
    const chartData = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, storeRevMap]) => ({
        date: formatShortDate(date),
        fullDate: date,
        ...storeNames.reduce((acc, s) => ({ ...acc, [s]: storeRevMap[s] || 0 }), {}),
      }));
    return { chartData, storeNames };
  })();

  const dailyOrdersByStore = (() => {
    const map: Record<string, Record<string, Set<string>>> = {};
    const allStoreSet = new Set<string>();
    fr.forEach((r) => {
      const store = cleanLocationName(r.Location);
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date || !r.Name) return;
      allStoreSet.add(store);
      if (!map[date]) map[date] = {};
      if (!map[date][store]) map[date][store] = new Set();
      map[date][store].add(r.Name);
    });
    const storeNames = [...allStoreSet].sort();
    const chartData = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, storeMap]) => ({
        date: formatShortDate(date),
        fullDate: date,
        ...storeNames.reduce((acc, s) => ({ ...acc, [s]: storeMap[s]?.size || 0 }), {}),
      }));
    return { chartData, storeNames };
  })();

  const trafficData = (() => {
    const map: Record<string, { count: number; subtotal: number }> = {};
    let nullCount = 0;
    let nullSubtotal = 0;
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const code = extractTrafficCode(r.Notes, trafficMap);
      const sub = parseSubtotal(r.Subtotal);
      if (code) {
        const label = trafficMap[code] || code;
        if (!map[label]) map[label] = { count: 0, subtotal: 0 };
        map[label].count++;
        map[label].subtotal += sub;
      } else {
        nullCount++;
        nullSubtotal += sub;
      }
    });
    const result = Object.entries(map)
      .map(([name, d]) => ({ name, value: d.count, subtotal: d.subtotal }))
      .sort((a, b) => b.value - a.value);
    if (nullCount > 0) result.push({ name: "Tidak Diketahui", value: nullCount, subtotal: nullSubtotal });
    return result;
  })();

  const trafficDataForPie = trafficData.filter(d => d.name !== "Tidak Diketahui");

  const dailyTrafficData = (() => {
    const map: Record<string, Record<string, number>> = {};
    const orderSeen = new Set<string>();
    const topTraffics = trafficData.filter(d => d.name !== "Tidak Diketahui").slice(0, 6).map(d => d.name);
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date) return;
      const code = extractTrafficCode(r.Notes, trafficMap);
      const label = code ? (trafficMap[code] || code) : "Tidak Diketahui";
      if (!map[date]) map[date] = {};
      map[date][label] = (map[date][label] || 0) + 1;
    });
    return {
      chartData: Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, tMap]) => ({
        date: formatShortDate(date),
        fullDate: date,
        ...topTraffics.reduce((acc, t) => ({ ...acc, [t]: tMap[t] || 0 }), {}),
      })),
      topTraffics,
    };
  })();

  const discountData = (() => {
    const map: Record<string, { count: number; total: number; subtotal: number }> = {};
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const code = r["Discount Code"]?.trim();
      if (!code) return;
      if (!map[code]) map[code] = { count: 0, total: 0, subtotal: 0 };
      map[code].count++;
      map[code].total += parseSubtotal(r["Discount Amount"]);
      map[code].subtotal += parseSubtotal(r.Subtotal);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, total: d.total, subtotal: d.subtotal }))
      .sort((a, b) => b.count - a.count).slice(0, 20);
  })();

  const dailyDiscountData = (() => {
    const totalMap: Record<string, number> = {};
    const discountMap: Record<string, number> = {};
    const seen2 = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (seen2.has(key)) return;
      seen2.add(key);
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date) return;
      totalMap[date] = (totalMap[date] || 0) + 1;
      if (r["Discount Code"]?.trim()) discountMap[date] = (discountMap[date] || 0) + 1;
    });
    return Object.keys(totalMap).sort().map((date) => ({
      date: formatShortDate(date),
      fullDate: date,
      "Total Order": totalMap[date] || 0,
      "Pakai Discount": discountMap[date] || 0,
    }));
  })();

  const productData = (() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    fr.forEach((r) => {
      const name = r["Lineitem name"]?.trim();
      if (!name) return;
      const qty = parseInt(r["Lineitem quantity"] || "1") || 1;
      const price = parseSubtotal(r["Lineitem price"]);
      if (!map[name]) map[name] = { qty: 0, revenue: 0 };
      map[name].qty += qty;
      map[name].revenue += price * qty;
    });
    return Object.entries(map).map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
      .sort((a, b) => b.qty - a.qty).slice(0, 20);
  })();

  const dailyProductData = (() => {
    const top5 = productData.slice(0, 5).map(p => p.name);
    const map: Record<string, Record<string, number>> = {};
    fr.forEach((r) => {
      const name = r["Lineitem name"]?.trim();
      if (!name || !top5.includes(name)) return;
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date) return;
      const qty = parseInt(r["Lineitem quantity"] || "1") || 1;
      if (!map[date]) map[date] = {};
      map[date][name] = (map[date][name] || 0) + qty;
    });
    return {
      chartData: Object.keys(map).sort().map((date) => ({
        date: formatShortDate(date),
        fullDate: date,
        ...top5.reduce((acc, p) => ({ ...acc, [p]: map[date]?.[p] || 0 }), {}),
      })),
      top5,
    };
  })();

  const employeeData = (() => {
    const map: Record<string, { orders: Set<string>; subtotal: number }> = {};
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      const emp = r.Employee?.trim();
      if (!emp) return;
      if (!map[emp]) map[emp] = { orders: new Set(), subtotal: 0 };
      map[emp].orders.add(key);
      if (!orderSeen.has(key)) {
        orderSeen.add(key);
        map[emp].subtotal += parseSubtotal(r.Subtotal);
      }
    });
    return Object.entries(map).map(([name, d]) => ({ name, orders: d.orders.size, subtotal: d.subtotal }))
      .sort((a, b) => b.subtotal - a.subtotal);
  })();

  const dailyEmployeeData = (() => {
    const top5 = employeeData.slice(0, 5).map(e => e.name);
    const map: Record<string, Record<string, number>> = {};
    const seen = new Set<string>();
    fr.forEach((r) => {
      const emp = r.Employee?.trim();
      if (!emp || !top5.includes(emp)) return;
      const date = (r["Created at"] || "").split(" ")[0];
      if (!date) return;
      if (!map[date]) map[date] = {};
      const key = `${date}__${r.Name || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        map[date][emp] = (map[date][emp] || 0) + parseSubtotal(r.Subtotal);
      }
    });
    return {
      chartData: Object.keys(map).sort().map((date) => ({
        date: formatShortDate(date),
        fullDate: date,
        ...top5.reduce((acc, e) => ({ ...acc, [e]: map[date]?.[e] || 0 }), {}),
      })),
      top5,
    };
  })();

  // ─── Summary Stats ────────────────────────────────────────────────────────
  const totalRevenue = (() => {
    const seen = new Set<string>();
    return fr.reduce((s, r) => {
      if (!seen.has(r.Name || "")) { seen.add(r.Name || ""); return s + parseSubtotal(r.Subtotal); }
      return s;
    }, 0);
  })();

  const totalOrders = new Set(fr.map(r => r.Name).filter(Boolean)).size;
  const totalDiscountUsed = new Set(fr.filter(r => r["Discount Code"]?.trim()).map(r => r.Name).filter(Boolean)).size;

  const handleExport = () => {
    if (fr.length === 0) { showMessage("Tidak ada data untuk diexport", "error"); return; }
    switch (activeTab) {
      case "store":    exportStoreTab(fr);    break;
      case "traffic":  exportTrafficTab(fr);  break;
      case "discount": exportDiscountTab(fr); break;
      case "product":  exportProductTab(fr);  break;
      case "employee": exportEmployeeTab(fr); break;
    }
  };

  const handleResetFilter = () => {
    setDateFrom(getFirstOfMonthStr());
    setDateTo(getTodayStr());
    setStoreFilter("all");
    setTrafficFilter([]);
    setPageStore(1);
    setPageTraffic(1);
    setPageDiscount(1);
    setPageProduct(1);
    setPageEmployee(1);
  };

  const resetPages = () => {
    setPageStore(1); setPageTraffic(1); setPageDiscount(1); setPageProduct(1); setPageEmployee(1);
  };

  // Helper: get first order name for a given store/discount/traffic/employee from filtered rows
  // For store tab: get all unique order names under a store
  const getOrderNamesByStore = (storeName: string) => {
    const seen = new Set<string>();
    fr.forEach((r) => {
      if (cleanLocationName(r.Location) === storeName && r.Name) seen.add(r.Name);
    });
    return seen;
  };

  if (!user) return null;

  // ─── Clickable row helper ─────────────────────────────────────────────────
  const clickableRowClass = "border-b hover:bg-blue-50 cursor-pointer transition-colors group";

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Analytics Order</h1>
            <div className="flex gap-1.5 items-center">
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" id="shopify-import" />
              {importing ? (
                <span className="px-3 py-1.5 bg-gray-400 text-white rounded text-xs opacity-70 cursor-not-allowed">Importing...</span>
              ) : (
                <>
                  <button onClick={() => triggerImport("append")} className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 transition-colors font-medium">
                    + Tambah Data
                  </button>
                  <button onClick={() => triggerImport("refresh")} className="px-3 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors font-medium">
                    ↺ Refresh Semua
                  </button>
                  <button onClick={() => setMasterTrafficOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Master Traffic
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: formatRupiah(totalRevenue), color: "text-green-600" },
              { label: "Total Orders", value: totalOrders.toLocaleString(), color: "text-blue-600" },
              { label: "Pakai Discount", value: totalDiscountUsed.toLocaleString(), color: "text-purple-600" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPages(); }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPages(); }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                <select value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); resetPages(); }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white">
                  <option value="all">All Stores</option>
                  {stores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Traffic Source</label>
                <div className="relative" ref={trafficDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowTrafficDropdown(v => !v)}
                    disabled={trafficMapLoading}
                    className={`w-full px-2 py-1.5 border rounded text-xs text-left flex items-center justify-between gap-1 focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                      isTrafficActive
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-gray-300 bg-white text-gray-700"
                    } disabled:opacity-50`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {trafficMapLoading ? (
                        "Memuat..."
                      ) : isTrafficActive ? (
                        <>
                          <span className="inline-flex items-center justify-center w-4 h-4 bg-primary text-white rounded-full text-[9px] font-bold flex-shrink-0">
                            {trafficFilter.length}
                          </span>
                          {trafficFilterLabel}
                        </>
                      ) : (
                        "Semua Traffic"
                      )}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isTrafficActive && (
                        <span
                          onClick={(e) => { e.stopPropagation(); clearTrafficFilter(); }}
                          className="text-primary/60 hover:text-red-500 cursor-pointer text-sm leading-none"
                          title="Hapus semua filter traffic"
                        >×</span>
                      )}
                      <svg className={`w-3 h-3 transition-transform ${showTrafficDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {showTrafficDropdown && (
                    <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                      <TrafficMultiSelect
                        trafficFilter={trafficFilter}
                        trafficMap={trafficMap}
                        onToggle={toggleTrafficCode}
                        onClearAll={clearTrafficFilter}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <button onClick={handleResetFilter}
                  className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 w-full">
                  Reset Filter
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {dataDateRange && (
                <>
                  <span className="text-[10px] text-gray-400">Data tersedia:</span>
                  <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {formatDisplayDate(dataDateRange.min)} - {formatDisplayDate(dataDateRange.max)}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">
                    (filter aktif: {formatDisplayDate(dateFrom) || "-"} s/d {formatDisplayDate(dateTo) || "-"})
                  </span>
                </>
              )}

              {isTrafficActive && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1 w-full">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                    Traffic:
                  </span>
                  {trafficFilter.map((code) => (
                    <span key={code}
                      className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                      {code === "unknown" ? "Tidak Diketahui" : `${code} – ${trafficMap[code] || code}`}
                      <button
                        onClick={() => toggleTrafficCode(code)}
                        className="ml-0.5 hover:text-red-500 leading-none"
                      >×</button>
                    </span>
                  ))}
                  {trafficFilter.length > 1 && (
                    <button onClick={clearTrafficFilter}
                      className="text-[10px] text-red-500 hover:text-red-700 underline">
                      Hapus semua
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex items-center justify-between border-b pr-4">
              <div className="flex overflow-x-auto">
                {CHART_TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                      activeTab === tab.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {!loading && fr.length > 0 && (
                  <>
                    <ViewToggle view={chartView} onChange={setChartView} />
                    <ExportButton onClick={handleExport} />
                  </>
                )}
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="text-center py-16 text-gray-400">Loading data...</div>
              ) : fr.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg font-semibold">Belum ada data</p>
                  <p className="text-sm mt-1">
                    {isTrafficActive || storeFilter !== "all"
                      ? "Tidak ada data untuk filter yang dipilih"
                      : "Import CSV Shopify untuk mulai analitik"}
                  </p>
                  {(isTrafficActive || storeFilter !== "all") && (
                    <button onClick={handleResetFilter} className="mt-3 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">
                      Reset Filter
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* ── Tab 1: Revenue per Store ────────────────────────── */}
                  {activeTab === "store" && (
                    <div className="space-y-8">
                      {chartView === "all" ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue per Store (IDR)</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={revenueByStore} margin={{ top: 16, right: 8, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                                <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                                <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                  {revenueByStore.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Store</h3>
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={orderCountByStore.sort((a,b) => b.count - a.count)} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                  {orderCountByStore.map((_, i) => <Cell key={i} fill={COLORS[(i + 5) % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Revenue Harian per Store</h3>
                            <p className="text-xs text-gray-400 mb-4">Revenue per hari berdasarkan tanggal order</p>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={dailyRevenueByStore.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyRevenueByStore.chartData.length / 15)} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                                <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                {dailyRevenueByStore.storeNames.map((s, i) => (
                                  <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Jumlah Order Harian per Store</h3>
                            <p className="text-xs text-gray-400 mb-4">Jumlah order per hari</p>
                            <ResponsiveContainer width="100%" height={260}>
                              <LineChart data={dailyOrdersByStore.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyOrdersByStore.chartData.length / 15)} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                {dailyOrdersByStore.storeNames.map((s, i) => (
                                  <Line key={s} type="monotone" dataKey={s} stroke={COLORS[(i + 5) % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail per Store</h3>
                        <p className="text-[10px] text-gray-400 mb-2">Klik baris untuk melihat salah satu order dari store tersebut</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Orders</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revenueByStore.slice((pageStore - 1) * PAGE_SIZE, pageStore * PAGE_SIZE).map((s, i) => {
                                const orders = orderCountByStore.find(o => o.name === s.name)?.count || 0;
                                // Get first order name from this store for popup
                                const firstOrderName = fr.find(r => cleanLocationName(r.Location) === s.name && r.Name)?.Name || null;
                                return (
                                  <tr key={i} className={clickableRowClass}
                                    onClick={() => firstOrderName && setSelectedOrderName(firstOrderName)}
                                    title={firstOrderName ? `Lihat detail order ${firstOrderName}` : undefined}
                                  >
                                    <td className="px-3 py-2 flex items-center gap-1.5">
                                      {s.name}
                                      <svg className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </td>
                                    <td className="px-3 py-2 text-right">{orders}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(s.value)}</td>
                                    <td className="px-3 py-2 text-right">{orders ? formatRupiah(Math.round(s.value / orders)) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <Pagination page={pageStore} total={revenueByStore.length} pageSize={PAGE_SIZE} onChange={setPageStore} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 2: Traffic Source ───────────────────────────── */}
                  {activeTab === "traffic" && (
                    <div className="space-y-8">
                      {chartView === "all" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <div onClick={() => setHideUnknownTraffic(v => !v)}
                                className={`w-9 h-5 rounded-full transition-colors relative ${hideUnknownTraffic ? "bg-primary" : "bg-gray-300"}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideUnknownTraffic ? "translate-x-4" : "translate-x-0.5"}`} />
                              </div>
                              <span className="text-xs text-gray-600">Sembunyikan <strong>"Tidak Diketahui"</strong> di bar chart</span>
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Traffic Source</h3>
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie data={trafficDataForPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                                    label={(props) => (props.percent ?? 0) > 0.04 ? `${((props.percent ?? 0) * 100).toFixed(0)}%` : ""} labelLine={false}>
                                    {trafficDataForPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                  </Pie>
                                  <Tooltip content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const item = payload[0];
                                    const total = trafficDataForPie.reduce((s, d) => s + d.value, 0);
                                    const pct = total ? ((Number(item.value) / total) * 100).toFixed(1) : "0";
                                    const sub = (item.payload as any)?.subtotal ?? 0;
                                    return (
                                      <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 200 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{item.name}</p>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Jumlah Order</span>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: item.payload?.fill || "#60a5fa" }}>{Number(item.value).toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Total Revenue</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>{formatRupiah(sub)}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Persentase</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{pct}%</span>
                                        </div>
                                      </div>
                                    );
                                  }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <PieLegend data={trafficDataForPie.map((d, i) => ({ name: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Traffic</h3>
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                  data={(hideUnknownTraffic ? trafficData.filter(d => d.name !== "Tidak Diketahui") : trafficData).slice(0, 12)}
                                  layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                  <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={130} />
                                  <Tooltip content={<DarkTooltip />} />
                                  <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]} maxBarSize={20}
                                    label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                    {(hideUnknownTraffic ? trafficData.filter(d => d.name !== "Tidak Diketahui") : trafficData).slice(0, 12).map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Traffic Source Harian (Top 6)</h3>
                          <p className="text-xs text-gray-400 mb-4">Jumlah order per sumber traffic per hari</p>
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={dailyTrafficData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyTrafficData.chartData.length / 15)} />
                              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                              <Tooltip content={<DarkTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                              {dailyTrafficData.topTraffics.map((t, i) => (
                                <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Traffic Source</h3>
                        <p className="text-[10px] text-gray-400 mb-2">Klik baris untuk melihat contoh order dari traffic ini</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Traffic Source</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Jumlah Order</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Order</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Persentase</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const total = trafficData.reduce((s, d) => s + d.value, 0);
                                return trafficData.slice((pageTraffic - 1) * PAGE_SIZE, pageTraffic * PAGE_SIZE).map((t, i) => {
                                  const globalIdx = (pageTraffic - 1) * PAGE_SIZE + i;
                                  // Find a sample order for this traffic label
                                  const sampleOrder = fr.find((r) => {
                                    const code = extractTrafficCode(r.Notes, trafficMap);
                                    if (t.name === "Tidak Diketahui") return code === null && r.Name;
                                    const label = code ? (trafficMap[code] || code) : null;
                                    return label === t.name && r.Name;
                                  });
                                  return (
                                    <tr key={i} className={clickableRowClass}
                                      onClick={() => sampleOrder?.Name && setSelectedOrderName(sampleOrder.Name)}
                                    >
                                      <td className="px-3 py-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[globalIdx % COLORS.length] }} />
                                        {t.name}
                                        <svg className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">{t.value}</td>
                                      <td className="px-3 py-2 text-right text-green-700 font-medium">{formatRupiah(t.subtotal)}</td>
                                      <td className="px-3 py-2 text-right text-gray-500">
                                        {t.value ? formatRupiah(Math.round(t.subtotal / t.value)) : "-"}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-500">
                                        {total ? `${((t.value / total) * 100).toFixed(1)}%` : "-"}
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                          <Pagination page={pageTraffic} total={trafficData.length} pageSize={PAGE_SIZE} onChange={setPageTraffic} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 3: Discount Code ─────────────────────────────── */}
                  {activeTab === "discount" && (
                    <div className="space-y-8">
                      {chartView === "all" ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Penggunaan Discount Code (Top 20)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={discountData} margin={{ top: 16, right: 8, left: 0, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Bar dataKey="count" name="Pakai" radius={[4, 4, 0, 0]} maxBarSize={40}
                                  label={{ position: "top", fontSize: 9, fill: "#6b7280" }}>
                                  {discountData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Subtotal per Discount Code</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={discountData} margin={{ top: 16, right: 8, left: 0, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                                <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                                <Bar dataKey="subtotal" name="Total Revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                  {discountData.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Penggunaan Discount Harian</h3>
                          <p className="text-xs text-gray-400 mb-4">Perbandingan total order vs order yang memakai discount per hari</p>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyDiscountData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyDiscountData.length / 15)} />
                              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                              <Tooltip content={<DarkTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                              <Line type="monotone" dataKey="Total Order" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="Pakai Discount" stroke={COLORS[2]} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Discount Code</h3>
                        <p className="text-[10px] text-gray-400 mb-2">Klik baris untuk melihat contoh order dengan discount ini</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Discount Code</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Dipakai (Order)</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Potongan</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg Revenue/Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {discountData.slice((pageDiscount - 1) * PAGE_SIZE, pageDiscount * PAGE_SIZE).map((d, i) => {
                                const sampleOrder = fr.find(r => r["Discount Code"]?.trim() === d.name && r.Name);
                                return (
                                  <tr key={i} className={clickableRowClass}
                                    onClick={() => sampleOrder?.Name && setSelectedOrderName(sampleOrder.Name)}
                                  >
                                    <td className="px-3 py-2 flex items-center gap-1.5">
                                      <span className="font-mono">{d.name}</span>
                                      <svg className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </td>
                                    <td className="px-3 py-2 text-right">{d.count}</td>
                                    <td className="px-3 py-2 text-right text-green-700 font-medium">{formatRupiah(d.subtotal)}</td>
                                    <td className="px-3 py-2 text-right text-red-600">{formatRupiah(d.total)}</td>
                                    <td className="px-3 py-2 text-right text-gray-500">
                                      {d.count ? formatRupiah(Math.round(d.subtotal / d.count)) : "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <Pagination page={pageDiscount} total={discountData.length} pageSize={PAGE_SIZE} onChange={setPageDiscount} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 4: Product Sales ─────────────────────────────── */}
                  {activeTab === "product" && (
                    <div className="space-y-8">
                      {chartView === "all" ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 20 Produk Terjual (by Quantity)</h3>
                            <ResponsiveContainer width="100%" height={320}>
                              <BarChart data={productData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#6b7280" }} width={200}
                                  tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + "…" : v} />
                                <Tooltip content={<DarkTooltip />} />
                                <Bar dataKey="qty" name="Qty Terjual" radius={[0, 4, 4, 0]} maxBarSize={18}
                                  label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                  {productData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 20 Produk berdasarkan Revenue</h3>
                            <ResponsiveContainer width="100%" height={320}>
                              <BarChart data={[...productData].sort((a, b) => b.revenue - a.revenue).slice(0, 20)}
                                layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : `${(v/1e3).toFixed(0)}k`} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "#6b7280" }} width={200}
                                  tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + "…" : v} />
                                <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                  {productData.map((_, i) => <Cell key={i} fill={COLORS[(i + 7) % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Penjualan Produk Harian (Top 5)</h3>
                          <p className="text-xs text-gray-400 mb-4">Qty terjual per hari untuk 5 produk terlaris</p>
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={dailyProductData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyProductData.chartData.length / 15)} />
                              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                              <Tooltip content={<DarkTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(v: string) => v.length > 30 ? v.slice(0, 30) + "…" : v} />
                              {dailyProductData.top5.map((p, i) => (
                                <Line key={p} type="monotone" dataKey={p} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Produk Terjual</h3>
                        <p className="text-[10px] text-gray-400 mb-2">Klik baris untuk melihat contoh order yang mengandung produk ini</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Produk</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty Terjual</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productData.slice((pageProduct - 1) * PAGE_SIZE, pageProduct * PAGE_SIZE).map((p, i) => {
                                const sampleOrder = fr.find(r => r["Lineitem name"]?.trim() === p.name && r.Name);
                                return (
                                  <tr key={i} className={clickableRowClass}
                                    onClick={() => sampleOrder?.Name && setSelectedOrderName(sampleOrder.Name)}
                                  >
                                    <td className="px-3 py-2 flex items-center gap-1.5">
                                      {p.name}
                                      <svg className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </td>
                                    <td className="px-3 py-2 text-right">{p.qty}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(p.revenue)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <Pagination page={pageProduct} total={productData.length} pageSize={PAGE_SIZE} onChange={setPageProduct} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 5: Employee ──────────────────────────────────── */}
                  {activeTab === "employee" && (
                    <div className="space-y-8">
                      {chartView === "all" ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue yang Ditangani per Karyawan</h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={employeeData} margin={{ top: 16, right: 8, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                                <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                                <Bar dataKey="subtotal" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                  {employeeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Karyawan</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={employeeData} margin={{ top: 16, right: 8, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Bar dataKey="orders" name="Orders" radius={[4, 4, 0, 0]} maxBarSize={40}
                                  label={{ position: "top", fontSize: 9, fill: "#6b7280" }}>
                                  {employeeData.map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      ) : (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Revenue Karyawan Harian (Top 5)</h3>
                          <p className="text-xs text-gray-400 mb-4">Revenue yang ditangani per karyawan per hari</p>
                          <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={dailyEmployeeData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={Math.floor(dailyEmployeeData.chartData.length / 15)} />
                              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                              <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                              {dailyEmployeeData.top5.map((e, i) => (
                                <Line key={e} type="monotone" dataKey={e} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Karyawan</h3>
                        <p className="text-[10px] text-gray-400 mb-2">Klik baris untuk melihat contoh order dari karyawan ini</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Karyawan</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Jumlah Order</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employeeData.slice((pageEmployee - 1) * PAGE_SIZE, pageEmployee * PAGE_SIZE).map((e, i) => {
                                const sampleOrder = fr.find(r => r.Employee?.trim() === e.name && r.Name);
                                return (
                                  <tr key={i} className={clickableRowClass}
                                    onClick={() => sampleOrder?.Name && setSelectedOrderName(sampleOrder.Name)}
                                  >
                                    <td className="px-3 py-2 flex items-center gap-1.5">
                                      {e.name}
                                      <svg className="w-3 h-3 text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </td>
                                    <td className="px-3 py-2 text-right">{e.orders}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(e.subtotal)}</td>
                                    <td className="px-3 py-2 text-right">{e.orders ? formatRupiah(Math.round(e.subtotal / e.orders)) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <Pagination page={pageEmployee} total={employeeData.length} pageSize={PAGE_SIZE} onChange={setPageEmployee} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <MasterTrafficModal
        open={masterTrafficOpen}
        onClose={() => setMasterTrafficOpen(false)}
        onSaved={() => fetchTrafficMap()}
      />

      {/* Import Mode Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-gray-800 mb-1">
              {importMode === "append" ? "Tambah Data Baru" : "Refresh Semua Data"}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              {importMode === "append"
                ? "Data baru akan ditambahkan ke data yang sudah ada. Data lama tidak akan terhapus. Duplikat (berdasarkan Order Name) akan diabaikan."
                : "Semua data yang ada akan dihapus dan diganti dengan data dari file ini. Gunakan ini jika ingin reset total."}
            </p>
            {importMode === "refresh" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 flex gap-2">
                <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-red-600"><strong>Perhatian:</strong> Seluruh data historis akan terhapus permanen dan diganti data dari file baru.</p>
              </div>
            )}
            {importMode === "append" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 flex gap-2">
                <span className="text-blue-500 text-sm mt-0.5">ℹ️</span>
                <p className="text-xs text-blue-600">Data yang sudah ada akan tetap tersimpan. Hanya order baru yang akan ditambahkan.</p>
              </div>
            )}
            <label htmlFor="shopify-import"
              className="block w-full text-center cursor-pointer px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors mb-3">
              Pilih File CSV
            </label>
            <button onClick={() => { setShowImportModal(false); setImportMode(null); }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Popup */}
      <OrderDetailPopup
        orderName={selectedOrderName}
        rows={rows}
        trafficMap={trafficMap}
        onClose={() => setSelectedOrderName(null)}
      />

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}

// ─── Traffic Multi-Select Dropdown Component ──────────────────────────────────
function TrafficMultiSelect({
  trafficFilter,
  trafficMap,
  onToggle,
  onClearAll,
}: {
  trafficFilter: string[];
  trafficMap: Record<string, string>;
  onToggle: (code: string) => void;
  onClearAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allOptions = [
    ...Object.entries(trafficMap).map(([code, label]) => ({ code, label, displayLabel: `${code} – ${label}` })),
    { code: "unknown", label: "Tidak Diketahui", displayLabel: "Tidak Diketahui" },
  ];

  const filtered = search.trim()
    ? allOptions.filter(o =>
        o.displayLabel.toLowerCase().includes(search.toLowerCase()) ||
        o.code.toLowerCase().includes(search.toLowerCase())
      )
    : allOptions;

  const selectedCount = trafficFilter.length;

  return (
    <>
      <div className="p-2 border-b">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari traffic..."
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {selectedCount > 0 && (
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-primary font-medium">{selectedCount} dipilih</span>
            <button onClick={onClearAll} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
              Hapus semua
            </button>
          </div>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Tidak ditemukan</p>
        ) : (
          filtered.map((o) => {
            const isChecked = trafficFilter.includes(o.code);
            return (
              <button
                key={o.code}
                onClick={() => onToggle(o.code)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors flex items-center gap-2.5 ${
                  isChecked ? "bg-primary/5" : ""
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-primary border-primary"
                    : "border-gray-300 bg-white"
                }`}>
                  {isChecked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className={`${isChecked ? "text-primary font-medium" : "text-gray-700"}`}>
                  {o.displayLabel}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}