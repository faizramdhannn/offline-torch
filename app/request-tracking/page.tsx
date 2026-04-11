"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
}

interface DropdownData {
  requesters: string[];
  assignees: string[];
  reasons: string[];
}

const EXPEDITIONS = ["SiCepat", "Lion"];

function formatStoreAddress(s: StoreAddress): string {
  return [s.store_location, s.phone_number, s.address].filter(Boolean).join("\n");
}

/**
 * Validasi nomor telepon Indonesia:
 * Prefix yang valid: +628, 628, 08, 8 (tanpa prefix)
 * Setelah prefix selalu diikuti angka 8 (untuk HP) atau bisa 2/3 (untuk beberapa provider)
 * Total digit keseluruhan: 10-14 digit
 *
 * Pattern yang diterima:
 *   +628xxxxxxxx   → +62 + 8 + 8-11 digit
 *    628xxxxxxxx   → 62 + 8 + 8-11 digit
 *     08xxxxxxxx   → 0 + 8 + 8-11 digit
 *      8xxxxxxxx   → 8 + 8-11 digit (tanpa prefix, harus diawali 8)
 *
 * Nomor yang TIDAK diterima:
 *   +6212345678  → setelah 62 bukan 8 (bukan HP)
 *   0212345678   → setelah 0 bukan 8 (nomor rumah)
 *   62blok8no12  → false positive dari teks biasa
 */
function isValidIndonesianPhone(phone: string): boolean {
  // Hapus semua spasi, strip, dan tanda kurung untuk normalisasi
  const cleaned = phone.replace(/[\s\-().]/g, "");

  // Pattern: +628 / 628 / 08 diikuti angka selanjutnya (8-11 digit)
  const withPrefixPattern = /^(\+?628|08)[0-9]{7,11}$/;

  // Pattern: 8 tanpa prefix (word boundary kiri/kanan agar tidak false positive)
  // Tidak dipakai di sini karena kita cek kata per kata
  const barePattern = /^8[0-9]{7,11}$/;

  return withPrefixPattern.test(cleaned) || barePattern.test(cleaned);
}

/**
 * Cari nomor telepon valid pertama dalam teks multiline receiver.
 * Ekstrak setiap "kata" yang terlihat seperti nomor dan validasi satu per satu.
 */
