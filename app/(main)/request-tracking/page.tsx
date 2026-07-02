"use client";

import { usePushNotification } from "@/hooks/usePushNotification";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { motion } from "framer-motion";
import {
  Plus,
  Truck,
  List,
  MapPinned,
} from "lucide-react";

import { SectionHeader } from "@/components/request-tracking/SectionHeader";
import { Button } from "@/components/request-tracking/Button";
import { Toolbar, type StatusFilter } from "@/components/request-tracking/Toolbar";
import { EmptyState } from "@/components/request-tracking/EmptyState";
import { TableSkeletonRows } from "@/components/request-tracking/LoadingSkeleton";
import { Pagination } from "@/components/request-tracking/Pagination";
import { ShipmentTable } from "@/components/request-tracking/ShipmentTable";
import { DetailPopup } from "@/components/request-tracking/DetailPopup";
import { Modal } from "@/components/request-tracking/Modal";
import { ConfirmationDialog } from "@/components/request-tracking/ConfirmationDialog";
import { DropZone } from "@/components/request-tracking/DropZone";
import { ExpeditionBadge, CopyButton, TypeReasonBadge } from "@/components/request-tracking/DomainBadges";
import { FieldLabel, FieldHint, inputClass, FormDivider } from "@/components/request-tracking/FormField";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  type_reason?: string;
  sales_order?: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  tracking_number?: string;
  has_processed?: string;
}

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
}

interface DropdownData {
  requesters: string[];
  assignees: { label: string; value: string }[];
  reasons: string[];
}

const EXPEDITIONS = ["SiCepat", "Lion"];

const EXPEDITION_LOGO: Record<string, string> = {
  SiCepat: "/Logo Sicepat.png",
  Lion: "/Logo Lion.png",
};

const TYPE_REASONS = ["Order", "Retur", "Request Product", "Free Gift", "Sending Document"];
const REQUIRES_SALES_ORDER = ["Order", "Retur", "Request Product", "Free Gift"];

function validateSalesOrder(typeReason: string, salesOrder: string): string {
  if (!REQUIRES_SALES_ORDER.includes(typeReason)) return "";
  if (!salesOrder.trim()) return "No. Sales Order wajib diisi untuk tipe ini";
  const val = salesOrder.trim();
  const valid =
    /^#\d+$/.test(val) ||
    /^MAT-MR/i.test(val) ||
    /^MAT-STE/i.test(val);
  if (!valid) return "Format: #angka, MAT-MR..., atau MAT-STE...";
  return "";
}

function formatStoreAddress(s: StoreAddress): string {
  return [s.store_location, s.phone_number, s.address].filter(Boolean).join("\n");
}

function isValidIndonesianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  const withPrefixPattern = /^(\+?628|08)[0-9]{7,11}$/;
  const barePattern = /^8[0-9]{7,11}$/;
  return withPrefixPattern.test(cleaned) || barePattern.test(cleaned);
}

function extractValidPhone(text: string): string | null {
  const tokens = text.split(/[\s,;]+/);
  for (const token of tokens) {
    const cleaned = token.replace(/[\-().]/g, "");
    if (isValidIndonesianPhone(cleaned)) return cleaned;
  }
  return null;
}

function validateReceiver(val: string): string {
  if (!val.trim()) return "Receiver wajib diisi";
  const validPhone = extractValidPhone(val);
  if (!validPhone) return "Sertakan nomor telepon yang valid (08xx, +628xx, atau 628xx)";
  const postalPattern = /(?<![0-9])\d{5}(?![0-9])/;
  if (!postalPattern.test(val)) return "Sertakan kode pos 5 digit (contoh: 40123)";
  if (val.trim().length < 20) return "Terlalu pendek — sertakan nama, nomor telepon, alamat, dan kode pos";
  return "";
}

