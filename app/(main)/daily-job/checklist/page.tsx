"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { Button } from "@/components/shared/Button";
import { Pagination } from "@/components/shared/Pagination";
import { Pencil, Trash2, Save, X, Plus, Eye, Check } from "lucide-react";
import { jakartaDateKeyFromCreatedAt, todayJakartaKey } from "@/lib/dailyJobDate";

interface ChecklistRow {
  id: string;
  created_at: string;
  update_at: string;
  taft_by: string;
  role_taft: string;
  name: string;
  checklist_opening: string;
  checklist_operational: string;
  checklist_closing: string;
}

// Item checklist per kategori sekarang dinamis (dari master_dropdown, lihat
// /api/daily-job/dropdown), BUKAN daftar hardcoded — supaya nambah/hapus
// item cukup edit master_dropdown, tanpa ubah kode.
const CATEGORIES = [
  { key: "checklist_opening", label: "Opening Store" },
  { key: "checklist_operational", label: "Operational Store" },
  { key: "checklist_closing", label: "Closing Store" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface DropdownData {
  role_taft: string[];
  checklist_opening: string[];
  checklist_operational: string[];
  checklist_closing: string[];
}

const CATEGORY_TO_DROPDOWN_KEY: Record<CategoryKey, keyof DropdownData> = {
  checklist_opening: "checklist_opening",
  checklist_operational: "checklist_operational",
  checklist_closing: "checklist_closing",
};

// "Item A,Item B" -> ["Item A", "Item B"]
function parseItems(str: string | undefined | null): string[] {
  if (!str) return [];
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}
function joinItems(items: string[]): string {
  return items.join(",");
}

interface FormState {
  taft_by: string;
  role_taft: string;
  checklist_opening: string[];
  checklist_operational: string[];
  checklist_closing: string[];
}

const emptyForm = (): FormState => ({
  taft_by: "",
  role_taft: "",
  checklist_opening: [],
  checklist_operational: [],
  checklist_closing: [],
});

function rowToForm(row: ChecklistRow): FormState {
  return {
    taft_by: row.taft_by || "",
    role_taft: row.role_taft || "",
    checklist_opening: parseItems(row.checklist_opening),
    checklist_operational: parseItems(row.checklist_operational),
    checklist_closing: parseItems(row.checklist_closing),
  };
}

// "n selesai dari m" — m = jumlah item yang SAAT INI ada di master_dropdown,
// n = irisan dengan item yang tersimpan di baris ini (item yang sudah
// dihapus dari master_dropdown tidak ikut dihitung lagi).
function countDone(storedCsv: string, currentItems: string[]): { done: number; total: number } {
  const stored = new Set(parseItems(storedCsv));
  const done = currentItems.filter((i) => stored.has(i)).length;
  return { done, total: currentItems.length };
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs text-gray-700 font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${
          checked ? "bg-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

const ITEMS_PER_PAGE = 10;

export default function DailyChecklistPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<ChecklistRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    role_taft: [], checklist_opening: [], checklist_operational: [], checklist_closing: [],
  });
  const [taftOptions, setTaftOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistRow | null>(null);
  const [detailRow, setDetailRow] = useState<ChecklistRow | null>(null);

  // Filter tanggal riwayat sendiri.
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

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
      if (res.ok) setDropdowns(await res.json());
    } catch {}
  }, []);

  // Taft By: sama konsepnya seperti Employee Discount — resolve dari
  // master_traffic berdasarkan toko akun yang login (bukan free text).
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

  // Halaman ini SELALU cuma riwayat toko sendiri — untuk lihat SEMUA toko,
  // user dengan akses daily_checklist_all pakai menu terpisah "Daily Job
  // Report" (app/(main)/daily-job/report/page.tsx).
  const fetchRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const url = `/api/daily-job/checklist?all=true&userName=${encodeURIComponent(user.user_name || "")}&name=${encodeURIComponent(user.name || "")}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) setRows(await res.json());
    } catch {
      showMessage("Gagal memuat data checklist", "error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchDropdowns();
    fetchTaftOptions();
    fetchRows();
  }, [user, fetchDropdowns, fetchTaftOptions, fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [filterFrom, filterTo]);

  const canEdit = !!user?.daily_checklist;

  const categoryItems = (key: CategoryKey): string[] => dropdowns[CATEGORY_TO_DROPDOWN_KEY[key]] || [];

  // Baris milik toko sendiri untuk hari ini — dipakai untuk tombol "Isi Hari
  // Ini" (edit kalau sudah ada, buat baru kalau belum).
  const todayKey = todayJakartaKey();
  const todayRow = rows.find((r) => jakartaDateKeyFromCreatedAt(r.created_at) === todayKey) || null;

  const openAddToday = () => {
    setEditingRow(todayRow);
    setForm(todayRow ? rowToForm(todayRow) : emptyForm());
    setShowForm(true);
  };

  const openEdit = (row: ChecklistRow) => {
    setEditingRow(row);
    setForm(rowToForm(row));
    setShowForm(true);
  };

  const toggleItem = (key: CategoryKey, item: string, checked: boolean) => {
    setForm((p) => {
      const current = p[key];
      const next = checked ? [...current, item] : current.filter((i) => i !== item);
      return { ...p, [key]: next };
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.taft_by) {
      showMessage("Taft By wajib dipilih", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        id: editingRow?.id,
        taft_by: form.taft_by,
        name: user.name,
        role_taft: form.role_taft,
        checklist_opening: joinItems(form.checklist_opening),
        checklist_operational: joinItems(form.checklist_operational),
        checklist_closing: joinItems(form.checklist_closing),
      };

      const res = await fetch("/api/daily-job/checklist", {
        method: editingRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showMessage(editingRow ? "Checklist berhasil diperbarui" : "Checklist berhasil dibuat", "success");
      setShowForm(false);
      await fetchRows();
    } catch {
      showMessage("Gagal menyimpan checklist", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/daily-job/checklist?id=${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showMessage("Checklist berhasil dihapus", "success");
      setDeleteTarget(null);
      await fetchRows();
    } catch {
      showMessage("Gagal menghapus checklist", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const filteredRows = rows.filter((r) => {
    const dateKey = jakartaDateKeyFromCreatedAt(r.created_at);
    if (filterFrom && (!dateKey || dateKey < filterFrom)) return false;
    if (filterTo && (!dateKey || dateKey > filterTo)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paged = filteredRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const colCount = 4 + CATEGORIES.length;

  return (
    <div className="p-3 md:p-4 max-w-full mx-auto">
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Daily Job</h1>
          <p className="text-xs text-gray-500">Checklist harian toko — {user.name}</p>
        </div>
        {canEdit && (
          <Button icon={Plus} size="sm" onClick={openAddToday}>
            {todayRow ? "Edit Checklist Hari Ini" : "Isi Checklist Hari Ini"}
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-3 mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
          />
        </div>
        {(filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterFrom(""); setFilterTo(""); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Reset Filter
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[160px]">Tanggal</th>
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[160px]">Taft By</th>
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[110px]">Role</th>
                {CATEGORIES.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 text-center border-r border-gray-200 whitespace-nowrap min-w-[150px]">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center whitespace-nowrap min-w-[120px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="text-center py-6 text-gray-400">Memuat data...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={colCount} className="text-center py-6 text-gray-400">Belum ada data</td></tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 border-r border-gray-200 whitespace-nowrap">{r.created_at}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 whitespace-nowrap">{r.taft_by || "-"}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 whitespace-nowrap">{r.role_taft || "-"}</td>
                    {CATEGORIES.map((c) => {
                      const { done, total } = countDone(r[c.key], categoryItems(c.key));
                      return (
                        <td key={c.key} className="px-4 py-2.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            total > 0 && done === total ? "bg-green-100 text-green-700" : done === 0 ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                          }`}>
                            {done}/{total}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => setDetailRow(r)} title="Lihat detail" className="p-1 rounded hover:bg-gray-200 text-gray-500">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(r)} title="Edit" className="p-1 rounded hover:bg-gray-200 text-gray-500">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(r)} title="Hapus" className="p-1 rounded hover:bg-red-100 text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rangeLabel={`${filteredRows.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}-${Math.min(page * ITEMS_PER_PAGE, filteredRows.length)} dari ${filteredRows.length}`}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-800">
              {editingRow ? "Edit Checklist" : "Isi Checklist Hari Ini"}
            </h2>

            <div>
              <label className="text-xs text-gray-500">Taft By</label>
              <select
                value={form.taft_by}
                onChange={(e) => setForm((p) => ({ ...p, taft_by: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">-- Pilih Taft --</option>
                {taftOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Role Taft</label>
              <select
                value={form.role_taft}
                onChange={(e) => setForm((p) => ({ ...p, role_taft: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">-- Pilih Role --</option>
                {dropdowns.role_taft.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {CATEGORIES.map((c) => {
              const items = categoryItems(c.key);
              return (
                <div key={c.key} className="border-t pt-3">
                  <p className="text-xs font-bold text-gray-700 mb-1">{c.label}</p>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Belum ada item untuk kategori ini di master_dropdown.
                    </p>
                  ) : (
                    items.map((item) => (
                      <ToggleSwitch
                        key={item}
                        label={item}
                        checked={form[c.key].includes(item)}
                        onChange={(v) => toggleItem(c.key, item, v)}
                      />
                    ))
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" icon={X} onClick={() => setShowForm(false)}>Batal</Button>
              <Button icon={Save} onClick={handleSubmit} loading={saving}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {detailRow && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailRow(null)}>
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Detail Checklist</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {detailRow.name} — {detailRow.created_at}
              </p>
              <p className="text-xs text-gray-500">
                {detailRow.taft_by || "-"} ({detailRow.role_taft || "-"})
              </p>
            </div>

            {CATEGORIES.map((c) => {
              const items = categoryItems(c.key);
              const stored = new Set(parseItems(detailRow[c.key]));
              return (
                <div key={c.key} className="border-t pt-3">
                  <p className="text-xs font-bold text-gray-700 mb-1">{c.label}</p>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Tidak ada item.</p>
                  ) : (
                    items.map((item) => {
                      const done = stored.has(item);
                      return (
                        <div key={item} className="flex items-center justify-between text-xs py-1">
                          <span className="text-gray-700">{item}</span>
                          {done ? (
                            <span className="flex items-center gap-1 text-green-700 font-semibold">
                              <Check className="w-3.5 h-3.5" /> Selesai
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 font-semibold">
                              <X className="w-3.5 h-3.5" /> Belum
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setDetailRow(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Hapus Checklist?</h2>
            <p className="text-sm text-gray-500 mb-5">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
              <Button variant="danger" onClick={handleDelete} loading={saving}>Hapus</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