function extractValidPhone(text: string): string | null {
  // Pecah per token (spasi, newline, koma)
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
  if (!validPhone) {
    return "Sertakan nomor telepon yang valid (08xx, +628xx, atau 628xx)";
  }

  // Kode pos: 5 digit angka yang berdiri sendiri (tidak bagian dari nomor panjang)
  const postalPattern = /(?<![0-9])\d{5}(?![0-9])/;
  if (!postalPattern.test(val)) {
    return "Sertakan kode pos 5 digit (contoh: 40123)";
  }

  if (val.trim().length < 20) {
    return "Terlalu pendek — sertakan nama, nomor telepon, alamat, dan kode pos";
  }

  return "";
}

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
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [selectedSenderDetails, setSelectedSenderDetails] = useState<StoreAddress | null>(null);
  const [editSenderDetails, setEditSenderDetails] = useState<StoreAddress | null>(null);

  const [addReceiverMode, setAddReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [editReceiverMode, setEditReceiverMode] = useState<"dropdown" | "custom">("dropdown");
  const [addReceiverStore, setAddReceiverStore] = useState<string>("");
  const [editReceiverStore, setEditReceiverStore] = useState<string>("");

  const [receiverError, setReceiverError] = useState("");

  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    assigned_to: "",
    expedition: "",
    sender: "",
    receiver: "",
    weight: "",
    reason: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request_tracking && !parsedUser.tracking_edit) {
      router.push("/dashboard");
      return;
    }
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

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        username: user?.user_name || "",
        isTrackingEdit: String(!!user?.tracking_edit),
      });
      const res = await fetch(`/api/request-tracking?${params}`);
      if (res.ok) {
        setData(await res.json());
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
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
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
    if (isEdit) {
      setEditForm((prev) => ({ ...prev, sender: storeName }));
      setEditSenderDetails(found);
    } else {
      setForm((prev) => ({ ...prev, sender: storeName }));
      setSelectedSenderDetails(found);
    }
  };

  const handleReceiverStoreChange = (storeName: string, isEdit = false) => {
    const found = storeAddresses.find((s) => s.store_location === storeName) || null;
    const formatted = found ? formatStoreAddress(found) : "";
    if (isEdit) {
      setEditReceiverStore(storeName);
      setEditForm((prev) => ({ ...prev, receiver: formatted }));
    } else {
      setAddReceiverStore(storeName);
      setForm((prev) => ({ ...prev, receiver: formatted }));
    }
    setReceiverError("");
  };

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.date || !form.assigned_to || !form.expedition || !form.sender || !form.receiver || !form.weight || !form.reason) {
      showMessage("Semua field wajib diisi", "error");
      return;
    }
    const err = validateReceiver(form.receiver);
    if (err) { showMessage(err, "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, request_by: user.user_name }),
      });
      if (res.ok) {
        showMessage("Request berhasil dibuat", "success");
        setShowAddModal(false);
        resetAddForm();
        await logActivity("POST", `Created shipment request: ${form.expedition} → ${form.assigned_to}`);
        fetchData();
      } else {
        showMessage("Gagal membuat request", "error");
      }
    } catch {
      showMessage("Gagal membuat request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setForm(emptyForm);
    setSelectedSenderDetails(null);
    setAddReceiverMode("dropdown");
    setAddReceiverStore("");
    setReceiverError("");
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const openEdit = (item: TrackingItem) => {
    setSelectedItem(item);
    setEditForm({
      date: item.date,
      assigned_to: item.assigned_to,
      expedition: item.expedition,
      sender: item.sender,
      receiver: item.receiver,
      weight: item.weight,
      reason: item.reason,
    });
    setEditSenderDetails(storeAddresses.find((s) => s.store_location === item.sender) || null);

    const matchedStore = storeAddresses.find((s) => formatStoreAddress(s) === item.receiver);
    if (matchedStore) {
      setEditReceiverMode("dropdown");
      setEditReceiverStore(matchedStore.store_location);
    } else {
      setEditReceiverMode("custom");
      setEditReceiverStore("");
    }
    setReceiverError("");
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    const err = validateReceiver(editForm.receiver);
    if (err) { showMessage(err, "error"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/request-tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedItem.id, update_by: user.user_name, ...editForm }),
      });
      if (res.ok) {
        showMessage("Request berhasil diupdate", "success");
        setShowEditModal(false);
        setSelectedItem(null);
        await logActivity("PUT", `Updated shipment request ID: ${selectedItem.id}`);
        fetchData();
      } else {
        showMessage("Gagal update request", "error");
      }
    } catch {
      showMessage("Gagal update request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (item: TrackingItem) => {
    if (!confirm("Hapus request ini?")) return;
    try {
      const res = await fetch(`/api/request-tracking?id=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((d) => d.id !== item.id));
        showMessage("Request dihapus", "success");
        await logActivity("DELETE", `Deleted shipment request ID: ${item.id}`);
      } else {
        showMessage("Gagal menghapus", "error");
      }
    } catch {
      showMessage("Gagal menghapus", "error");
    }
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const openUpload = (item: TrackingItem) => {
    setSelectedItem(item);
    setUploadFile(null);
    if (uploadFileRef.current) uploadFileRef.current.value = "";
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!selectedItem || !uploadFile) {
      showMessage("Pilih file terlebih dahulu", "error");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("id", selectedItem.id);
      fd.append("update_by", user.user_name);
      fd.append("file", uploadFile);

      const res = await fetch("/api/request-tracking", { method: "PUT", body: fd });
      if (res.ok) {
        showMessage("File berhasil diupload", "success");
        setShowUploadModal(false);
        setSelectedItem(null);
        setUploadFile(null);
        await logActivity("PUT", `Uploaded tracking file for ID: ${selectedItem.id}`);
        fetchData();
      } else {
        showMessage("Gagal upload file", "error");
      }
    } catch {
      showMessage("Gagal upload file", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── WhatsApp link ─────────────────────────────────────────────────────────
  const buildWhatsappLink = (item: TrackingItem) => {
    const store = storeAddresses.find((s) => s.store_location === item.sender);
    if (!store || !store.phone_number) return null;
    const phone = store.phone_number.replace(/\D/g, "");
    const message = encodeURIComponent(`Berikut resi untuk ${item.id}\n${item.link_tracking}`);
    return `https://wa.me/${phone}?text=${message}`;
  };

  const getStatus = (item: TrackingItem) => item.link_tracking ? "completed" : "pending";

  // ── Pagination ────────────────────────────────────────────────────────────
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = data.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  if (!user) return null;

  const canEdit = user.request_tracking;
  const canUpload = user.tracking_edit;

  // ── Sub-components ────────────────────────────────────────────────────────

  const ExpeditionToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Ekspedisi <span className="text-red-500">*</span></label>
      <div className="flex gap-2">
        {EXPEDITIONS.map((exp) => (
          <button key={exp} type="button" onClick={() => onChange(exp)}
            className={`flex-1 py-2 rounded text-xs font-medium border transition-all ${
              value === exp
                ? exp === "SiCepat" ? "bg-red-500 border-red-500 text-white" : "bg-red-900 border-red-900 text-white"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}>
            {exp === "SiCepat" ? "SiCepat" : "Lion Parcel"}
          </button>
        ))}
      </div>
    </div>
  );

  const SenderSelect = ({ value, onChange, details }: { value: string; onChange: (v: string) => void; details: StoreAddress | null }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Pengirim (Store) <span className="text-red-500">*</span></label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="">Pilih store pengirim</option>
        {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
      </select>
      {details && (
        <div className="mt-1.5 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-800 space-y-0.5">
          <div>{details.phone_number}</div>
          <div>{details.address}</div>
        </div>
      )}
    </div>
  );

  const ReceiverField = ({
    mode, onModeChange,
    storeValue, onStoreChange,
    customValue, onCustomChange,
    error, onBlur,
  }: {
    mode: "dropdown" | "custom";
    onModeChange: (m: "dropdown" | "custom") => void;
    storeValue: string;
    onStoreChange: (v: string) => void;
    customValue: string;
    onCustomChange: (v: string) => void;
    error: string;
    onBlur: () => void;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">
          Penerima <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          <button type="button" onClick={() => { onModeChange("dropdown"); onCustomChange(""); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              mode === "dropdown" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            Store
          </button>
          <button type="button" onClick={() => { onModeChange("custom"); onStoreChange(""); onCustomChange(""); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
              mode === "custom" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            Custom
          </button>
        </div>
      </div>

      {mode === "dropdown" ? (
        <>
          <select value={storeValue} onChange={(e) => onStoreChange(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Pilih store penerima</option>
            {storeAddresses.map((s) => <option key={s.id} value={s.store_location}>{s.store_location}</option>)}
          </select>
          {customValue && (
            <div className="mt-1.5 p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-700 font-mono whitespace-pre-line">
              {customValue}
            </div>
          )}
        </>
      ) : (
        <>
          <textarea value={customValue} onChange={(e) => onCustomChange(e.target.value)} onBlur={onBlur}
            rows={4}
            placeholder={"Nama Penerima\n08xxxxxxxxxx\nJl. Contoh No. 1, Kota, Provinsi\n12345"}
            className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 resize-none font-mono ${
              error ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-primary"
            }`}
          />
          {error
            ? <p className="text-[10px] text-red-500 mt-1">⚠ {error}</p>
            : (
              <p className="text-[10px] text-gray-400 mt-1">
                Wajib: nama · nomor HP (08xx/+628xx) · alamat · kode pos 5 digit
              </p>
            )
          }
        </>
      )}
    </div>
  );

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      type="button"
      onClick={() => handleCopyReceiver(text, id)}
      title="Copy alamat penerima"
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors shrink-0"
    >
      {copiedId === id ? (
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-primary">Request Shipment</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {canUpload ? "Semua request" : "List Request Store"}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Request
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] table-fixed">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[88px]">Tanggal</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[90px]">Assigned To</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[75px]">Ekspedisi</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[100px]">Pengirim</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[160px]">Penerima</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[50px]">Berat</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[110px]">Alasan</th>
                        {canUpload && (
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[85px]">Request By</th>
                        )}
                        <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-[60px]">Status</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700 w-[130px]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, idx) => {
                        const status = getStatus(item);
                        const waLink = item.link_tracking ? buildWhatsappLink(item) : null;
                        return (
                          <tr key={item.id} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                            <td className="px-2 py-1 text-gray-600">{item.date}</td>
                            <td className="px-2 py-1 text-gray-700 truncate">{item.assigned_to}</td>
                            <td className="px-2 py-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                item.expedition === "SiCepat" ? "bg-red-100 text-red-800" : "bg-red-950/10 text-red-900"
                              }`}>
                                {item.expedition}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-gray-700 truncate">{item.sender}</td>
                            <td className="px-2 py-1 text-gray-600">
                              <div className="flex items-start gap-1">
                                <div className="truncate flex-1" title={item.receiver}>
                                  {item.receiver.split("\n")[0]}
                                </div>
                                {canUpload && item.receiver && (
                                  <CopyButton text={item.receiver} id={item.id} />
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-gray-600">{item.weight} kg</td>
                            <td className="px-2 py-1 text-gray-600 truncate" title={item.reason}>{item.reason}</td>
                            {canUpload && (
                              <td className="px-2 py-1 text-gray-500">{item.request_by}</td>
                            )}
                            <td className="px-2 py-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                              }`}>
                                {status === "completed" ? "Selesai" : "Pending"}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap gap-1">
                                {canUpload && status === "pending" && (
                                  <button onClick={() => openUpload(item)}
                                    className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">
                                    Upload
                                  </button>
                                )}
                                {status === "completed" && waLink && (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] hover:bg-green-600 inline-flex items-center gap-0.5">
                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    WA
                                  </a>
                                )}
                                {item.link_tracking && (
                                  <a href={item.link_tracking} target="_blank" rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px] hover:bg-gray-300">
                                    Resi
                                  </a>
                                )}
                                {canEdit && !canUpload && item.request_by === user.user_name && status === "pending" && (
                                  <>
                                    <button onClick={() => openEdit(item)}
                                      className="px-1.5 py-0.5 bg-yellow-500 text-white rounded text-[10px] hover:bg-yellow-600">
                                      Edit
                                    </button>
                                    <button onClick={() => handleDelete(item)}
                                      className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-600">
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {data.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">Belum ada request shipment</div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-2.5 border-t">
                    <div className="text-xs text-gray-500">
                      {indexOfFirst + 1}–{Math.min(indexOfLast, data.length)} dari {data.length} entri
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                          return (
                            <button key={page} onClick={() => setCurrentPage(page)}
                              className={`px-2.5 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-1 text-xs text-gray-400 self-center">…</span>;
                        }
                        return null;
                      })}
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-2.5 py-1 text-xs border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Request Shipment Baru</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To <span className="text-red-500">*</span></label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Pilih</option>
                  {dropdownData.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <ExpeditionToggle value={form.expedition} onChange={(v) => setForm({ ...form, expedition: v })} />
              <SenderSelect value={form.sender} onChange={(v) => handleSenderChange(v)} details={selectedSenderDetails} />
              <ReceiverField
                mode={addReceiverMode}
                onModeChange={(m) => setAddReceiverMode(m)}
                storeValue={addReceiverStore}
                onStoreChange={(v) => handleReceiverStoreChange(v, false)}
                customValue={form.receiver}
                onCustomChange={(v) => { setForm({ ...form, receiver: v }); setReceiverError(""); }}
                error={receiverError}
                onBlur={() => { if (addReceiverMode === "custom") setReceiverError(validateReceiver(form.receiver)); }}
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Berat (kg) <span className="text-red-500">*</span></label>
                <input type="number" min="0.1" step="0.1" value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="contoh: 1.5"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alasan / Keterangan <span className="text-red-500">*</span></label>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={2} placeholder="Misal: Order WAG, Retur barang rusak..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Batal</button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Edit Request Shipment</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                <select value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Pilih</option>
                  {dropdownData.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <ExpeditionToggle value={editForm.expedition} onChange={(v) => setEditForm({ ...editForm, expedition: v })} />
              <SenderSelect value={editForm.sender} onChange={(v) => handleSenderChange(v, true)} details={editSenderDetails} />
              <ReceiverField
                mode={editReceiverMode}
                onModeChange={(m) => setEditReceiverMode(m)}
                storeValue={editReceiverStore}
                onStoreChange={(v) => handleReceiverStoreChange(v, true)}
                customValue={editForm.receiver}
                onCustomChange={(v) => { setEditForm({ ...editForm, receiver: v }); setReceiverError(""); }}
                error={receiverError}
                onBlur={() => { if (editReceiverMode === "custom") setReceiverError(validateReceiver(editForm.receiver)); }}
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Berat (kg)</label>
                <input type="number" min="0.1" step="0.1" value={editForm.weight}
                  onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alasan</label>
                <textarea value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowEditModal(false); setSelectedItem(null); setReceiverError(""); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Batal</button>
              <button onClick={handleEdit} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ──────────────────────────────────────────────────── */}
      {showUploadModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-primary mb-3">Upload Resi / Bukti Pengiriman</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded border text-xs space-y-1">
              <div><span className="text-gray-500">ID:</span> <span className="font-mono font-medium">{selectedItem.id}</span></div>
              <div><span className="text-gray-500">Assigned To:</span> {selectedItem.assigned_to}</div>
              <div><span className="text-gray-500">Ekspedisi:</span> {selectedItem.expedition}</div>
              <div><span className="text-gray-500">Dari:</span> {selectedItem.sender}</div>
              <div className="flex items-start gap-1">
                <span className="text-gray-500 shrink-0">Penerima:</span>
                <span className="font-mono whitespace-pre-line flex-1">{selectedItem.receiver}</span>
                <CopyButton text={selectedItem.receiver} id={`upload-${selectedItem.id}`} />
              </div>
              <div><span className="text-gray-500">Berat:</span> {selectedItem.weight} kg</div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">File Resi / Bukti</label>
              <input ref={uploadFileRef} type="file" accept="image/*,.pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90" />
              {uploadFile && (
                <p className="text-[10px] text-green-600 mt-1.5">✓ {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowUploadModal(false); setSelectedItem(null); setUploadFile(null); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Batal</button>
              <button onClick={handleUpload} disabled={submitting || !uploadFile}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                {submitting ? "Mengupload..." : "Upload & Selesaikan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}