// ── Google Drive URL converter (used by CSV export download links) ───────
function getDownloadUrl(url: string): string {
  if (!url) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  return url;
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═════════════════════════════════════════════════════════════════════════════
export default function RequestTrackingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TrackingItem[]>([]);
  const [storeAddresses, setStoreAddresses] = useState<StoreAddress[]>([]);
  const [dropdownData, setDropdownData] = useState<DropdownData>({ requesters: [], assignees: [], reasons: [] });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrackingItem | null>(null);
  const [detailItem, setDetailItem] = useState<TrackingItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  useSessionGuard();
  usePushNotification(user?.user_name ?? null);

  const [activeTab, setActiveTab] = useState<"table" | "tracking">("table");
  const [iframeUrl] = useState("https://offline-tracking.vercel.app/");
  const [searchReceiver, setSearchReceiver] = useState("");

  // ── UI-only additions (visual layer): status filter pills, manual refresh
  // spinner, CSV export, and a modern confirm dialog in place of window.confirm().
  // None of these touch the fetch/state/validation logic below.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrackingItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const pendingResiRef = useRef<string | null>(null);

  const itemsPerPage = 25;
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedSenderDetails, setSelectedSenderDetails] = useState<StoreAddress | null>(null);
  const [editSenderDetails, setEditSenderDetails] = useState<StoreAddress | null>(null);
  const [addReceiverMode, setAddReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [editReceiverMode, setEditReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [addReceiverStore, setAddReceiverStore] = useState<string>("");
  const [editReceiverStore, setEditReceiverStore] = useState<string>("");
  const [receiverError, setReceiverError] = useState("");
  const [salesOrderError, setSalesOrderError] = useState("");
  const [editSalesOrderError, setEditSalesOrderError] = useState("");

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    assigned_to: "", expedition: "", sender: "", receiver: "",
    weight: "", reason: "", type_reason: "", sales_order: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request_tracking && !parsedUser.tracking_edit) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchStoreAddresses();
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
    if (pendingResiRef.current && iframeRef.current?.contentWindow) {
      const resi = pendingResiRef.current;
      pendingResiRef.current = null;
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "CHECK_RESI", resi },
          "https://offline-tracking.vercel.app"
        );
      }, 800);
    }
  }, []);

  const handleCheckResi = useCallback((resi: string) => {
    setActiveTab("tracking");
    if (iframeReady && iframeRef.current?.contentWindow) {
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "CHECK_RESI", resi },
          "https://offline-tracking.vercel.app"
        );
      }, 150);
    } else {
      pendingResiRef.current = resi;
    }
  }, [iframeReady]);

  const prevDataRef = useRef<TrackingItem[]>([]);

  const playCompletedSound = () => {
    try { new Audio("/button.mp3").play(); } catch {}
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        username: user?.user_name || "",
        userName: user?.name || "",
        isTrackingEdit: String(!!user?.tracking_edit),
      });

      const res = await fetch(`/api/request-tracking?${params}`);
      if (res.ok) {
        const newData: TrackingItem[] = await res.json();
        if (prevDataRef.current.length > 0) {
          const justCompleted = newData.filter((newItem) => {
            const prev = prevDataRef.current.find((p) => p.id === newItem.id);
            return prev && !prev.link_tracking && !!newItem.link_tracking;
          });
          if (justCompleted.length > 0) playCompletedSound();
        }
        prevDataRef.current = newData;
        setData(newData);
        setLoading(false);
      }
    } catch {}
  };

  const fetchStoreAddresses = async () => {
    try {
      const res = await fetch("/api/store-address");
      if (res.ok) setStoreAddresses(await res.json());
    } catch {}
  };

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/master-dropdown");
      if (res.ok) setDropdownData(await res.json());
    } catch {}
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message); setPopupType(type); setShowPopup(true);
  };

  const playSound = (file: string) => {
    try { new Audio(file).play(); } catch {}
  };

  const logActivity = async (method: string, activity: string) => {
    if (!user) return;
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
      });
    } catch {}
  };

  const handleCopyReceiver = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSenderChange = (storeName: string, isEdit = false) => {
    const found = storeAddresses.find((s) => s.store_location === storeName) || null;
    if (isEdit) { setEditForm((prev) => ({ ...prev, sender: storeName })); setEditSenderDetails(found); }
    else { setForm((prev) => ({ ...prev, sender: storeName })); setSelectedSenderDetails(found); }
  };

  const handleReceiverStoreChange = (storeName: string, isEdit = false) => {
    const found = storeAddresses.find((s) => s.store_location === storeName) || null;
    const formatted = found ? formatStoreAddress(found) : "";
    if (isEdit) { setEditReceiverStore(storeName); setEditForm((prev) => ({ ...prev, receiver: formatted })); }
    else { setAddReceiverStore(storeName); setForm((prev) => ({ ...prev, receiver: formatted })); }
    setReceiverError("");
  };

  // ── Toggle has_processed ──────────────────────────────────────────────
  const handleToggleProcessed = async (item: TrackingItem) => {
    const newValue = item.has_processed === 'TRUE' ? 'FALSE' : 'TRUE';
    setData((prev) =>
      prev.map((d) => d.id === item.id ? { ...d, has_processed: newValue } : d)
    );
    try {
      const res = await fetch('/api/request-tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          update_by: user.user_name,
          has_processed: newValue,
        }),
      });
      if (!res.ok) {
        setData((prev) =>
          prev.map((d) => d.id === item.id ? { ...d, has_processed: item.has_processed } : d)
        );
        showMessage('Gagal update status proses', 'error');
      } else {
        await logActivity('PUT', `Toggled has_processed=${newValue} for ID: ${item.id}`);
      }
    } catch {
      setData((prev) =>
        prev.map((d) => d.id === item.id ? { ...d, has_processed: item.has_processed } : d)
      );
      showMessage('Gagal update status proses', 'error');
    }
  };

  const handleAdd = async () => {
    if (!form.date || !form.assigned_to || !form.expedition || !form.sender || !form.receiver || !form.weight || !form.reason || !form.type_reason) {
      showMessage("Semua field wajib diisi", "error"); return;
    }
    const err = validateReceiver(form.receiver);
    if (err) { showMessage(err, "error"); return; }
    const soErr = validateSalesOrder(form.type_reason, form.sales_order);
    if (soErr) { setSalesOrderError(soErr); showMessage(soErr, "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, request_by: user.user_name }),
      });
      if (res.ok) {
        showMessage("Request berhasil dibuat", "success");
        setShowAddModal(false); resetAddForm();
        try { new Audio("/add.mp3").play(); } catch {}
        try {
          await fetch("/api/push-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignedTo: form.assigned_to,
              title: "Request Shipment Baru",
              body: `${user.user_name}: ${form.expedition} → ${form.receiver.split("\n")[0]}`,
            }),
          });
        } catch {}
        await logActivity("POST", `Created shipment request: ${form.expedition} → ${form.assigned_to}`);
        fetchData();
      } else { showMessage("Gagal membuat request", "error"); }
    } catch { showMessage("Gagal membuat request", "error"); }
    finally { setSubmitting(false); }
  };

  const resetAddForm = () => {
    setForm(emptyForm); setSelectedSenderDetails(null);
    setAddReceiverMode("dropdown"); setAddReceiverStore("");
    setReceiverError(""); setSalesOrderError("");
  };

  const openEdit = (item: TrackingItem) => {
    setSelectedItem(item);
    setEditForm({
      date: item.date, assigned_to: item.assigned_to, expedition: item.expedition,
      sender: item.sender, receiver: item.receiver, weight: item.weight, reason: item.reason,
      type_reason: item.type_reason ?? "", sales_order: item.sales_order ?? "",
    });
    setEditSenderDetails(storeAddresses.find((s) => s.store_location === item.sender) || null);
    const matchedStore = storeAddresses.find((s) => formatStoreAddress(s) === item.receiver);
    if (matchedStore) { setEditReceiverMode("dropdown"); setEditReceiverStore(matchedStore.store_location); }
    else { setEditReceiverMode("custom"); setEditReceiverStore(""); }
    setReceiverError(""); setEditSalesOrderError(""); setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    const err = validateReceiver(editForm.receiver);
    if (err) { showMessage(err, "error"); return; }
    const soErr = validateSalesOrder(editForm.type_reason, editForm.sales_order);
    if (soErr) { setEditSalesOrderError(soErr); showMessage(soErr, "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, update_by: user.user_name, ...editForm }),
      });
      if (res.ok) {
        showMessage("Request berhasil diupdate", "success");
        setShowEditModal(false); setSelectedItem(null);
        await logActivity("PUT", `Updated shipment request ID: ${selectedItem.id}`);
        fetchData();
      } else { showMessage("Gagal update request", "error"); }
    } catch { showMessage("Gagal update request", "error"); }
    finally { setSubmitting(false); }
  };

  // Delete flow: same fetch/logic as before, just routed through a confirm
  // dialog (deleteTarget state) instead of window.confirm().
  const requestDelete = (item: TrackingItem) => setDeleteTarget(item);

  const handleDelete = async () => {
    const item = deleteTarget;
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/request-tracking?id=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((d) => d.id !== item.id));
        playSound("/delete.mp3");
        showMessage("Request dihapus", "success");
        await logActivity("DELETE", `Deleted shipment request ID: ${item.id}`);
      } else { showMessage("Gagal menghapus", "error"); }
    } catch { showMessage("Gagal menghapus", "error"); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const openUpload = (item: TrackingItem) => {
    setSelectedItem(item); setUploadFile(null);
    if (uploadFileRef.current) uploadFileRef.current.value = "";
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!selectedItem || !uploadFile) { showMessage("Pilih file terlebih dahulu", "error"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("id", selectedItem.id);
      fd.append("update_by", user.user_name);
      fd.append("file", uploadFile);
      const res = await fetch("/api/request-tracking", { method: "PUT", body: fd });
      if (res.ok) {
        const result = await res.json();
        showMessage(
          result.tracking_number
            ? `Upload berhasil! No. Resi: ${result.tracking_number}`
            : "File berhasil diupload (nomor resi tidak terdeteksi)",
          "success"
        );
        try {
          await fetch("/api/push-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requesterUsername: selectedItem.request_by,
              title: "Resi Sudah Diupload",
              body: `Resi ${result.tracking_number || "-"} sudah diinput oleh ${user.user_name}`,
            }),
          });
        } catch {}
        setShowUploadModal(false); setSelectedItem(null); setUploadFile(null);
        await logActivity("PUT", `Uploaded tracking file for ID: ${selectedItem.id}`);
        fetchData();
      } else { showMessage("Gagal upload file", "error"); }
    } catch { showMessage("Gagal upload file", "error"); }
    finally { setSubmitting(false); }
  };

  const buildWhatsappLink = (item: TrackingItem) => {
    const store = storeAddresses.find((s) => s.store_location === item.sender);
    if (!store || !store.phone_number) return null;
    const phone = store.phone_number.replace(/\D/g, "");
    const message = encodeURIComponent(`Berikut resi untuk ${item.id}\n${item.link_tracking}`);
    return `https://wa.me/${phone}?text=${message}`;
  };

  const getStatus = (item: TrackingItem) => item.link_tracking ? "completed" : "pending";

  // Search filter — unchanged from original.
  const searchFilteredData = (() => {
    if (!searchReceiver.trim()) return data;
    const q = searchReceiver.trim().toLowerCase();
    return data.filter((d) =>
      (d.receiver || "").toLowerCase().includes(q) ||
      (d.tracking_number || "").toLowerCase().includes(q) ||
      (d.sales_order || "").toLowerCase().includes(q)
    );
  })();

  // Status filter pills — additive UI-only filter layered on top of search.
  const filteredData = (() => {
    if (statusFilter === "all") return searchFilteredData;
    return searchFilteredData.filter((d) => getStatus(d) === statusFilter);
  })();

  const hasActiveSearch = searchReceiver.trim().length > 0;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text || "-";
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(i, i + query.length)}</mark>
        {text.slice(i + query.length)}
      </>
    );
  };

  // Manual refresh button — calls the exact same fetchData(), just tracks a
  // local spinner state so the toolbar can show feedback.
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Client-side CSV export of the currently filtered dataset. No new API
  // endpoint — just serializes what's already loaded in `data`/`filteredData`.
  const handleExport = () => {
    const headers = [
      "ID", "Tanggal", "Assigned To", "Ekspedisi", "Pengirim", "Penerima", "Berat (kg)",
      "Tipe", "Sales Order", "Alasan", "No. Resi", "Status", "Request By", "Update By",
    ];
    const escapeCsv = (val: string) => `"${(val || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const rows = filteredData.map((d) => [
      d.id, d.date, d.assigned_to, d.expedition, d.sender, d.receiver, d.weight,
      d.type_reason || "", d.sales_order || "", d.reason, d.tracking_number || "",
      getStatus(d) === "completed" ? "Selesai" : "Pending", d.request_by, d.update_by || "",
    ].map(escapeCsv));
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-shipment-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  const canEdit = user.request_tracking;
  const canUpload = user.tracking_edit;

  // ── Shared form fields for type_reason + sales_order ──────────────────
  const renderTypeReasonFields = (
    f: typeof form,
    setF: (v: typeof form) => void,
    soErr: string,
    setSoErr: (v: string) => void,
  ) => (
    <div className="grid grid-cols-2 gap-4 items-start">
      <div>
        <FieldLabel required>Tipe Pengiriman</FieldLabel>
        <select
          value={f.type_reason}
          onChange={(e) => { setF({ ...f, type_reason: e.target.value, sales_order: "" }); setSoErr(""); }}
          className={inputClass()}
        >
          <option value="">Pilih tipe</option>
          {TYPE_REASONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {REQUIRES_SALES_ORDER.includes(f.type_reason) && (
        <div>
          <FieldLabel required>No. Sales Order</FieldLabel>
          <input
            type="text"
            value={f.sales_order}
            onChange={(e) => { setF({ ...f, sales_order: e.target.value }); setSoErr(""); }}
            onBlur={() => setSoErr(validateSalesOrder(f.type_reason, f.sales_order))}
            placeholder="#12345 / MAT-MR... / MAT-STE..."
            className={inputClass(!!soErr)}
          />
          <FieldHint error={soErr} hint="Format: #angka, MAT-MR..., atau MAT-STE..." />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
        {/* ── Section header ──────────────────────────────────────────── */}
        <SectionHeader
          icon={Truck}
          title="Request Shipment"
          actions={
            canEdit ? (
              <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                Add Request
              </Button>
            ) : undefined
          }
        />

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="mt-5 flex gap-1 border-b border-gray-200">
          {([
            { key: "table" as const, label: "List", icon: List },
            { key: "tracking" as const, label: "Cek Resi", icon: MapPinned },
          ]).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Table ───────────────────────────────────────────────── */}
        {activeTab === "table" && (
          <div className="mt-4 space-y-4">
            <Toolbar
              searchValue={searchReceiver}
              onSearchChange={(v) => { setSearchReceiver(v); setCurrentPage(1); }}
              resultCount={filteredData.length}
              showResultCount={hasActiveSearch || statusFilter !== "all"}
              statusFilter={statusFilter}
              onStatusFilterChange={(s) => { setStatusFilter(s); setCurrentPage(1); }}
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onExport={filteredData.length > 0 ? handleExport : undefined}
            />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              {loading ? (
                <TableSkeletonRows />
              ) : filteredData.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title={hasActiveSearch || statusFilter !== "all" ? "Tidak ada hasil yang cocok" : "Belum ada request shipment"}
                  description={
                    hasActiveSearch || statusFilter !== "all"
                      ? "Coba ubah kata kunci pencarian atau filter status."
                      : "Mulai dengan membuat request shipment pertama Anda."
                  }
                  action={
                    canEdit && !hasActiveSearch && statusFilter === "all" ? (
                      <Button icon={Plus} size="sm" onClick={() => setShowAddModal(true)}>
                        Add Request
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ShipmentTable
                    items={currentItems}
                    canEdit={canEdit}
                    canUpload={canUpload}
                    currentUserName={user.user_name}
                    copiedId={copiedId}
                    hasActiveSearch={hasActiveSearch}
                    searchQuery={searchReceiver}
                    onRowClick={setDetailItem}
                    onCopy={handleCopyReceiver}
                    onCheckResi={handleCheckResi}
                    onToggleProcessed={handleToggleProcessed}
                    onUpload={openUpload}
                    onEdit={openEdit}
                    onDelete={requestDelete}
                    getStatus={getStatus}
                    buildWhatsappLink={buildWhatsappLink}
                    highlightText={highlightText}
                  />
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    rangeLabel={`${indexOfFirst + 1}–${Math.min(indexOfLast, filteredData.length)} dari ${filteredData.length} entri`}
                  />
                </>
              )}
            </motion.div>
          </div>
        )}

        {/* ── Tab: Cek Resi ────────────────────────────────────────────── */}
        {activeTab === "tracking" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            style={{ height: "calc(100vh - 220px)" }}
          >
            <div style={{ width: "142.86%", height: "142.86%", transform: "scale(0.7)", transformOrigin: "top left" }}>
              <iframe
                ref={iframeRef}
                key={iframeUrl}
                src={iframeUrl}
                className="w-full"
                style={{ height: "calc((100vh - 220px) / 0.7)" }}
                title="Tracking Pengiriman"
                onLoad={handleIframeLoad}
              />
            </div>
          </motion.div>
        )}

        {/* Detail Popup */}
        {detailItem && (
          <DetailPopup item={detailItem} onClose={() => setDetailItem(null)} copiedId={copiedId} onCopy={handleCopyReceiver} />
        )}

        {/* Delete confirmation (replaces window.confirm — same delete behavior) */}
        <ConfirmationDialog
          open={!!deleteTarget}
          title="Hapus request ini?"
          description={deleteTarget ? `Request ${deleteTarget.id} untuk ${deleteTarget.assigned_to} akan dihapus permanen.` : undefined}
          confirmLabel="Hapus"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Add Modal */}
        <Modal
          open={showAddModal}
          onClose={() => { setShowAddModal(false); resetAddForm(); }}
          icon={Plus}
          title="Request Shipment Baru"
          description="Isi semua field yang ditandai *"
          footer={
            <>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => { setShowAddModal(false); resetAddForm(); }}>
                Batal
              </Button>
              <Button className="flex-1 justify-center" onClick={handleAdd} loading={submitting}>
                {submitting ? "Menyimpan..." : "Submit Request"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Tanggal</FieldLabel>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={inputClass()} />
              </div>
              <div>
                <FieldLabel required>Assigned To</FieldLabel>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className={inputClass()}>
                  <option value="">Pilih assignee</option>
                  {dropdownData.assignees.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <FieldLabel required>Ekspedisi</FieldLabel>
              <div className="flex gap-3">
                {EXPEDITIONS.map((exp) => {
                  const isSelected = form.expedition === exp;
                  return (
                    <button key={exp} type="button" onClick={() => setForm({ ...form, expedition: exp })}
                      className={`flex-1 flex items-center justify-center py-2.5 px-4 rounded-lg border-2 transition-all duration-200 ${
                        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-white"}`}>
                      <img src={EXPEDITION_LOGO[exp]} alt={exp} className="h-7 w-auto object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>

            <FormDivider />

            <div>
              <FieldLabel required>Pengirim (Store)</FieldLabel>
              <select value={form.sender} onChange={(e) => handleSenderChange(e.target.value)}
                className={inputClass()}>
                <option value="">Pilih store pengirim</option>
                {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
              </select>
              {selectedSenderDetails && (
                <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-700 space-y-0.5">
                  <p>{selectedSenderDetails.phone_number}</p>
                  <p>{selectedSenderDetails.address}</p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel required>Penerima</FieldLabel>
                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  <button type="button"
                    onClick={() => { setAddReceiverMode("dropdown"); setForm({ ...form, receiver: "" }); setAddReceiverStore(""); }}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${addReceiverMode === "dropdown" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    Store
                  </button>
                  <button type="button"
                    onClick={() => { setAddReceiverMode("custom"); setAddReceiverStore(""); setForm({ ...form, receiver: "" }); }}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${addReceiverMode === "custom" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    Custom
                  </button>
                </div>
              </div>
              {addReceiverMode === "dropdown" ? (
                <select value={addReceiverStore} onChange={(e) => handleReceiverStoreChange(e.target.value, false)}
                  className={inputClass()}>
                  <option value="">Pilih store penerima</option>
                  {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
                </select>
              ) : (
                <div>
                  <textarea value={form.receiver}
                    onChange={(e) => { setForm({ ...form, receiver: e.target.value.slice(0, 200) }); setReceiverError(""); }}
                    onBlur={() => setReceiverError(validateReceiver(form.receiver))}
                    rows={4}
                    placeholder={"Nama Penerima\n08xxxxxxxxxx\nJl. Contoh No. 1, Kota, Provinsi\n12345"}
                    maxLength={200}
                    className={`${inputClass(!!receiverError)} resize-none font-mono`} />
                  <div className="flex items-center justify-between mt-1">
                    <FieldHint error={receiverError} hint="Nama · HP (08xx/+628xx) · alamat · kode pos 5 digit" />
                    <p className={`text-[11px] tabular-nums shrink-0 ml-2 ${
                      form.receiver.length >= 200 ? "text-red-500 font-semibold" : form.receiver.length >= 180 ? "text-yellow-500" : "text-gray-400"}`}>
                      {form.receiver.length}/200
                    </p>
                  </div>
                </div>
              )}
            </div>

            <FormDivider />

            <div className="grid grid-cols-[80px_1fr] gap-4 items-start">
              <div>
                <FieldLabel required>Berat (kg)</FieldLabel>
                <input type="number" min="1" step="1" value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="1"
                  className={inputClass()} />
              </div>
              <div>
                <FieldLabel required>Alasan / Keterangan</FieldLabel>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2}
                  placeholder="Misal: Order WAG, Retur barang rusak..."
                  className={`${inputClass()} resize-none`} />
              </div>
            </div>

            {renderTypeReasonFields(form, setForm, salesOrderError, setSalesOrderError)}
          </div>
        </Modal>

        {/* Edit Modal */}
        {selectedItem && (
          <Modal
            open={showEditModal}
            onClose={() => { setShowEditModal(false); setSelectedItem(null); setReceiverError(""); setEditSalesOrderError(""); }}
            icon={Plus}
            title="Edit Request Shipment"
            description={<><span className="font-mono">{selectedItem.id}</span> · {selectedItem.request_by}</>}
            footer={
              <>
                <Button
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => { setShowEditModal(false); setSelectedItem(null); setReceiverError(""); setEditSalesOrderError(""); }}
                >
                  Batal
                </Button>
                <Button className="flex-1 justify-center" onClick={handleEdit} loading={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </>
            }
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Tanggal</FieldLabel>
                  <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className={inputClass()} />
                </div>
                <div>
                  <FieldLabel>Assigned To</FieldLabel>
                  <select value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                    className={inputClass()}>
                    <option value="">Pilih assignee</option>
                    {dropdownData.assignees.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <FieldLabel>Ekspedisi</FieldLabel>
                <div className="flex gap-3">
                  {EXPEDITIONS.map((exp) => {
                    const isSelected = editForm.expedition === exp;
                    return (
                      <button key={exp} type="button" onClick={() => setEditForm({ ...editForm, expedition: exp })}
                        className={`flex-1 flex items-center justify-center py-2.5 px-4 rounded-lg border-2 transition-all duration-200 ${
                          isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-white"}`}>
                        <img src={EXPEDITION_LOGO[exp]} alt={exp} className="h-7 w-auto object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormDivider />

              <div>
                <FieldLabel>Pengirim (Store)</FieldLabel>
                <select value={editForm.sender} onChange={(e) => handleSenderChange(e.target.value, true)}
                  className={inputClass()}>
                  <option value="">Pilih store pengirim</option>
                  {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
                </select>
                {editSenderDetails && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-700 space-y-0.5">
                    <p>{editSenderDetails.phone_number}</p>
                    <p>{editSenderDetails.address}</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel>Penerima</FieldLabel>
                  <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                    <button type="button"
                      onClick={() => { setEditReceiverMode("dropdown"); setEditForm({ ...editForm, receiver: "" }); setEditReceiverStore(""); }}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${editReceiverMode === "dropdown" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      Store
                    </button>
                    <button type="button"
                      onClick={() => { setEditReceiverMode("custom"); setEditReceiverStore(""); setEditForm({ ...editForm, receiver: "" }); }}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${editReceiverMode === "custom" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      Custom
                    </button>
                  </div>
                </div>
                {editReceiverMode === "dropdown" ? (
                  <select value={editReceiverStore} onChange={(e) => handleReceiverStoreChange(e.target.value, true)}
                    className={inputClass()}>
                    <option value="">Pilih store penerima</option>
                    {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
                  </select>
                ) : (
                  <div>
                    <textarea value={editForm.receiver}
                      onChange={(e) => { setEditForm({ ...editForm, receiver: e.target.value.slice(0, 200) }); setReceiverError(""); }}
                      onBlur={() => setReceiverError(validateReceiver(editForm.receiver))}
                      rows={4}
                      placeholder={"Nama Penerima\n08xxxxxxxxxx\nJl. Contoh No. 1, Kota, Provinsi\n12345"}
                      maxLength={200}
                      className={`${inputClass(!!receiverError)} resize-none font-mono`} />
                    <div className="flex items-center justify-between mt-1">
                      <FieldHint error={receiverError} hint="Nama · HP (08xx/+628xx) · alamat · kode pos 5 digit" />
                      <p className={`text-[11px] tabular-nums shrink-0 ml-2 ${
                        editForm.receiver.length >= 200 ? "text-red-500 font-semibold" : editForm.receiver.length >= 180 ? "text-yellow-500" : "text-gray-400"}`}>
                        {editForm.receiver.length}/200
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <FormDivider />

              <div className="grid grid-cols-[80px_1fr] gap-4 items-start">
                <div>
                  <FieldLabel>Berat (kg)</FieldLabel>
                  <input type="number" min="1" step="1" value={editForm.weight}
                    onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                    className={inputClass()} />
                </div>
                <div>
                  <FieldLabel>Alasan / Keterangan</FieldLabel>
                  <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} rows={2}
                    placeholder="Misal: Order WAG, Retur barang rusak..."
                    className={`${inputClass()} resize-none`} />
                </div>
              </div>

              {renderTypeReasonFields(editForm, setEditForm, editSalesOrderError, setEditSalesOrderError)}
            </div>
          </Modal>
        )}

        {/* Upload Modal */}
        {selectedItem && (
          <Modal
            open={showUploadModal}
            onClose={() => { setShowUploadModal(false); setSelectedItem(null); setUploadFile(null); }}
            title="Upload Resi"
            maxWidth="max-w-sm"
            footer={
              <>
                <Button
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => { setShowUploadModal(false); setSelectedItem(null); setUploadFile(null); }}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 justify-center bg-green-600 border-green-600 hover:bg-green-700"
                  onClick={handleUpload}
                  disabled={!uploadFile}
                  loading={submitting}
                >
                  {submitting ? "Mengupload..." : "Upload"}
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[11px]">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-gray-800 truncate">{selectedItem.id}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600 truncate">{selectedItem.assigned_to}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <ExpeditionBadge expedition={selectedItem.expedition} />
                    <span className="text-gray-400">·</span>
                    <span className="truncate">{selectedItem.sender}</span>
                    <span className="text-gray-400">·</span>
                    <span>{selectedItem.weight} kg</span>
                  </div>
                  {selectedItem.type_reason && (
                    <div className="flex items-center gap-1.5">
                      <TypeReasonBadge typeReason={selectedItem.type_reason} />
                      {selectedItem.sales_order && (
                        <span className="font-mono text-[11px] text-gray-600">{selectedItem.sales_order}</span>
                      )}
                    </div>
                  )}
                </div>
                <CopyButton text={selectedItem.receiver} id={`upload-${selectedItem.id}`} copiedId={copiedId} onCopy={handleCopyReceiver} />
              </div>

              <div className="px-2.5 py-2 bg-blue-50 border border-blue-100 rounded-xl text-[11px] font-mono text-blue-800 whitespace-pre-line leading-relaxed">
                {selectedItem.receiver}
              </div>

              <div className="flex items-start gap-1.5 p-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-[11px] text-yellow-800">
                <span>Nomor resi akan terbaca otomatis dari file yang diupload</span>
              </div>

              <div>
                <FieldLabel>File Resi / Bukti</FieldLabel>
                <DropZone file={uploadFile} onFile={setUploadFile} inputRef={uploadFileRef} />
              </div>
            </div>
          </Modal>
        )}

        <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
      </div>
    </div>
  );
}
