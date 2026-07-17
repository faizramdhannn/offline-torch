"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { Button } from "@/components/shared/Button";
import { useDailyJobRemaining } from "@/hooks/useDailyJobRemaining";
import { jakartaDateKeyFromCreatedAt, todayJakartaKey } from "@/lib/dailyJobDate";
import { Plus, Pencil, Trash2, Image as ImageIcon, Camera, Upload, Clock, Bell } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Shared implementation for the 3 near-identical Daily Job error-report CRUD
// pages (delivery-note, sales-order, stock-entry). The 3 sheets are 12
// columns each, identical shape, differing only by field-name suffix — this
// component is parametrized by those field names so the 3 page.tsx files
// stay thin wrappers (matching lib/dailyJobReports.ts's backend factory
// pattern).
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorReportRow {
  id: string;
  created_at: string;
  update_at: string;
  taft_by: string;
  role_taft: string;
  name: string;
  [key: string]: string;
}

export interface ErrorReportPageConfig {
  /** e.g. "delivery_note" | "sales_order" | "stock_entry" */
  remainingKey: "delivery_note" | "sales_order" | "stock_entry";
  endpoint: string; // e.g. /api/daily-job/delivery-note
  title: string;
  errorFieldLabel: string; // e.g. "Nomor Sales Order terkait error"
  errorField: string;
  categoryField: string;
  notesField: string;
  imageUrlField: string;
  solvedField: string;
  dropdownCategoryKey: string; // key in /api/daily-job/dropdown response
  dropdownSolvedKey: string;
}


function toJakartaTimestamp(): string {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "Asia/Jakarta",
  });
}

interface FormState {
  taftBy: string;
  errorValue: string;
  category: string;
  notes: string;
  solved: string;
  solvedAt: string;
  file: File | null;
}

const emptyForm: FormState = { taftBy: "", errorValue: "", category: "", notes: "", solved: "", solvedAt: "", file: null };

