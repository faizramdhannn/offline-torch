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
  doc_type?: string;
  created_at: string;
  signature_store?: string;
  signature_pic?: string;
  use_signature?: string | boolean;
}

interface MasterItem {
  SKU: string;
  image_url: string;
  Product_name: string;
  Stock: string;
  Artikel: string;
  Category: string;
  Grade: string;
  HPP: string;
  HPT: string;
  HPJ: string;
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
    submitted: "bg-blue-100 text-blue-700",
    deleted: "bg-red-100 text-red-600",
  };
  return map[s] || "bg-gray-100 text-gray-500";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    deleted: "Deleted",
  };
  return map[(status || "").toLowerCase()] || status;
}

// ── Torch Store List ──────────────────────────────────────────────────────────
const TORCH_STORES = [
  "Torch Lembong",
  "Torch Margonda",
  "Torch Karawaci",
  "Torch Jogja",
  "Torch Makassar",
  "Torch Cirebon",
  "Torch Purwokerto",
  "Torch Karawang",
  "Torch Pekalongan",
  "Torch Lampung",
  "Torch Surabaya",
  "Torch Malang",
];

// ── Empty Item ────────────────────────────────────────────────────────────────
const emptyItem = (): InvoiceItem => ({ product_name: "", qty: 1, unit_price: 0, total_price: 0 });

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
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [docType, setDocType] = useState<"invoice" | "quotation">("invoice");
  const [manualInvoiceNumber, setManualInvoiceNumber] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [usePPN, setUsePPN] = useState(false);
  const [useSignature, setUseSignature] = useState(false);
  const [formData, setFormData] = useState({
    customer_address: "",
    invoice_date: new Date().toISOString().split("T")[0],
  });
  const [formItems, setFormItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [productQuery, setProductQuery] = useState<string[]>([""]);
  const [productDropdowns, setProductDropdowns] = useState<boolean[]>([false]);

  // Create - Signature
  const [signatureStore, setSignatureStore] = useState("");
  const [signaturePic, setSignaturePic] = useState("");

  // Edit form state
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editUsePPN, setEditUsePPN] = useState(false);
  const [editUseSignature, setEditUseSignature] = useState(false);
  const [editSignatureStore, setEditSignatureStore] = useState("");
  const [editSignaturePic, setEditSignaturePic] = useState("");
  const [editProductSearch, setEditProductSearch] = useState<string[]>([]);
  const [editProductQuery, setEditProductQuery] = useState<string[]>([]);
  const [editProductDropdowns, setEditProductDropdowns] = useState<boolean[]>([]);

  // Master form
  const [masterForm, setMasterForm] = useState<MasterInvoice>({});

  const PPN_RATE = 11;

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
        fetch("/api/master-item?mode=invoice"),
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

  // ── Open Edit ──────────────────────────────────────────────────────────────
  const openEdit = (inv: Invoice, items: InvoiceItem[]) => {
    setEditInvoice(inv);
    setEditItems(items.map(it => ({ ...it })));
    setEditCustomerName(inv.customer_name);
    setEditCustomerAddress(inv.customer_address || "");
    setEditDate(inv.invoice_date);
    setEditUsePPN(parseNum(inv.tax_percent) > 0);
    // Handle both boolean true and string 'TRUE' from Google Sheets
    const useSign = inv.use_signature === true || inv.use_signature === "TRUE";
    setEditUseSignature(useSign);
    setEditSignatureStore(inv.signature_store || "");
    setEditSignaturePic(inv.signature_pic || "");
    setEditProductSearch(items.map(it => it.product_name));
    setEditProductQuery(items.map(it => it.product_name));
    setEditProductDropdowns(items.map(() => false));
    setShowEditModal(true);
  };

  // ── Create Invoice ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const customerName = manualCustomerName.trim();
    if (!customerName) { showMessage("Nama customer wajib diisi", "error"); return; }
    if (docType === "invoice" && !manualInvoiceNumber.trim()) { showMessage("Nomor invoice wajib diisi", "error"); return; }
    if (formItems.some(it => !it.product_name)) { showMessage("Nama produk wajib diisi", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          customer_name: customerName,
          tax_percent: usePPN ? PPN_RATE : 0,
          use_signature: useSignature,
          items: formItems,
          created_by: user?.user_name,
          doc_type: docType,
          manual_invoice_number: docType === "invoice" ? manualInvoiceNumber.trim() : null,
          signature_store: signatureStore,
          signature_pic: signaturePic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const label = docType === "quotation" ? "Quotation" : `Invoice ${data.invoice_number}`;
      showMessage(`${label} berhasil dibuat!`, "success");
      setShowCreateModal(false);
      resetCreateForm();
      fetchAll();
    } catch (e: any) {
      showMessage(e.message || "Gagal membuat dokumen", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Invoice ───────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editInvoice) return;
    if (!editCustomerName.trim()) { showMessage("Nama customer wajib diisi", "error"); return; }
    if (editItems.some(it => !it.product_name)) { showMessage("Nama produk wajib diisi", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: editInvoice.invoice_id,
          customer_name: editCustomerName.trim(),
          customer_address: editCustomerAddress,
          invoice_date: editDate,
          tax_percent: editUsePPN ? PPN_RATE : 0,
          items: editItems,
          use_signature: editUseSignature,
          signature_store: editSignatureStore,
          signature_pic: editSignaturePic,
          updated_by: user?.user_name,
        }),
      });
      if (!res.ok) throw new Error();
      showMessage("Invoice berhasil diperbarui!", "success");
      setShowEditModal(false);
      setShowDetailModal(false);
      fetchAll();
    } catch {
      showMessage("Gagal memperbarui invoice", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setDocType("invoice");
    setManualInvoiceNumber("");
    setSelectedStore("");
    setManualCustomerName("");
    setUsePPN(false);
    setUseSignature(false);
    setSignatureStore("");
    setSignaturePic("");
    setFormData({ customer_address: "", invoice_date: new Date().toISOString().split("T")[0] });
    setFormItems([emptyItem()]);
    setProductSearch([""]);
    setProductQuery([""]);
    setProductDropdowns([false]);
  };

  // ── Items management (Create) ──────────────────────────────────────────────
  const addItem = () => {
    setFormItems(p => [...p, emptyItem()]);
    setProductSearch(p => [...p, ""]);
    setProductQuery(p => [...p, ""]);
    setProductDropdowns(p => [...p, false]);
  };

  const removeItem = (i: number) => {
    setFormItems(p => p.filter((_, idx) => idx !== i));
    setProductSearch(p => p.filter((_, idx) => idx !== i));
    setProductQuery(p => p.filter((_, idx) => idx !== i));
    setProductDropdowns(p => p.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: keyof InvoiceItem, value: any) => {
    setFormItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const selectProduct = (i: number, item: MasterItem) => {
    const hpj = parseNum(item.HPJ);
    const name = item.Product_name || item.SKU || "";
    setFormItems(p => p.map((it, idx) => idx === i
      ? { ...it, product_name: name, unit_price: hpj }
      : it
    ));
    setProductSearch(p => p.map((v, idx) => idx === i ? name : v));
    setProductDropdowns(p => p.map(() => false));
  };

  const handleProductBlur = (i: number) => {
    setTimeout(() => {
      setProductDropdowns(p => p.map((_, idx) => idx === i ? false : _));
    }, 150);
  };

  // ── Items management (Edit) ────────────────────────────────────────────────
  const addEditItem = () => {
    setEditItems(p => [...p, emptyItem()]);
    setEditProductSearch(p => [...p, ""]);
    setEditProductQuery(p => [...p, ""]);
    setEditProductDropdowns(p => [...p, false]);
  };

  const removeEditItem = (i: number) => {
    setEditItems(p => p.filter((_, idx) => idx !== i));
    setEditProductSearch(p => p.filter((_, idx) => idx !== i));
    setEditProductQuery(p => p.filter((_, idx) => idx !== i));
    setEditProductDropdowns(p => p.filter((_, idx) => idx !== i));
  };

  const selectEditProduct = (i: number, item: MasterItem) => {
    const hpj = parseNum(item.HPJ);
    const name = item.Product_name || item.SKU || "";
    setEditItems(p => p.map((it, idx) => idx === i ? { ...it, product_name: name, unit_price: hpj } : it));
    setEditProductSearch(p => p.map((v, idx) => idx === i ? name : v));
    setEditProductDropdowns(p => p.map(() => false));
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
  const canDownloadPdf = (inv: Invoice) => inv.status === "submitted";

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

  // ── Calculated totals (Create) ─────────────────────────────────────────────
  const calcSubtotal = formItems.reduce((s, it) => s + (Number(it.qty) * Number(it.unit_price)), 0);
  const calcTax = usePPN ? Math.round(calcSubtotal * (PPN_RATE / 100)) : 0;
  const calcTotal = calcSubtotal;

  // ── Calculated totals (Edit) ───────────────────────────────────────────────
  const editCalcSubtotal = editItems.reduce((s, it) => s + (Number(it.qty) * Number(it.unit_price)), 0);
  const editCalcTax = editUsePPN ? Math.round(editCalcSubtotal * (PPN_RATE / 100)) : 0;

  // ── Filtered items for dropdown ────────────────────────────────────────────
  const getFilteredItems = (searchVal: string) => {
    const q = (searchVal || "").toLowerCase().trim();
    if (!q) return masterItems.slice(0, 50);
    return masterItems.filter(m =>
      (m.Product_name || "").toLowerCase().includes(q) ||
      (m.SKU || "").toLowerCase().includes(q)
    );
  };

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
                Buat Dokumen
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
              <option value="submitted">Submitted</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total Invoice", value: invoices.length, color: "text-primary" },
            { label: "Draft", value: invoices.filter(i => i.status === "draft").length, color: "text-gray-600" },
            { label: "Submitted", value: invoices.filter(i => i.status === "submitted").length, color: "text-blue-600" },
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
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipe</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Tanggal</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Subtotal</th>
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
                        <td className="px-3 py-2 font-semibold text-primary">{inv.invoice_number || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            (inv.doc_type || "invoice") === "quotation"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {(inv.doc_type || "invoice") === "quotation" ? "Quotation" : "Invoice"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{inv.invoice_date}</td>
                        <td className="px-3 py-2 font-medium">{inv.customer_name}</td>
                        <td className="px-3 py-2 font-semibold">{formatRupiah(inv.subtotal)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(inv.status)}`}>
                            {statusLabel(inv.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                          {canDownloadPdf(inv) && user?.invoice_create ? (
                            <button
                              onClick={() => downloadPdf(inv.invoice_id, inv.invoice_number)}
                              disabled={generatingPdf}
                              className="px-2 py-1 bg-primary text-white rounded text-[10px] hover:bg-primary/90 disabled:opacity-50"
                            >
                              PDF
                            </button>
                          ) : (
                            <span className="px-2 py-1 text-gray-300 text-[10px]">
                              {inv.status === "draft" ? "Draft" : "—"}
                            </span>
                          )}
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
              <h2 className="text-base font-bold text-primary">Buat Dokumen Baru</h2>
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── Tipe Dokumen ── */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Tipe Dokumen</label>
                <div className="flex gap-2">
                  {(["invoice", "quotation"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setDocType(type)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        docType === type
                          ? type === "invoice"
                            ? "border-primary bg-primary text-white"
                            : "border-purple-600 bg-purple-600 text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {type === "invoice" ? "Invoice" : "Quotation"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Nomor Invoice (hanya saat Invoice) ── */}
              {docType === "invoice" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nomor Invoice <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={manualInvoiceNumber}
                    onChange={e => setManualInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    placeholder="Contoh: INV/00002"
                  />
                </div>
              )}

              {/* ── Customer / Kepada ── */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Kepada <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={manualCustomerName}
                      onChange={e => setManualCustomerName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Nama customer / toko..."
                    />
                    {manualCustomerName && (
                      <button
                        onClick={() => setManualCustomerName("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={formData.invoice_date}
                      onChange={e => setFormData(p => ({ ...p, invoice_date: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Alamat Customer</label>
                    <textarea
                      value={formData.customer_address}
                      onChange={e => setFormData(p => ({ ...p, customer_address: e.target.value }))}
                      rows={1}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      placeholder="Alamat lengkap customer"
                    />
                  </div>
                </div>
              </div>

              {/* ── Items ── */}
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

                <div className="border border-gray-200 rounded-lg overflow-visible">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Produk</th>
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
                              value={productSearch[i] ?? ""}
                              onChange={e => {
                                const v = e.target.value;
                                setProductSearch(p => p.map((s, idx) => idx === i ? v : s));
                                setProductQuery(p => p.map((s, idx) => idx === i ? v : s));
                                setProductDropdowns(p => p.map((_, idx) => idx === i ? true : _));
                                updateItem(i, "product_name", v);
                              }}
                              onFocus={() => setProductDropdowns(p => p.map((_, idx) => idx === i ? true : _))}
                              onClick={() => setProductDropdowns(p => p.map((_, idx) => idx === i ? true : _))}
                              onBlur={() => handleProductBlur(i)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Cari produk..."
                            />
                            {productDropdowns[i] && (
                              <div className="absolute left-0 top-full mt-0.5 z-[200] bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto w-80">
                                {getFilteredItems(productQuery[i]).length === 0 ? (
                                  <div className="px-3 py-2 text-gray-400 text-center text-[11px]">Tidak ditemukan</div>
                                ) : (
                                  getFilteredItems(productQuery[i]).map((m, j) => (
                                    <div
                                      key={`${j}-${m.SKU}-${m.Product_name}`}
                                      className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-[11px] border-b last:border-0"
                                      onMouseDown={() => selectProduct(i, m)}
                                    >
                                      <div className="font-medium text-gray-800">
                                        {m.Product_name || "(no name)"}
                                      </div>
                                      <div className="text-gray-400 text-[10px] mt-0.5 flex gap-2">
                                        {m.SKU && <span>{m.SKU}</span>}
                                        {m.HPJ && <span>{formatRupiah(m.HPJ)}</span>}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="1"
                              value={item.qty ?? 1}
                              onChange={e => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price ?? 0}
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

              {/* ── Totals + Toggles ── */}
              <div className="flex justify-between items-start">
                <div className="space-y-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={usePPN}
                      onChange={e => setUsePPN(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Gunakan PPN <span className="font-bold text-primary">11%</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useSignature}
                      onChange={e => setUseSignature(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Gunakan tanda tangan &amp; cap
                    </span>
                  </label>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-gray-500">
                    Sub Total: <span className="font-semibold text-gray-800">{formatRupiah(calcSubtotal)}</span>
                  </div>
                  {usePPN && (
                    <div className="text-xs text-gray-500">
                      PPN 11% <span className="text-[10px] text-gray-400">(info)</span>:{" "}
                      <span className="font-semibold text-gray-800">{formatRupiah(calcTax)}</span>
                    </div>
                  )}
                  <div className="text-sm font-bold text-primary">
                    Total: {formatRupiah(calcTotal)}
                  </div>
                </div>
              </div>

              {/* ── Tanda Tangan Kanan Bawah — hanya tampil jika useSignature dicentang ── */}
              {useSignature && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <label className="text-xs font-semibold text-gray-700">
                      Tanda Tangan Penerima (Kanan Bawah PDF)
                    </label>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-500 mb-1.5">Pilih Toko Penerima</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TORCH_STORES.map((store) => (
                        <button
                          key={store}
                          type="button"
                          onClick={() => setSignatureStore(prev => prev === store ? "" : store)}
                          className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left truncate transition-all ${
                            signatureStore === store
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {store}
                        </button>
                      ))}
                    </div>
                    {signatureStore && (
                      <button
                        onClick={() => setSignatureStore("")}
                        className="mt-1.5 text-[10px] text-gray-400 hover:text-red-500 underline"
                      >
                        Hapus pilihan toko
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Nama PIC / Penerima</label>
                    <input
                      value={signaturePic}
                      onChange={e => setSignaturePic(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      placeholder="Nama lengkap PIC penerima..."
                    />
                  </div>

                  {(signatureStore || signaturePic) && (
                    <div className="bg-white border border-primary/20 rounded px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Preview tanda tangan kanan:</p>
                      <p className="text-xs font-bold text-primary">{signatureStore || "—"}</p>
                      {signaturePic && <p className="text-[11px] text-gray-600">{signaturePic}</p>}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                Batal
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Menyimpan..." : docType === "quotation" ? "Buat Quotation" : "Buat Invoice"}
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
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-primary">
                    {selectedInvoice.invoice_number || "—"}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    (selectedInvoice.doc_type || "invoice") === "quotation"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {(selectedInvoice.doc_type || "invoice") === "quotation" ? "Quotation" : "Invoice"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{selectedInvoice.customer_name}</p>
              </div>
              <div className="flex items-center gap-2">
                {canDownloadPdf(selectedInvoice) && user?.invoice_create && (
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
                )}
                {selectedInvoice.status === "draft" && user?.invoice_create && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    PDF (Draft)
                  </span>
                )}
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(v)}`}>
                        {statusLabel(v)}
                      </span>
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

              {/* Signature info */}
              {(selectedInvoice.signature_store || selectedInvoice.signature_pic) && (
                <div className="text-xs bg-gray-50 border border-gray-200 rounded p-3">
                  <p className="text-gray-400 mb-1">Tanda Tangan Penerima</p>
                  {selectedInvoice.signature_store && (
                    <p className="font-semibold text-primary">{selectedInvoice.signature_store}</p>
                  )}
                  {selectedInvoice.signature_pic && (
                    <p className="text-gray-600">{selectedInvoice.signature_pic}</p>
                  )}
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
                        <th className="px-3 py-2 text-center font-semibold text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Harga</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((it, i) => (
                        <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                          <td className="px-3 py-2">{it.product_name}</td>
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
                    <div className="flex justify-between text-gray-400">
                      <span>PPN {selectedInvoice.tax_percent}% <span className="text-[10px]">(info)</span></span>
                      <span>{formatRupiah(selectedInvoice.tax_amount)}</span>
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
                  {/* Tombol Edit — hanya untuk status draft */}
                  {selectedInvoice.status === "draft" && (
                    <button
                      onClick={() => openEdit(selectedInvoice, selectedItems)}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}

                  {[
                    { status: "draft", label: "→ Draft", cls: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
                    { status: "submitted", label: "→ Submit", cls: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                  ].filter(s => s.status !== selectedInvoice.status).map(s => (
                    <button key={s.status} onClick={() => updateStatus(selectedInvoice.invoice_id, s.status)}
                      className={`px-3 py-1.5 rounded text-xs font-medium ${s.cls}`}>
                      {s.label}
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

              {!user?.invoice_edit && selectedInvoice.status === "draft" && user?.invoice_create && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-700">
                  ⏳ Dokumen masih dalam status <strong>Draft</strong>. PDF akan tersedia setelah disubmit oleh tim yang berwenang.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {showEditModal && editInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[60] overflow-y-auto py-6">
          <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold text-primary">
                  Edit Dokumen
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editInvoice.invoice_number || "Quotation"} · {editInvoice.customer_name}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── Customer / Kepada ── */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kepada <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Nama customer / toko..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Alamat Customer</label>
                    <textarea
                      value={editCustomerAddress}
                      onChange={e => setEditCustomerAddress(e.target.value)}
                      rows={1}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      placeholder="Alamat lengkap customer"
                    />
                  </div>
                </div>
              </div>

              {/* ── Items ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">Item Produk</label>
                  <button onClick={addEditItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-visible">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-8">#</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Produk</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-gray-600 w-16">Qty</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-32">Harga Satuan</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-gray-600 w-28">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5 relative">
                            <input
                              value={editProductSearch[i] ?? item.product_name}
                              onChange={e => {
                                const v = e.target.value;
                                setEditProductSearch(p => p.map((s, idx) => idx === i ? v : s));
                                setEditProductQuery(p => p.map((s, idx) => idx === i ? v : s));
                                setEditProductDropdowns(p => p.map((_, idx) => idx === i ? true : _));
                                setEditItems(p => p.map((it, idx) => idx === i ? { ...it, product_name: v } : it));
                              }}
                              onFocus={() => setEditProductDropdowns(p => p.map((_, idx) => idx === i ? true : _))}
                              onClick={() => setEditProductDropdowns(p => p.map((_, idx) => idx === i ? true : _))}
                              onBlur={() => setTimeout(() => setEditProductDropdowns(p => p.map((_, idx) => idx === i ? false : _)), 150)}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Cari produk..."
                            />
                            {editProductDropdowns[i] && (
                              <div className="absolute left-0 top-full mt-0.5 z-[200] bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto w-80">
                                {getFilteredItems(editProductQuery[i]).length === 0 ? (
                                  <div className="px-3 py-2 text-gray-400 text-center text-[11px]">Tidak ditemukan</div>
                                ) : (
                                  getFilteredItems(editProductQuery[i]).map((m, j) => (
                                    <div
                                      key={`${j}-${m.SKU}-${m.Product_name}`}
                                      className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-[11px] border-b last:border-0"
                                      onMouseDown={() => selectEditProduct(i, m)}
                                    >
                                      <div className="font-medium text-gray-800">
                                        {m.Product_name || "(no name)"}
                                      </div>
                                      <div className="text-gray-400 text-[10px] mt-0.5 flex gap-2">
                                        {m.SKU && <span>{m.SKU}</span>}
                                        {m.HPJ && <span>{formatRupiah(m.HPJ)}</span>}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="1"
                              value={item.qty ?? 1}
                              onChange={e => setEditItems(p => p.map((it, idx) => idx === i ? { ...it, qty: parseInt(e.target.value) || 1 } : it))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={item.unit_price ?? 0}
                              onChange={e => setEditItems(p => p.map((it, idx) => idx === i ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-[11px] text-right focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700">
                            {formatRupiah(item.qty * item.unit_price)}
                          </td>
                          <td className="px-2 py-1.5">
                            {editItems.length > 1 && (
                              <button onClick={() => removeEditItem(i)} className="text-red-400 hover:text-red-600">
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

              {/* ── Totals + Toggles ── */}
              <div className="flex justify-between items-start">
                <div className="space-y-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editUsePPN}
                      onChange={e => setEditUsePPN(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Gunakan PPN <span className="font-bold text-primary">11%</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editUseSignature}
                      onChange={e => setEditUseSignature(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-medium text-gray-700">
                      Gunakan tanda tangan &amp; cap
                    </span>
                  </label>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-gray-500">
                    Sub Total: <span className="font-semibold text-gray-800">{formatRupiah(editCalcSubtotal)}</span>
                  </div>
                  {editUsePPN && (
                    <div className="text-xs text-gray-500">
                      PPN 11% <span className="text-[10px] text-gray-400">(info)</span>:{" "}
                      <span className="font-semibold text-gray-800">{formatRupiah(editCalcTax)}</span>
                    </div>
                  )}
                  <div className="text-sm font-bold text-primary">
                    Total: {formatRupiah(editCalcSubtotal)}
                  </div>
                </div>
              </div>

              {/* ── Tanda Tangan — hanya tampil jika dicentang ── */}
              {editUseSignature && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <label className="text-xs font-semibold text-gray-700">
                      Tanda Tangan Penerima (Kanan Bawah PDF)
                    </label>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-500 mb-1.5">Pilih Toko Penerima</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TORCH_STORES.map((store) => (
                        <button
                          key={store}
                          type="button"
                          onClick={() => setEditSignatureStore(prev => prev === store ? "" : store)}
                          className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left truncate transition-all ${
                            editSignatureStore === store
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {store}
                        </button>
                      ))}
                    </div>
                    {editSignatureStore && (
                      <button
                        onClick={() => setEditSignatureStore("")}
                        className="mt-1.5 text-[10px] text-gray-400 hover:text-red-500 underline"
                      >
                        Hapus pilihan toko
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Nama PIC / Penerima</label>
                    <input
                      value={editSignaturePic}
                      onChange={e => setEditSignaturePic(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      placeholder="Nama lengkap PIC penerima..."
                    />
                  </div>

                  {(editSignatureStore || editSignaturePic) && (
                    <div className="bg-white border border-primary/20 rounded px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Preview tanda tangan kanan:</p>
                      <p className="text-xs font-bold text-primary">{editSignatureStore || "—"}</p>
                      {editSignaturePic && <p className="text-[11px] text-gray-600">{editSignaturePic}</p>}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                Batal
              </button>
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
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
                { key: "signature_image_url", label: "URL Gambar Tanda Tangan & Cap", type: "text" },
                { key: "invoice_prefix", label: "Prefix Nomor Invoice", type: "text" },
                { key: "next_invoice_number", label: "Nomor Invoice Berikutnya", type: "number" },
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

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}