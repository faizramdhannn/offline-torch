"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Popup from "@/components/Popup";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";
import { Button } from "@/components/shared/Button";
import { Jastiper } from "@/types";
import { Plus, Pencil, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useSortableTable } from "@/hooks/useSortableTable";
import { SortableTh } from "@/components/shared/SortableTh";
import { ImportJastiperCsvModal } from "@/components/jastiper/ImportJastiperCsvModal";
import { SocialMediaIcon } from "@/components/jastiper/SocialMediaIcon";
import { SOCIAL_MEDIA_OPTIONS } from "@/lib/jastiper";

// Sama dengan STORE_LIST di app/api/jastiper/route.ts — dipakai untuk
// dropdown toko di form Add/Edit saat user HQ (tidak match toko manapun).
const STORE_LIST = [
  "Cirebon",
  "Jogja",
  "Karawaci",
  "Karawang",
  "Lampung",
  "Lembong",
  "Makassar",
  "Malang",
  "Margonda",
  "Medan",
  "Pekalongan",
  "Purwokerto",
  "Surabaya",
  "Tambun",
];

const RESPOND_OPTIONS = ["Interested", "Done Approach", "On Followup", "Joined Group", "Canceled"];
const STATUS_OPTIONS = ["Active", "Inactive"];

function storeAbbrev(store: string) {
  return (store || "").trim().slice(0, 3).toUpperCase();
}
function normalizePhonePreview(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
function suggestCode(store: string, phone: string) {
  const abbrev = storeAbbrev(store);
  const last2 = normalizePhonePreview(phone).slice(-2);
  if (!abbrev || !last2) return "";
  return `JS${abbrev}${last2}`;
}

const emptyForm = {
  uuid: "",
  jastiper_name: "",
  jastiper_phone_number: "",
  jastiper_respond: "",
  jastiper_store: "",
  jastiper_code: "",
  jastiper_status: "Active",
  notes: "",
  social_media: "",
  social_media_username: "",
};

function NotesCell({
  item,
  onSave,
}: {
  item: Jastiper;
  onSave: (uuid: string, notes: string) => void;
}) {
  const [value, setValue] = useState(item.notes || "");
  useEffect(() => {
    setValue(item.notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.uuid, item.notes]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (item.notes || "")) onSave(item.uuid, value);
      }}
      placeholder="Tulis catatan..."
      className="w-full min-w-[140px] rounded border border-transparent px-1.5 py-1 text-[11px] hover:border-gray-200 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

export default function JastiperPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<Jastiper[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const { ref: searchRef, shortcutLabel } = useSearchShortcut();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [storeFilter, setStoreFilter] = useState(searchParams.get("store") ?? "");
  const [respondFilter, setRespondFilter] = useState(searchParams.get("respond") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [form, setForm] = useState(emptyForm);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.jastiper) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (storeFilter) params.set("store", storeFilter);
    if (respondFilter) params.set("respond", respondFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchQuery, storeFilter, respondFilter, statusFilter, pathname, router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, storeFilter, respondFilter, statusFilter]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ username: user.user_name });
      if (searchQuery) params.set("q", searchQuery);
      if (storeFilter) params.set("store", storeFilter);
      if (respondFilter) params.set("respond", respondFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/jastiper?${params.toString()}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Failed to fetch");
      setIsOwner(!!result.isOwner);
      setStoreName(result.storeName || "");
      setItems(result.data || []);
      setStores(result.stores || []);
    } catch (error) {
      showMessage("Gagal mengambil data jastiper", "error");
    } finally {
      setLoading(false);
    }
  };

  // Refetch dari server tiap filter berubah (dataset per toko relatif kecil,
  // filter di server sekalian membatasi akses per toko).
  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, storeFilter, respondFilter, statusFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setStoreFilter("");
    setRespondFilter("");
    setStatusFilter("");
  };

  const openAdd = () => {
    setForm({ ...emptyForm, jastiper_store: isOwner ? storeName : "" });
    setCodeManuallyEdited(false);
    setShowAddModal(true);
  };

  const openEdit = (item: Jastiper) => {
    setForm({
      uuid: item.uuid,
      jastiper_name: item.jastiper_name,
      jastiper_phone_number: item.jastiper_phone_number,
      jastiper_respond: item.jastiper_respond,
      jastiper_store: item.jastiper_store,
      jastiper_code: item.jastiper_code,
      jastiper_status: item.jastiper_status || "Active",
      notes: item.notes || "",
      social_media: item.social_media || "",
      social_media_username: item.social_media_username || "",
    });
    setCodeManuallyEdited(true); // kode existing dianggap sudah final, tidak auto-overwrite saat edit
    setShowEditModal(true);
  };

  // Auto-suggest kode tiap toko/HP berubah, kecuali user sudah pernah edit
  // manual kolom kodenya sendiri.
  useEffect(() => {
    if (codeManuallyEdited) return;
    setForm((p) => ({ ...p, jastiper_code: suggestCode(p.jastiper_store, p.jastiper_phone_number) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.jastiper_store, form.jastiper_phone_number]);

  const handleCreate = async () => {
    if (!form.jastiper_name.trim() || !form.jastiper_store.trim()) {
      showMessage("Nama jastiper dan toko wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jastiper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, created_by: user?.user_name }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Gagal menambah jastiper");
      showMessage("Jastiper berhasil ditambahkan", "success");
      setShowAddModal(false);
      setForm(emptyForm);
      fetchData();
    } catch (error: any) {
      showMessage(error?.message || "Gagal menambahkan jastiper", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!form.jastiper_name.trim() || !form.jastiper_store.trim()) {
      showMessage("Nama jastiper dan toko wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jastiper", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, update_by: user?.user_name }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Gagal update jastiper");
      showMessage("Jastiper berhasil diperbarui", "success");
      setShowEditModal(false);
      setForm(emptyForm);
      fetchData();
    } catch (error: any) {
      showMessage(error?.message || "Gagal memperbarui jastiper", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleNotesSave = async (uuid: string, notes: string) => {
    setItems((prev) => prev.map((it) => (it.uuid === uuid ? { ...it, notes } : it)));
    try {
      const res = await fetch("/api/jastiper", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, notes, update_by: user?.user_name }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showMessage("Gagal menyimpan notes", "error");
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("created_by", user?.user_name || "");
      const res = await fetch("/api/jastiper/import", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Gagal import");
      showMessage(`Import selesai: ${result.inserted} baru, ${result.skipped} dilewati (sudah ada)`, "success");
      setShowImportModal(false);
      fetchData();
    } catch (error: any) {
      showMessage(error?.message || "Gagal import data", "error");
    } finally {
      setImporting(false);
    }
  };

  const { sorted: sortedData, sortKey, sortDir, toggleSort } = useSortableTable(items, "jastiper_name");

  // Export XLSX untuk baris yang lagi ditampilkan (sesuai filter/sort aktif),
  // bukan seluruh tabel — hanya untuk user yang punya akses setting.
  const handleExport = () => {
    const rows = sortedData.map((item) => ({
      "Nama Jastiper": item.jastiper_name,
      "Sosial Media": item.social_media,
      Username: item.social_media_username,
      "No HP": item.jastiper_phone_number,
      Toko: item.jastiper_store,
      "Kode Jastiper": item.jastiper_code,
      Respond: item.jastiper_respond,
      Status: item.jastiper_status,
      Notes: item.notes,
      "Total Order": item.total_order,
      "Total Value": item.total_value,
      "Dibuat Oleh": item.created_by,
      "Dibuat Pada": item.created_at,
      "Update Oleh": item.update_by,
      "Update Pada": item.update_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jastiper");
    XLSX.writeFile(wb, `jastiper_export_${Date.now()}.xlsx`);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4">
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary">Jastiper</h1>
                <p className="text-xs text-gray-500">
                  {isOwner ? `Menampilkan jastiper toko ${storeName}` : "Menampilkan jastiper semua toko"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!!user.user_setting && (
                  <Button variant="secondary" icon={Download} onClick={handleExport}>
                    Export
                  </Button>
                )}
                <Button variant="secondary" icon={Upload} onClick={() => setShowImportModal(true)}>
                  Import CSV
                </Button>
                <Button icon={Plus} onClick={openAdd}>
                  Add Jastiper
                </Button>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-white p-3 shadow">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, no HP, atau kode jastiper..."
                    className="w-full rounded border border-gray-300 px-2 py-1.5 pr-11 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <SearchShortcutHint label={shortcutLabel} />
                </div>
                {!isOwner && (
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="w-32 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">Semua toko</option>
                    {stores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={respondFilter}
                  onChange={(e) => setRespondFilter(e.target.value)}
                  className="w-36 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Semua respond</option>
                  {RESPOND_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-32 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Semua status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg bg-white shadow">
              {loading ? (
                <div className="p-8 text-center">Loading...</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="border-b bg-gray-100">
                        <tr>
                          <SortableTh label="Nama" active={sortKey === "jastiper_name"} dir={sortDir} onClick={() => toggleSort("jastiper_name")} className="px-2 py-1.5 font-semibold text-gray-700" />
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Sosial Media</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Username</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">No HP</th>
                          <SortableTh label="Toko" active={sortKey === "jastiper_store"} dir={sortDir} onClick={() => toggleSort("jastiper_store")} className="px-2 py-1.5 text-center font-semibold text-gray-700" />
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Kode</th>
                          <SortableTh label="Respond" active={sortKey === "jastiper_respond"} dir={sortDir} onClick={() => toggleSort("jastiper_respond")} className="px-2 py-1.5 text-center font-semibold text-gray-700" />
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Status</th>
                          <SortableTh label="Total Order" active={sortKey === "total_order"} dir={sortDir} onClick={() => toggleSort("total_order")} className="px-2 py-1.5 text-center font-semibold text-gray-700" />
                          <SortableTh label="Total Value" active={sortKey === "total_value"} dir={sortDir} onClick={() => toggleSort("total_value")} className="px-2 py-1.5 text-center font-semibold text-gray-700" />
                          <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Notes</th>
                          <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((item) => (
                          <tr key={item.uuid} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-1 font-medium">{item.jastiper_name}</td>
                            <td className="px-2 py-1 text-center">
                              {item.social_media ? (
                                <span className="inline-flex items-center justify-center">
                                  <SocialMediaIcon platform={item.social_media} size={14} />
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-2 py-1 text-center">{item.social_media_username || "-"}</td>
                            <td className="px-2 py-1 text-center">{item.jastiper_phone_number || "-"}</td>
                            <td className="px-2 py-1 text-center">{item.jastiper_store}</td>
                            <td className="px-2 py-1 text-center font-mono text-[10px] text-gray-500">{item.jastiper_code || "-"}</td>
                            <td className="px-2 py-1 text-center">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  item.jastiper_respond === "Canceled"
                                    ? "bg-red-100 text-red-700"
                                    : item.jastiper_respond === "Joined Group"
                                    ? "bg-green-100 text-green-700"
                                    : item.jastiper_respond === "Done Approach"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.jastiper_respond === "On Followup"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.jastiper_respond || "-"}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  item.jastiper_status === "Inactive" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"
                                }`}
                              >
                                {item.jastiper_status || "-"}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-center">{item.total_order}</td>
                            <td className="px-2 py-1 text-center font-medium">{item.total_value_formatted}</td>
                            <td className="px-1 py-1">
                              <NotesCell item={item} onSave={handleNotesSave} />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button onClick={() => openEdit(item)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {items.length === 0 && <div className="p-8 text-center text-gray-500">Belum ada data jastiper</div>}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <div className="text-xs text-gray-600">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, sortedData.length)} of {sortedData.length} entries
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {[...Array(totalPages)].map((_, i) => {
                          const page = i + 1;
                          if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`rounded border px-3 py-1 text-xs ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-2">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

        {showImportModal && (
          <ImportJastiperCsvModal onClose={() => setShowImportModal(false)} onImport={handleImport} importing={importing} />
        )}

        {/* ── Add / Edit Modal ── */}
        {(showAddModal || showEditModal) && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
            onClick={() => (showAddModal ? setShowAddModal(false) : setShowEditModal(false))}
          >
            <div className="w-full max-w-md rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-4 text-lg font-semibold">{showAddModal ? "Add Jastiper" : "Edit Jastiper"}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Nama Jastiper</label>
                  <input
                    type="text"
                    value={form.jastiper_name}
                    onChange={(e) => setForm((p) => ({ ...p, jastiper_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Sosial Media</label>
                    <select
                      value={form.social_media}
                      onChange={(e) => setForm((p) => ({ ...p, social_media: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Pilih platform...</option>
                      {SOCIAL_MEDIA_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Username</label>
                    <input
                      type="text"
                      value={form.social_media_username}
                      onChange={(e) => setForm((p) => ({ ...p, social_media_username: e.target.value }))}
                      placeholder="@username"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">No HP</label>
                  <input
                    type="text"
                    value={form.jastiper_phone_number}
                    onChange={(e) => setForm((p) => ({ ...p, jastiper_phone_number: e.target.value }))}
                    placeholder="mis. 0851-7711-4215"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Toko</label>
                  {isOwner ? (
                    <input type="text" value={form.jastiper_store} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
                  ) : (
                    <select
                      value={form.jastiper_store}
                      onChange={(e) => setForm((p) => ({ ...p, jastiper_store: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Pilih toko...</option>
                      {STORE_LIST.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500">Kode Jastiper</label>
                  <input
                    type="text"
                    value={form.jastiper_code}
                    onChange={(e) => {
                      setCodeManuallyEdited(true);
                      setForm((p) => ({ ...p, jastiper_code: e.target.value.toUpperCase() }));
                    }}
                    placeholder="Auto: JS + toko + 2 digit HP"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">
                    Kode ini yang ditulis staff toko di kolom Notes Shopify saat checkout — dipakai untuk hitung kontribusi.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Respond</label>
                  <select
                    value={form.jastiper_respond}
                    onChange={(e) => setForm((p) => ({ ...p, jastiper_respond: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Pilih respond...</option>
                    {RESPOND_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <select
                    value={form.jastiper_status}
                    onChange={(e) => setForm((p) => ({ ...p, jastiper_status: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Catatan bebas, mis. alasan Canceled..."
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => (showAddModal ? setShowAddModal(false) : setShowEditModal(false))}>
                  Batal
                </Button>
                <Button onClick={showAddModal ? handleCreate : handleSaveEdit} loading={saving}>
                  Simpan
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