export default function ErrorReportPage({ config }: { config: ErrorReportPageConfig }) {
  const router = useRouter();
  useSessionGuard();

  const {
    remainingKey, endpoint, title, errorFieldLabel,
    errorField, categoryField, notesField, imageUrlField, solvedField,
    dropdownCategoryKey, dropdownSolvedKey,
  } = config;

  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<ErrorReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [solvedOptions, setSolvedOptions] = useState<string[]>([]);
  const [taftOptions, setTaftOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ErrorReportRow | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ErrorReportRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const remaining = useDailyJobRemaining(user?.user_name, user?.name);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.daily_checklist && !u.daily_checklist_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-job/dropdown");
      if (res.ok) {
        const j = await res.json();
        setCategoryOptions(j[dropdownCategoryKey] || []);
        setSolvedOptions(j[dropdownSolvedKey] || []);
      }
    } catch {}
  }, [dropdownCategoryKey, dropdownSolvedKey]);

  // Taft By: sama konsep seperti Employee Discount/Daily Checklist — dipilih
  // dari daftar taft toko ini, BUKAN otomatis = user.user_name. Penting supaya
  // hitungan "sudah diisi hari ini" (useDailyJobRemaining) match dengan cara
  // backend meresolusi taft_by (lihat lib/dailyJobReports.ts).
  const fetchTaftOptions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/employee-discount?resource=taft&userName=${encodeURIComponent(user.user_name || "")}`);
      if (res.ok) {
        const j = await res.json();
        setTaftOptions(j.taftsForStore || []);
      }
    } catch {}
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?userName=${encodeURIComponent(user.user_name)}&name=${encodeURIComponent(user.name || "")}`, { cache: "no-store" });
      if (res.ok) setRows(await res.json());
    } catch {
      showMessage("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  }, [user, endpoint]);

  useEffect(() => {
    if (!user) return;
    fetchDropdowns();
    fetchTaftOptions();
    fetchData();
  }, [user, fetchDropdowns, fetchTaftOptions, fetchData]);

  const canEdit = !!user?.daily_checklist;

  const todayRows = rows.filter((r) => jakartaDateKeyFromCreatedAt(r.created_at) === todayJakartaKey());
  const displayedRows = showHistory ? rows : todayRows;

  const buildFormData = (existingId?: string) => {
    const fd = new FormData();
    if (existingId) fd.append("id", existingId);
    fd.append("taft_by", form.taftBy);
    fd.append("name", user.name);
    fd.append("role_taft", user.role_taft || "");
    fd.append(errorField, form.errorValue);
    fd.append(categoryField, form.category);
    fd.append(notesField, form.notes);
    if (form.solved) fd.append(solvedField, form.solved);
    if (form.solvedAt) fd.append("solved_at", form.solvedAt);
    if (form.file) fd.append("file", form.file);
    return fd;
  };

  const handleCreate = async () => {
    if (!form.taftBy) {
      showMessage("Taft By wajib dipilih", "error");
      return;
    }
    if (!form.errorValue.trim()) {
      showMessage("Field error wajib diisi", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(endpoint, { method: "POST", body: buildFormData() });
      if (!res.ok) throw new Error();
      showMessage("Laporan berhasil dibuat", "success");
      setShowAddModal(false);
      setForm(emptyForm);
      await fetchData();
      remaining.refresh();
    } catch {
      showMessage("Gagal membuat laporan", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ErrorReportRow) => {
    setEditingRow(row);
    setForm({
      taftBy: row.taft_by || "",
      errorValue: row[errorField] || "",
      category: row[categoryField] || "",
      notes: row[notesField] || "",
      solved: row[solvedField] || "",
      solvedAt: row.solved_at || "",
      file: null,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, { method: "PUT", body: buildFormData(editingRow.id) });
      if (!res.ok) throw new Error();
      showMessage("Laporan berhasil diperbarui", "success");
      setShowEditModal(false);
      setEditingRow(null);
      await fetchData();
      remaining.refresh();
    } catch {
      showMessage("Gagal memperbarui laporan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setSaving(true);
    try {
      const res = await fetch(`${endpoint}?id=${encodeURIComponent(showDeleteConfirm.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showMessage("Laporan berhasil dihapus", "success");
      setShowDeleteConfirm(null);
      await fetchData();
      remaining.refresh();
    } catch {
      showMessage("Gagal menghapus laporan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    setForm((p) => ({ ...p, file }));
  };

  const remainingForType = remaining[remainingKey];
  const filledToday = todayRows.length;
  const totalTarget = filledToday + remainingForType;

  if (!user) return null;

  return (
    <div className="p-3 md:p-4 max-w-[1200px] mx-auto">
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

      {/* Pemberitahuan gaya notifikasi — hanya muncul DI HALAMAN INI, kalau
          report jenis ini sendiri masih punya sisa error yang harus diisi. */}
      {!remaining.loading && remainingForType > 0 && (
        <div className="mb-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Lengkapi <span className="font-semibold">{remainingForType} laporan {title}</span> hari ini sesuai jumlah error yang tercatat di Daily Checklist.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          <p className="text-xs text-gray-500">
            {filledToday} dari {totalTarget} error sudah diinput hari ini
            {remainingForType > 0 && (
              <span className="ml-2 text-amber-600 font-semibold">({remainingForType} tersisa)</span>
            )}
          </p>
        </div>
        {canEdit && (
          <Button icon={Plus} onClick={() => { setForm(emptyForm); setShowAddModal(true); }}>
            Tambah Laporan
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          Tampilkan semua riwayat (bukan hanya hari ini)
        </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="px-2 py-2 text-left border-r border-gray-200">Tanggal</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">Taft By</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">{errorFieldLabel}</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">Kategori</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">Notes</th>
                <th className="px-2 py-2 text-center border-r border-gray-200">Foto</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">Solved</th>
                <th className="px-2 py-2 text-left border-r border-gray-200">Solved At</th>
                <th className="px-2 py-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-6 text-gray-400">Memuat data...</td></tr>
              ) : displayedRows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-6 text-gray-400">Tidak ada data</td></tr>
              ) : (
                displayedRows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2 border-r border-gray-200 whitespace-nowrap">{r.created_at?.split(",")[0]}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{r.taft_by || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{r[errorField] || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200">{r[categoryField] || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200 max-w-[220px] truncate" title={r[notesField]}>{r[notesField] || "-"}</td>
                    <td className="px-2 py-2 text-center border-r border-gray-200">
                      {r[imageUrlField] ? (
                        <a href={r[imageUrlField]} target="_blank" rel="noreferrer" className="inline-flex text-blue-600 hover:text-blue-800">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200">{r[solvedField] || "-"}</td>
                    <td className="px-2 py-2 border-r border-gray-200 whitespace-nowrap">{r.solved_at || "-"}</td>
                    <td className="px-2 py-2 text-center">
                      {canEdit && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(r)} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(r)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
        >
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{showEditModal ? "Edit" : "Tambah"} Laporan {title}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Taft By</label>
                <select
                  value={form.taftBy}
                  onChange={(e) => setForm((p) => ({ ...p, taftBy: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="">-- Pilih Taft --</option>
                  {taftOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">{errorFieldLabel}</label>
                <input
                  type="text"
                  value={form.errorValue}
                  onChange={(e) => setForm((p) => ({ ...p, errorValue: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500">Foto (opsional)</label>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <input id="err-photo-camera" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePick} />
                  <input id="err-photo-file" type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
                  <label htmlFor="err-photo-camera" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                    <Camera className="w-3.5 h-3.5" /> Ambil Foto
                  </label>
                  <label htmlFor="err-photo-file" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs cursor-pointer hover:bg-gray-50">
                    <Upload className="w-3.5 h-3.5" /> Upload Foto
                  </label>
                  {form.file && <span className="text-[11px] text-gray-500">{form.file.name}</span>}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500">Solved (opsional)</label>
                <select
                  value={form.solved}
                  onChange={(e) => setForm((p) => ({ ...p, solved: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="">-- Belum dipilih --</option>
                  {solvedOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500">Solved At (opsional)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={form.solvedAt}
                    onChange={(e) => setForm((p) => ({ ...p, solvedAt: e.target.value }))}
                    placeholder="Belum diisi"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Clock}
                    onClick={() => setForm((p) => ({ ...p, solvedAt: toJakartaTimestamp() }))}
                  >
                    Now
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Batal</Button>
              <Button onClick={showEditModal ? handleSaveEdit : handleCreate} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Hapus Laporan?</h2>
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
