"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MasterInvoice {
  id?: string;
  header_image_url?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  signature_image_url?: string;
  default_use_signature?: string | boolean;
  default_use_ppn?: string | boolean;
  ppn_percentage?: string | number;
  invoice_prefix?: string;
  next_invoice_number?: string | number;
  updated_by?: string;
  updated_at?: string;
}

interface InvoiceItem {
  product_name: string;
  variant: string;
  qty: number;
  unit_price: number;
  total_price?: number;
}

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_address: string;
  subtotal: string | number;
  tax_percent: string | number;
  tax_amount: string | number;
  grand_total: string | number;
  amount_in_words: string;
  status: string;
  created_at: string;
}

interface MasterItem {
  Artikel: string;
  HPJ: string;
  Product_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRupiah(val: number | string): string {
  const n = typeof val === "string" ? parseInt(val.replace(/[^0-9]/g, "")) || 0 : val || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

function parseNum(val: string | number | undefined): number {
  if (!val) return 0;
  return typeof val === "number" ? val : parseInt(String(val).replace(/[^0-9]/g, "")) || 0;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
    deleted: "bg-red-100 text-red-600",
  };
  return map[s] || "bg-gray-100 text-gray-500";
}

// ── Empty Item ────────────────────────────────────────────────────────────────
const emptyItem = (): InvoiceItem => ({ product_name: "", variant: "", qty: 1, unit_price: 0 });

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InvoicePage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState<MasterInvoice>({});
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Popup
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    customer_name: "", customer_address: "", invoice_date: new Date().toISOString().split("T")[0],
    tax_percent: "0",
  });
  const [formItems, setFormItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [productDropdowns, setProductDropdowns] = useState<boolean[]>([false]);

  // Master form
  const [masterForm, setMasterForm] = useState<MasterInvoice>({});

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.invoice) { router.push("/dashboard"); return; }
    setUser(u);
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [invRes, masterRes, itemsRes] = await Promise.all([
        fetch("/api/invoice"),
        fetch("/api/invoice/master"),
        fetch("/api/master-item"),
      ]);
      const [invData, masterData, itemsData] = await Promise.all([
        invRes.json(), masterRes.json(), itemsRes.json(),
      ]);
      setInvoices(Array.isArray(invData) ? invData.filter((i: Invoice) => i.status !== "deleted") : []);
      setMaster(masterData || {});
      setMasterForm(masterData || {});
      setMasterItems(Array.isArray(itemsData) ? itemsData : []);
    } catch {
      showMessage("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || inv.invoice_number?.toLowerCase().includes(q) || inv.customer_name?.toLowerCase().includes(q);
    const matchS = statusFilter === "all" || inv.status === statusFilter;
    return matchQ && matchS;
  });

  // ── Open detail ────────────────────────────────────────────────────────────
  const openDetail = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowDetailModal(true);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/invoice?id=${inv.invoice_id}`);
      const data = await res.json();
      setSelectedItems(data.items || []);
    } catch {
      showMessage("Gagal memuat detail invoice", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Create Invoice ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formData.customer_name.trim()) { showMessage("Nama customer wajib diisi", "error"); return; }
    if (formItems.some(it => !it.product_name)) { showMessage("Nama produk wajib diisi", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tax_percent: parseFloat(formData.tax_percent) || 0,
          items: formItems,
          created_by: user?.user_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage(`Invoice ${data.invoice_number} berhasil dibuat!`, "success");
      setShowCreateModal(false);
      resetCreateForm();
      fetchAll();
    } catch (e: any) {
      showMessage(e.message || "Gagal membuat invoice", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setFormData({ customer_name: "", customer_address: "", invoice_date: new Date().toISOString().split("T")[0], tax_percent: "0" });
    setFormItems([emptyItem()]);
    setProductSearch([""]);
    setProductDropdowns([false]);
  };

  // ── Items management ───────────────────────────────────────────────────────
  const addItem = () => {
    setFormItems(p => [...p, emptyItem()]);
    setProductSearch(p => [...p, ""]);
    setProductDropdowns(p => [...p, false]);
  };

  const removeItem = (i: number) => {
    setFormItems(p => p.filter((_, idx) => idx !== i));
    setProductSearch(p => p.filter((_, idx) => idx !== i));
    setProductDropdowns(p => p.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: keyof InvoiceItem, value: any) => {
    setFormItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const selectProduct = (i: number, item: MasterItem) => {
    const hpj = parseNum(item.HPJ);
    setFormItems(p => p.map((it, idx) => idx === i
      ? { ...it, product_name: item.Product_name || item.Artikel, unit_price: hpj }
      : it
    ));
    setProductSearch(p => p.map((v, idx) => idx === i ? item.Product_name || item.Artikel : v));
    setProductDropdowns(p => p.map((_, idx) => idx === i ? false : _));
  };

  // ── Status update ──────────────────────────────────────────────────────────
  const updateStatus = async (invoice_id: string, status: string) => {
    try {
      const res = await fetch("/api/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id, status, updated_by: user?.user_name }),
      });
      if (!res.ok) throw new Error();
      showMessage("Status diperbarui", "success");
      if (selectedInvoice) setSelectedInvoice(p => p ? { ...p, status } : null);
      fetchAll();
    } catch {
      showMessage("Gagal memperbarui status", "error");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (invoice_id: string) => {
    if (!confirm("Yakin hapus invoice ini?")) return;
    try {
      await fetch(`/api/invoice?id=${invoice_id}`, { method: "DELETE" });
      showMessage("Invoice dihapus", "success");
      setShowDetailModal(false);
      fetchAll();
    } catch {
      showMessage("Gagal menghapus", "error");
    }
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const downloadPdf = async (invoice_id: string, invoice_number: string) => {
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/invoice/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showMessage("Gagal generate PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Save Master ────────────────────────────────────────────────────────────
  const saveMaster = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/invoice/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...masterForm, updated_by: user?.user_name }),
      });
      if (!res.ok) throw new Error();
      showMessage("Pengaturan disimpan", "success");
      setShowMasterModal(false);
      fetchAll();
    } catch {
      showMessage("Gagal menyimpan pengaturan", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Calculated totals for create form ─────────────────────────────────────
  const calcSubtotal = formItems.reduce((s, it) => s + (Number(it.qty) * Number(it.unit_price)), 0);
  const calcTax = Math.round(calcSubtotal * (parseFloat(formData.tax_percent || "0") / 100));
  const calcTotal = calcSubtotal + calcTax;
  const usePPN = master.default_use_ppn === true || master.default_use_ppn === "TRUE";

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">Invoice</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manajemen permintaan invoice</p>
          </div>
          <div className="flex gap-2">
            {user?.invoice_master && (
              <button
                onClick={() => setShowMasterModal(true)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Pengaturan
              </button>
            )}
            {user?.invoice_create && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Buat Invoice
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <input
                type="text"
                placeholder="Cari nomor invoice atau nama customer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Terkirim</option>
              <option value="paid">Lunas</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Invoice", value: invoices.length, color: "text-primary" },
            { label: "Draft", value: invoices.filter(i => i.status === "draft").length, color: "text-gray-600" },
            { label: "Terkirim", value: invoices.filter(i => i.status === "sent").length, color: "text-blue-600" },
            { label: "Lunas", value: invoices.filter(i => i.status === "paid").length, color: "text-green-600" },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Memuat data...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">No. Invoice</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Tanggal</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Subtotal</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Total</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.invoice_id}
                        className="border-b hover:bg-gray-50 cursor-pointer"
                        onClick={() => openDetail(inv)}
                      >
                        <td className="px-3 py-2 font-semibold text-primary">{inv.invoice_number}</td>
                        <td className="px-3 py-2 text-gray-600">{inv.invoice_date}</td>
                        <td className="px-3 py-2 font-medium">{inv.customer_name}</td>
                        <td className="px-3 py-2">{formatRupiah(inv.subtotal)}</td>
                        <td className="px-3 py-2 font-semibold">{formatRupiah(inv.grand_total)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => downloadPdf(inv.invoice_id, inv.invoice_number)}
                            disabled={generatingPdf}
                            className="px-2 py-1 bg-primary text-white rounded text-[10px] hover:bg-primary/90 disabled:opacity-50"
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredInvoices.length === 0 && (
                  <div className="p-8 text-center text-gray-400 text-sm">Tidak ada invoice</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-primary">Buat Invoice Baru</h2>
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nama Customer <span className="text-red-500">*</span></label>
                  <input
                    value={formData.customer_name}
                    onChange={e => setFormData(p => ({ ...p, customer_name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Nama perusahaan / perorangan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Invoice <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formData.invoice_date}
                    onChange={e => setFormData(p => ({ ...p, invoice_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Alamat Customer</label>
                  <textarea
                    value={formData.customer_address}
                    onChange={e => setFormData(p => ({ ...p, customer_address: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    placeholder="Alamat lengkap customer"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Item Produk</label>
                  <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Produk</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-28">Variant</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-gray-600 w-16">Qty</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-32">Harga Satuan</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-28">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5 relative">
                            <input
                              value={productSearch[i]}
                              onChange={e => {
                                const v = e.target.value;
                                setProductSearch(p => p.map((s, idx) => idx === i ? v : s));
                                setProductDropdowns(p => p.map((_, idx) => idx === i ? true : _));
                                updateItem(i, "product_name", v);
                              }}
                              onFocus={() => setProductDropdowns(p => p.map((_, idx) => idx === i ? true : _))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Cari produk..."
                            />
                            {productDropdowns[i] && (
                              <div className="absolute left-2 top-full mt-0.5 z-50 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto w-64">
                                {masterItems
                                  .filter(m => {
                                    const q = (productSearch[i] || "").toLowerCase();
                                    return !q || (m.Product_name || m.Artikel || "").toLowerCase().includes(q);
                                  })
                                  .slice(0, 30)
                                  .map((m, j) => (
                                    <div
                                      key={j}
                                      className="px-3 py-1.5 hover:bg-primary/10 cursor-pointer text-[11px]"
                                      onMouseDown={() => selectProduct(i, m)}
                                    >
                                      <div className="font-medium">{m.Product_name || m.Artikel}</div>
                                      {m.HPJ && <div className="text-gray-400 text-[10px]">{formatRupiah(m.HPJ)}</div>}
                                    </div>
                                  ))
                                }
                                {masterItems.filter(m => {
                                  const q = (productSearch[i] || "").toLowerCase();
                                  return !q || (m.Product_name || m.Artikel || "").toLowerCase().includes(q);
                                }).length === 0 && (
                                  <div className="px-3 py-2 text-gray-400 text-center">Tidak ditemukan</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={item.variant}
                              onChange={e => updateItem(i, "variant", e.target.value)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Warna/ukuran"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={e => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price}
                              onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] text-right focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700">
                            {formatRupiah(item.qty * item.unit_price)}
                          </td>
                          <td className="px-2 py-1.5">
                            {formItems.length > 1 && (
                              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals + Tax */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-700">PPN (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax_percent}
                    onChange={e => setFormData(p => ({ ...p, tax_percent: e.target.value }))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={String(master.ppn_percentage || 0)}
                  />
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs text-gray-500">Sub Total: <span className="font-semibold text-gray-800">{formatRupiah(calcSubtotal)}</span></div>
                  {parseFloat(formData.tax_percent) > 0 && (
                    <div className="text-xs text-gray-500">PPN {formData.tax_percent}%: <span className="font-semibold text-gray-800">{formatRupiah(calcTax)}</span></div>
                  )}
                  <div className="text-sm font-bold text-primary">Total: {formatRupiah(calcTotal)}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                Batal
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Menyimpan..." : "Buat Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b z-10">
              <div>
                <h2 className="text-base font-bold text-primary">{selectedInvoice.invoice_number}</h2>
                <p className="text-xs text-gray-500">{selectedInvoice.customer_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadPdf(selectedInvoice.invoice_id, selectedInvoice.invoice_number)}
                  disabled={generatingPdf}
                  className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {generatingPdf ? "..." : "PDF"}
                </button>
                <button onClick={() => setShowDetailModal(false)}
                  className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                {[
                  ["Tanggal", selectedInvoice.invoice_date],
                  ["Status", selectedInvoice.status],
                  ["Tgl Dibuat", selectedInvoice.created_at?.split("T")[0] || ""],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-gray-400 mb-0.5">{k}</p>
                    {k === "Status" ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(v)}`}>{v}</span>
                    ) : (
                      <p className="font-semibold text-gray-800">{v}</p>
                    )}
                  </div>
                ))}
              </div>

              {selectedInvoice.customer_address && (
                <div className="text-xs">
                  <p className="text-gray-400 mb-0.5">Alamat</p>
                  <p className="text-gray-700">{selectedInvoice.customer_address}</p>
                </div>
              )}

              {/* Items table */}
              {loadingDetail ? (
                <div className="text-center py-4 text-xs text-gray-400">Memuat item...</div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Produk</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Variant</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((it, i) => (
                        <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                          <td className="px-3 py-2">{it.product_name}</td>
                          <td className="px-3 py-2 text-gray-500">{it.variant || "-"}</td>
                          <td className="px-3 py-2 text-center">{it.qty}</td>
                          <td className="px-3 py-2 text-right">{formatRupiah(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatRupiah(it.total_price || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-60 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sub Total</span>
                    <span className="font-medium">{formatRupiah(selectedInvoice.subtotal)}</span>
                  </div>
                  {parseNum(selectedInvoice.tax_percent) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">PPN {selectedInvoice.tax_percent}%</span>
                      <span className="font-medium">{formatRupiah(selectedInvoice.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5">
                    <span className="font-bold text-primary">Total Pembayaran</span>
                    <span className="font-bold text-primary text-sm">{formatRupiah(selectedInvoice.grand_total)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoice.amount_in_words && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <p className="text-[10px] text-amber-600 font-medium">Terbilang:</p>
                  <p className="text-xs text-amber-800 italic mt-0.5">{selectedInvoice.amount_in_words}</p>
                </div>
              )}

              {/* Status actions */}
              {user?.invoice_edit && selectedInvoice.status !== "deleted" && (
                <div className="flex gap-2 flex-wrap">
                  {[
                    { status: "draft", label: "Draft", cls: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
                    { status: "sent", label: "Terkirim", cls: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                    { status: "paid", label: "Lunas", cls: "bg-green-100 text-green-700 hover:bg-green-200" },
                    { status: "cancelled", label: "Batalkan", cls: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
                  ].filter(s => s.status !== selectedInvoice.status).map(s => (
                    <button key={s.status} onClick={() => updateStatus(selectedInvoice.invoice_id, s.status)}
                      className={`px-3 py-1.5 rounded text-xs font-medium ${s.cls}`}>
                      → {s.label}
                    </button>
                  ))}
                  {user?.invoice_delete && (
                    <button onClick={() => handleDelete(selectedInvoice.invoice_id)}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 ml-auto">
                      Hapus
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Master Settings Modal ──────────────────────────────────────────────── */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-primary">Pengaturan Invoice</h2>
              <button onClick={() => setShowMasterModal(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {[
                { key: "company_name", label: "Nama Perusahaan", type: "text" },
                { key: "company_address", label: "Alamat Perusahaan", type: "textarea" },
                { key: "company_phone", label: "Telepon", type: "text" },
                { key: "company_email", label: "Email", type: "text" },
                { key: "header_image_url", label: "URL Gambar Header", type: "text" },
                { key: "signature_image_url", label: "URL Gambar Tanda Tangan", type: "text" },
                { key: "invoice_prefix", label: "Prefix Nomor Invoice", type: "text" },
                { key: "next_invoice_number", label: "Nomor Invoice Berikutnya", type: "number" },
                { key: "ppn_percentage", label: "Default PPN (%)", type: "number" },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  {type === "textarea" ? (
                    <textarea
                      value={(masterForm as any)[key] || ""}
                      onChange={e => setMasterForm(p => ({ ...p, [key]: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  ) : (
                    <input
                      type={type}
                      value={(masterForm as any)[key] || ""}
                      onChange={e => setMasterForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterForm.default_use_ppn === true || masterForm.default_use_ppn === "TRUE"}
                    onChange={e => setMasterForm(p => ({ ...p, default_use_ppn: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-gray-700">Aktifkan PPN default</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={masterForm.default_use_signature === true || masterForm.default_use_signature === "TRUE"}
                    onChange={e => setMasterForm(p => ({ ...p, default_use_signature: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-gray-700">Tampilkan tanda tangan</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setShowMasterModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                Batal
              </button>
              <button onClick={saveMaster} disabled={saving}
                className="flex-1 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close product dropdowns */}
      {productDropdowns.some(Boolean) && (
        <div className="fixed inset-0 z-40" onClick={() => setProductDropdowns(p => p.map(() => false))} />
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}