"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import SearchableSelect from "@/components/SearchableSelect";
import { Button } from "@/components/shared/Button";
import { Plus, Pencil, Trash2, Check, X, Mail, Camera, Upload, Image as ImageIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EDItem {
  id: string;
  name: string;
  assigned_to: string; // disimpan di sheet sebagai user_name
  user_name: string;
  taft_by: string;
  item_sku: string;
  item_name: string;
  item_qty: string;
  discount_code: string;
  status_request: string;
  type_reason: string;
  sales_order: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  link_drive: string;
}

interface MasterItem {
  SKU: string;
  Product_name: string;
  HPJ: string;
  [key: string]: string;
}

interface AssignedToOption {
  id: string;
  label: string; // label === user_name
}

interface DropdownData {
  discount_code: string[];
  assigned_to: AssignedToOption[];
}

interface PickedItem {
  sku: string;
  name: string;
  qty: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toCapitalEachWord(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function generateId(): string {
  return `ED-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function parseCreatedAt(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(",", "").replace(/\./g, ":");
  const t = new Date(cleaned).getTime();
  return isNaN(t) ? 0 : t;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ value }: { value: string }) {
  const cls =
    value === "Approved"
      ? "bg-green-100 text-green-800"
      : value === "Rejected"
      ? "bg-red-100 text-red-800"
      : "bg-[#FFEB3B] text-amber-800";

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-block ${cls}`}>
      {value || "Need Approval"}
    </span>
  );
}

// ─── Item picker section (tanpa scanner — cukup SearchableSelect + qty) ───────
function ItemPickerSection({
  masterItems,
  pickedItems,
  onItemsChange,
}: {
  masterItems: MasterItem[];
  pickedItems: PickedItem[];
  onItemsChange: (items: PickedItem[]) => void;
}) {
  const [selectedSku, setSelectedSku] = useState("");
  const [qty, setQty] = useState(1);

  const itemOptions = masterItems.map((m) => ({
    value: m.SKU,
    label: `${m.SKU} - ${toCapitalEachWord(m.Product_name || "")}`,
  }));

  const handleAdd = () => {
    if (!selectedSku) return;
    const found = masterItems.find((m) => m.SKU === selectedSku);
    const name = found ? toCapitalEachWord(found.Product_name || "") : "";
    const existing = pickedItems.find((i) => i.sku === selectedSku);
    if (existing) {
      onItemsChange(
        pickedItems.map((i) => (i.sku === selectedSku ? { ...i, qty: i.qty + qty } : i))
      );
    } else {
      onItemsChange([...pickedItems, { sku: selectedSku, name, qty }]);
    }
    setSelectedSku("");
    setQty(1);
  };

  const removeItem = (sku: string) => onItemsChange(pickedItems.filter((i) => i.sku !== sku));
  const adjustQty = (sku: string, delta: number) =>
    onItemsChange(pickedItems.map((i) => (i.sku === sku ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500">
        Item <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={itemOptions}
            value={selectedSku}
            onChange={setSelectedSku}
            placeholder="-- Pilih Item --"
          />
        </div>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={!selectedSku}>
          Tambah
        </Button>
      </div>

      {pickedItems.length > 0 && (
        <div className="space-y-1.5">
          {pickedItems.map((item) => (
            <div key={item.sku} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{item.sku}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => adjustQty(item.sku, -1)}
                  className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-xs font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-bold text-gray-800">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => adjustQty(item.sku, 1)}
                  className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-xs font-bold"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.sku)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Upload foto: kamera atau pilih file — hasil disimpan sebagai link_drive ──
function PhotoUploadSection({
  userName,
  value,
  uploading,
  onUploadStart,
  onUploaded,
  onError,
}: {
  userName: string;
  value: string;
  uploading: boolean;
  onUploadStart: () => void;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const cameraInputId = `ed-photo-camera-${userName}`;
  const fileInputId = `ed-photo-file-${userName}`;

  const doUpload = async (file: File) => {
    onUploadStart();
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userName", userName);
      const res = await fetch("/api/employee-discount/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const j = await res.json();
      onUploaded(j.url || "");
    } catch {
      onError("Gagal upload foto");
    }
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // supaya bisa pilih file yang sama lagi
    if (file) doUpload(file);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500">Foto / Link Drive (opsional)</label>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          id={cameraInputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePick}
        />
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePick}
        />
        <label
          htmlFor={cameraInputId}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs cursor-pointer hover:bg-gray-50 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Camera className="w-3.5 h-3.5" /> Ambil Foto
        </label>
        <label
          htmlFor={fileInputId}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs cursor-pointer hover:bg-gray-50 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload Foto
        </label>
        {uploading && <span className="text-[11px] text-gray-400">Mengupload...</span>}
      </div>
      {value && !uploading && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
        >
          <ImageIcon className="w-3 h-3" /> Lihat foto yang sudah diupload
        </a>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function EmployeeDiscountPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<EDItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [dropdownData, setDropdownData] = useState<DropdownData>({ discount_code: [], assigned_to: [] });
  const [taftOptions, setTaftOptions] = useState<string[]>([]);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<EDItem | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    assigned_to: "", // id dropdown
    taft_by: "",
    discount_code: "",
    type_reason: "",
    sales_order: "",
    link_drive: "",
    items: [] as PickedItem[],
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [uploadingAdd, setUploadingAdd] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  // ── assigned_to mapping helpers (id ↔ user_name) ────────────────────────────
  const getUserNameById = useCallback(
    (id: string): string => dropdownData.assigned_to.find((a) => a.id === id)?.label || id,
    [dropdownData.assigned_to]
  );
  const getIdByUserName = useCallback(
    (userName: string): string => dropdownData.assigned_to.find((a) => a.label === userName)?.id || "",
    [dropdownData.assigned_to]
  );

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.employee_discount && !u.employee_discount_approval) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchData();
    fetchMasterItems();
    fetchDropdowns();
    fetchTaftOptions();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortOrder, search]);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/employee-discount?userName=${encodeURIComponent(user?.user_name || "")}&isAll=${!!user?.employee_discount_approval}`
      );
      if (res.ok) {
        const rows: EDItem[] = await res.json();
        setData(rows.filter((r) => r.id));
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const fetchMasterItems = async () => {
    try {
      const res = await fetch("/api/master-item?mode=invoice");
      if (res.ok) setMasterItems(await res.json());
    } catch {}
  };

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/employee-discount?resource=dropdown");
      if (res.ok) setDropdownData(await res.json());
    } catch {}
  };

  const fetchTaftOptions = async () => {
    try {
      const res = await fetch(`/api/employee-discount?resource=taft&userName=${encodeURIComponent(user?.user_name || "")}`);
      if (res.ok) {
        const j = await res.json();
        setTaftOptions(j.taftsForStore || []);
      }
    } catch {}
  };

  // ── Buka draft email Gmail — dipicu manual lewat tombol di kolom Aksi ──────
  // `mailto:` bergantung pada aplikasi mail default OS (belum tentu Gmail,
  // dan sering tidak ke-setup sama sekali di browser/OS user sehingga klik
  // terasa "tidak terjadi apa-apa"). Supaya PASTI pindah ke Gmail, pakai URL
  // compose Gmail langsung (dibuka di tab baru), bukan skema mailto:.
  const openDiscountEmailDraft = (groupId: string) => {
    const groupItems = data.filter((d) => d.id === groupId);
    if (groupItems.length === 0) return;
    const meta = groupItems[0];

    const to = "odi@torch.id,faizramdhan17@gmail.com";
    const requesterName = toCapitalEachWord(meta.name || "");
    const taftBy = meta.taft_by || requesterName;
    const subject = `Pengajuan Employee Discount - ${taftBy}`;
    const itemLines = groupItems.map((it, idx) => `${idx + 1}. ${it.item_sku}: ${it.item_name} - ${it.item_qty}`);
    const body = [
      `Saya ${taftBy} dari ${requesterName},`,
      `ingin mengajukan discount ${meta.discount_code} untuk item berikut`,
      "",
      ...itemLines,
      "",
      `dengan tujuan, ${meta.type_reason}`,
      "",
      "terimakasih",
      "",
      "Best Regard,",
      taftBy,
    ].join("\n");

    const gmailUrl =
      `https://mail.google.com/mail/?view=cm&fs=1&tf=1` +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (form.items.length === 0 || !form.discount_code) {
      showMessage("Minimal 1 item dan discount code wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const sharedId = generateId();
      const assignedToUserName = form.assigned_to ? getUserNameById(form.assigned_to) : "";

      const payload = form.items.map((it) => ({
        id: sharedId,
        name: user.name,
        user_name: user.user_name,
        assigned_to: assignedToUserName,
        taft_by: form.taft_by,
        item_sku: it.sku,
        item_name: it.name,
        item_qty: String(it.qty),
        discount_code: form.discount_code,
        status_request: "Need Approval",
        type_reason: form.type_reason,
        sales_order: form.sales_order,
        link_drive: form.link_drive,
        created_by: user.user_name,
        update_by: "",
      }));

      const res = await fetch("/api/employee-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showMessage("Request berhasil dibuat", "success");
      setShowAddModal(false);
      setForm(emptyForm);
      fetchData();
    } catch {
      showMessage("Gagal membuat request", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (groupId: string) => {
    const groupItems = data.filter((d) => d.id === groupId);
    if (groupItems.length === 0) return;
    const meta = groupItems[0];
    setSelectedGroupId(groupId);
    setEditForm({
      assigned_to: meta.assigned_to ? getIdByUserName(meta.assigned_to) : "",
      taft_by: meta.taft_by || "",
      discount_code: meta.discount_code || "",
      type_reason: meta.type_reason || "",
      sales_order: meta.sales_order || "",
      link_drive: meta.link_drive || "",
      items: groupItems.map((g) => ({
        sku: g.item_sku || "",
        name: g.item_name || "",
        qty: Number(g.item_qty) || 1,
      })),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedGroupId) return;
    if (editForm.items.length === 0) {
      showMessage("Minimal 1 item harus ada", "error");
      return;
    }
    setSaving(true);
    try {
      const assignedToUserName = editForm.assigned_to ? getUserNameById(editForm.assigned_to) : "";
      const res = await fetch("/api/employee-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedGroupId,
          update_by: user.user_name,
          mode: "group-items",
          items: editForm.items.map((it) => ({
            item_sku: it.sku,
            item_name: it.name,
            item_qty: String(it.qty),
          })),
          assigned_to: assignedToUserName,
          taft_by: editForm.taft_by,
          discount_code: editForm.discount_code,
          type_reason: editForm.type_reason,
          sales_order: editForm.sales_order,
          link_drive: editForm.link_drive,
        }),
      });
      if (!res.ok) throw new Error();
      showMessage("Request berhasil diperbarui", "success");
      setShowEditModal(false);
      setSelectedGroupId(null);
      fetchData();
    } catch {
      showMessage("Gagal memperbarui request", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employee-discount?id=${encodeURIComponent(showDeleteConfirm.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      showMessage("Request berhasil dihapus", "success");
      setShowDeleteConfirm(null);
      fetchData();
    } catch {
      showMessage("Gagal menghapus request", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Approve / Reject (berlaku untuk seluruh group) ──────────────────────────
  const handleApproveReject = async (groupId: string, status: "Approved" | "Rejected") => {
    setSaving(true);
    try {
      const res = await fetch("/api/employee-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: groupId,
          update_by: user.user_name,
          mode: "approve",
          status_request: status,
        }),
      });
      if (!res.ok) throw new Error();
      showMessage(`Request ${status === "Approved" ? "disetujui" : "ditolak"}`, "success");
      fetchData();
    } catch {
      showMessage("Gagal memperbarui status", "error");
    } finally {
      setSaving(false);
    }
  };

  const assignedToOptions = dropdownData.assigned_to.map((a) => ({ value: a.id, label: a.label }));

  // ── Group data by id ─────────────────────────────────────────────────────────
  const getGroupItems = (groupId: string): EDItem[] => data.filter((d) => d.id === groupId);
  const getGroupedRows = (rows: EDItem[]): EDItem[] => {
    const seen = new Set<string>();
    return rows.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  };

  // ── Filter / sort / paginate ─────────────────────────────────────────────────
  const filtered = data.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.item_sku || "").toLowerCase().includes(q) ||
      (r.item_name || "").toLowerCase().includes(q) ||
      (r.assigned_to || "").toLowerCase().includes(q) ||
      (r.taft_by || "").toLowerCase().includes(q) ||
      (r.sales_order || "").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const tA = parseCreatedAt(a.created_at);
    const tB = parseCreatedAt(b.created_at);
    return sortOrder === "newest" ? tB - tA : tA - tB;
  });

  const groupedRows = getGroupedRows(sorted);
  const totalPages = Math.max(1, Math.ceil(groupedRows.length / itemsPerPage));
  const paged = groupedRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const canCreate = !!user?.employee_discount || !!user?.employee_discount_approval;
  const canEditOwn = !!user?.employee_discount;
  const canApprove = !!user?.employee_discount_approval;

  if (!user) return null;

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Employee Discount</h1>
          <p className="text-xs text-gray-500">Pengajuan diskon karyawan</p>
        </div>
        {canCreate && (
          <Button icon={Plus} onClick={() => { setForm(emptyForm); setShowAddModal(true); }}>
            Buat Request
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <input
          type="text"
          placeholder="Cari nama / SKU / item / assigned / taft / SO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-[11px] w-64"
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
          className="border border-gray-200 rounded-lg px-2 py-1 text-[11px]"
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[70px]"><span className="text-[8px] uppercase tracking-wide">Tanggal</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[70px]"><span className="text-[8px] uppercase tracking-wide">Store/Name</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[70px]"><span className="text-[8px] uppercase tracking-wide">Assigned To</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[70px]"><span className="text-[8px] uppercase tracking-wide">Taft By</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[260px]"><span className="text-[8px] uppercase tracking-wide">Item</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[45px]"><span className="text-[8px] uppercase tracking-wide">Total Qty</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[90px]"><span className="text-[8px] uppercase tracking-wide">Discount Code</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[140px]"><span className="text-[8px] uppercase tracking-wide">Type Reason</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[90px]"><span className="text-[8px] uppercase tracking-wide">Sales Order</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[45px]"><span className="text-[8px] uppercase tracking-wide">Foto</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold border-r border-gray-200 w-[80px]"><span className="text-[8px] uppercase tracking-wide">Status</span></th>
                <th className="px-1.5 py-1.5 text-center font-semibold w-[60px]"><span className="text-[8px] uppercase tracking-wide">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="text-center py-6 text-gray-400">Memuat data...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-6 text-gray-400">Tidak ada data</td></tr>
              ) : (
                paged.map((item) => {
                  const groupItems = getGroupItems(item.id);
                  const totalQty = groupItems.reduce((sum, g) => sum + Number(g.item_qty || 0), 0);
                  // Pemilik request (employee_discount) hanya bisa edit/delete miliknya
                  // sendiri, tapi user dengan employee_discount_approval bisa edit/delete
                  // request SIAPA PUN, bukan cuma approve/reject.
                  const isOwner = (item.created_by === user.user_name && canEditOwn) || canApprove;
                  const showApprove = canApprove && item.status_request !== "Approved" && item.status_request !== "Rejected";
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 whitespace-nowrap truncate">{item.created_at?.split(",")[0]}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 truncate">{item.name}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 truncate">{item.assigned_to || "-"}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 truncate">{item.taft_by || "-"}</td>
                      <td className="px-1.5 py-1.5 border-r border-gray-200 truncate" title={groupItems.map((g) => `${g.item_sku} - ${g.item_name} (${g.item_qty})`).join(", ")}>
                        {groupItems.map((g) => g.item_name).join(", ")}
                      </td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200">{totalQty}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 truncate">{item.discount_code}</td>
                      <td className="px-1.5 py-1.5 border-r border-gray-200 truncate">{item.type_reason}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200 truncate">{item.sales_order || "-"}</td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200">
                        {item.link_drive ? (
                          <a href={item.link_drive} target="_blank" rel="noreferrer" title="Lihat foto" className="inline-flex text-blue-600 hover:text-blue-800">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 text-center border-r border-gray-200">
                        <StatusBadge value={item.status_request} />
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {canCreate && (
                            <button
                              onClick={() => openDiscountEmailDraft(item.id)}
                              className="p-1 rounded hover:bg-blue-50 text-blue-600"
                              title="Kirim email (buka Gmail)"
                            >
                              <Mail className="w-3 h-3" />
                            </button>
                          )}
                          {isOwner && (
                            <>
                              <button
                                onClick={() => openEdit(item.id)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                                title="Edit"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(item)}
                                className="p-1 rounded hover:bg-red-50 text-red-500"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {showApprove && (
                            <>
                              <button
                                onClick={() => handleApproveReject(item.id, "Approved")}
                                className="p-1 rounded hover:bg-green-50 text-green-600"
                                title="Approve"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleApproveReject(item.id, "Rejected")}
                                className="p-1 rounded hover:bg-red-50 text-red-600"
                                title="Reject"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3 text-xs">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Buat Request Discount</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Assigned To</label>
                <SearchableSelect
                  options={assignedToOptions}
                  value={form.assigned_to}
                  onChange={(v) => setForm((p) => ({ ...p, assigned_to: v }))}
                  placeholder="-- Pilih Assigned To --"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Taft By</label>
                <select
                  value={form.taft_by}
                  onChange={(e) => setForm((p) => ({ ...p, taft_by: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Taft --</option>
                  {taftOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <ItemPickerSection
                masterItems={masterItems}
                pickedItems={form.items}
                onItemsChange={(items) => setForm((p) => ({ ...p, items }))}
              />

              <div>
                <label className="text-xs text-gray-500">Discount Code</label>
                <select
                  value={form.discount_code}
                  onChange={(e) => setForm((p) => ({ ...p, discount_code: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Discount Code --</option>
                  {dropdownData.discount_code.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Type Reason</label>
                <input
                  type="text"
                  value={form.type_reason}
                  onChange={(e) => setForm((p) => ({ ...p, type_reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Alasan diskon"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Sales Order (opsional)</label>
                <input
                  type="text"
                  value={form.sales_order}
                  onChange={(e) => setForm((p) => ({ ...p, sales_order: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <PhotoUploadSection
                userName={user.user_name}
                value={form.link_drive}
                uploading={uploadingAdd}
                onUploadStart={() => setUploadingAdd(true)}
                onUploaded={(url) => { setUploadingAdd(false); setForm((p) => ({ ...p, link_drive: url })); }}
                onError={(msg) => { setUploadingAdd(false); showMessage(msg, "error"); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
              <Button onClick={handleCreate} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && selectedGroupId && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Edit Request Discount</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Assigned To</label>
                <SearchableSelect
                  options={assignedToOptions}
                  value={editForm.assigned_to}
                  onChange={(v) => setEditForm((p) => ({ ...p, assigned_to: v }))}
                  placeholder="-- Pilih Assigned To --"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Taft By</label>
                <select
                  value={editForm.taft_by}
                  onChange={(e) => setEditForm((p) => ({ ...p, taft_by: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Taft --</option>
                  {taftOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <ItemPickerSection
                masterItems={masterItems}
                pickedItems={editForm.items}
                onItemsChange={(items) => setEditForm((p) => ({ ...p, items }))}
              />

              <div>
                <label className="text-xs text-gray-500">Discount Code</label>
                <select
                  value={editForm.discount_code}
                  onChange={(e) => setEditForm((p) => ({ ...p, discount_code: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Discount Code --</option>
                  {dropdownData.discount_code.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Type Reason</label>
                <input
                  type="text"
                  value={editForm.type_reason}
                  onChange={(e) => setEditForm((p) => ({ ...p, type_reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Sales Order (opsional)</label>
                <input
                  type="text"
                  value={editForm.sales_order}
                  onChange={(e) => setEditForm((p) => ({ ...p, sales_order: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <PhotoUploadSection
                userName={user.user_name}
                value={editForm.link_drive}
                uploading={uploadingEdit}
                onUploadStart={() => setUploadingEdit(true)}
                onUploaded={(url) => { setUploadingEdit(false); setEditForm((p) => ({ ...p, link_drive: url })); }}
                onError={(msg) => { setUploadingEdit(false); showMessage(msg, "error"); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Batal</Button>
              <Button onClick={handleSaveEdit} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Hapus Request?</h2>
            <p className="text-sm text-gray-500 mb-5">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
