"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { Button } from "@/components/shared/Button";
import { Pagination } from "@/components/shared/Pagination";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { CHART_PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";
import { Pencil, Trash2, Save, X, Plus, Eye, Check } from "lucide-react";
import { jakartaDateKeyFromCreatedAt, todayJakartaKey, parseCreatedAtForSort } from "@/lib/dailyJobDate";

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

// Item checklist per kategori dinamis (dari master_dropdown, lihat
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
  const [activeTab, setActiveTab] = useState<"checklist" | "report">("checklist");

  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [allRows, setAllRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<ChecklistRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    role_taft: [], checklist_opening: [], checklist_operational: [], checklist_closing: [],
  });
  const [taftOptions, setTaftOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistRow | null>(null);
  const [detailRow, setDetailRow] = useState<ChecklistRow | null>(null);

  // Filter tanggal riwayat sendiri (tab Checklist).
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Filter tab Report (toko + tanggal).
  const [reportStore, setReportStore] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

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

  // Tab Checklist — SELALU cuma riwayat toko sendiri.
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

  // Tab Report — SEMUA toko, khusus daily_checklist_all.
  const fetchAllRows = useCallback(async () => {
    if (!user?.daily_checklist_all) return;
    setLoadingAll(true);
    try {
      const res = await fetch(`/api/daily-job/checklist?scope=all`, { cache: "no-store" });
      if (res.ok) setAllRows(await res.json());
    } catch {
    } finally {
      setLoadingAll(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchDropdowns();
    fetchTaftOptions();
    fetchRows();
    if (user.daily_checklist_all) fetchAllRows();
  }, [user, fetchDropdowns, fetchTaftOptions, fetchRows, fetchAllRows]);

  useEffect(() => {
    setPage(1);
  }, [filterFrom, filterTo]);

  useEffect(() => {
    setReportPage(1);
  }, [reportStore, reportFrom, reportTo]);

  const canEdit = !!user?.daily_checklist;
  const canReport = !!user?.daily_checklist_all;

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

  const refreshAfterWrite = async () => {
    await fetchRows();
    if (canReport) await fetchAllRows();
  };

  const logActivity = async (method: string, activity: string, entityId?: string) => {
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user?.user_name, method, activity_log: activity, entity_type: "daily_checklist", entity_id: entityId || "" }),
      });
    } catch {}
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
        name: editingRow?.name || user.name,
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
      const result = await res.json().catch(() => null);
      await logActivity(
        editingRow ? "PUT" : "POST",
        editingRow ? "Updated daily checklist" : "Created daily checklist",
        editingRow?.id ? String(editingRow.id) : (result?.id ? String(result.id) : undefined)
      );
      showMessage(editingRow ? "Checklist berhasil diperbarui" : "Checklist berhasil dibuat", "success");
      setShowForm(false);
      await refreshAfterWrite();
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
      await logActivity("DELETE", `Deleted daily checklist ID: ${deleteTarget.id}`, String(deleteTarget.id));
      showMessage("Checklist berhasil dihapus", "success");
      setDeleteTarget(null);
      await refreshAfterWrite();
    } catch {
      showMessage("Gagal menghapus checklist", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Report: trend, progress hari ini per item, breakdown per kategori ──
  const reportFiltered = useMemo(() => {
    const storeKey = reportStore.trim().toLowerCase();
    return allRows
      .filter((r) => {
        if (storeKey && !(r.name || "").toLowerCase().includes(storeKey)) return false;
        const dateKey = jakartaDateKeyFromCreatedAt(r.created_at);
        if (reportFrom && (!dateKey || dateKey < reportFrom)) return false;
        if (reportTo && (!dateKey || dateKey > reportTo)) return false;
        return true;
      })
      // "Semua Riwayat" tampil terbaru dulu.
      .sort((a, b) => parseCreatedAtForSort(b.created_at) - parseCreatedAtForSort(a.created_at));
  }, [allRows, reportStore, reportFrom, reportTo]);

  const trendData = useMemo(() => {
    const map = new Map<string, Record<string, { done: number; total: number }>>();
    for (const r of reportFiltered) {
      const dateKey = jakartaDateKeyFromCreatedAt(r.created_at);
      if (!dateKey) continue;
      if (!map.has(dateKey)) {
        map.set(dateKey, Object.fromEntries(CATEGORIES.map((c) => [c.key, { done: 0, total: 0 }])));
      }
      const entry = map.get(dateKey)!;
      for (const c of CATEGORIES) {
        const items = categoryItems(c.key);
        const { done, total } = countDone(r[c.key], items);
        entry[c.key].done += done;
        entry[c.key].total += total;
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, cats]) => {
        const point: any = { date };
        for (const c of CATEGORIES) {
          const { done, total } = cats[c.key];
          point[c.key] = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;
        }
        return point;
      });
  }, [reportFiltered, dropdowns]);

  // Progress HARI INI per item (lintas semua toko) — donut kecil per item,
  // menjawab "hari ini item X sudah 100% dikerjakan semua toko atau belum".
  // Selalu berbasis hari ini (bukan rentang filter tanggal), tapi tetap
  // menghormati filter toko kalau ada.
  const todayItemStats = useMemo(() => {
    const todayKey = todayJakartaKey();
    const storeKey = reportStore.trim().toLowerCase();
    const todayRows = allRows.filter((r) => {
      if (storeKey && !(r.name || "").toLowerCase().includes(storeKey)) return false;
      return jakartaDateKeyFromCreatedAt(r.created_at) === todayKey;
    });
    return CATEGORIES.flatMap((c) => {
      const items = categoryItems(c.key);
      return items.map((item) => {
        const missingStores = todayRows.filter((r) => !parseItems(r[c.key]).includes(item)).map((r) => r.name);
        const done = todayRows.length - missingStores.length;
        const total = todayRows.length;
        return { category: c.label, item, done, total, missingStores };
      });
    });
  }, [allRows, reportStore, dropdowns]);

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((c) => {
      const items = categoryItems(c.key);
      const itemStats = items.map((item) => {
        const done = reportFiltered.filter((r) => parseItems(r[c.key]).includes(item)).length;
        return { item, done, total: reportFiltered.length };
      });
      return { category: c, itemStats };
    });
  }, [reportFiltered, dropdowns]);

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

  const reportTotalPages = Math.max(1, Math.ceil(reportFiltered.length / ITEMS_PER_PAGE));
  const reportPaged = reportFiltered.slice((reportPage - 1) * ITEMS_PER_PAGE, reportPage * ITEMS_PER_PAGE);
  const reportColCount = 5 + CATEGORIES.length;

  const renderDetailModal = () => {
    if (!detailRow) return null;
    return (
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push(`/daily-job/checklist/${detailRow.id}`)}>
              Buka Halaman Detail
            </Button>
            <Button variant="outline" onClick={() => setDetailRow(null)}>Tutup</Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 md:p-4 max-w-full mx-auto">
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />

      <div className="mb-3">
        <h1 className="text-lg font-bold text-gray-800">Daily Job</h1>
        <p className="text-xs text-gray-500">Checklist harian toko</p>
      </div>

      {canReport && (
        <div className="bg-white rounded-lg shadow px-2 pt-2 mb-3 flex gap-1">
          <button
            onClick={() => setActiveTab("checklist")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "checklist" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Daily Checklist
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "report" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Report
          </button>
        </div>
      )}

      {activeTab === "checklist" && (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs text-gray-500">Riwayat toko — {user.name}</p>
            {canEdit && (
              <Button icon={Plus} size="sm" onClick={openAddToday}>
                {todayRow ? "Edit Checklist Hari Ini" : "Isi Checklist Hari Ini"}
              </Button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-3 mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]"
              />
            </div>
            {(filterFrom || filterTo) && (
              <button
                onClick={() => { setFilterFrom(""); setFilterTo(""); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[140px]">Tanggal</th>
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[140px]">Taft By</th>
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[90px]">Role</th>
                    {CATEGORIES.map((c) => (
                      <th key={c.key} className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap min-w-[130px]">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center whitespace-nowrap min-w-[100px]">Aksi</th>
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
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.created_at}</td>
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.taft_by || "-"}</td>
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.role_taft || "-"}</td>
                        {CATEGORIES.map((c) => {
                          const { done, total } = countDone(r[c.key], categoryItems(c.key));
                          return (
                            <td key={c.key} className="px-3 py-2 border-r border-gray-200 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                total > 0 && done === total ? "bg-green-100 text-green-700" : done === 0 ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                              }`}>
                                {done}/{total}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
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
        </>
      )}

      {activeTab === "report" && canReport && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Cari Toko</label>
              <input
                type="text"
                value={reportStore}
                onChange={(e) => setReportStore(e.target.value)}
                placeholder="mis. Torch Tambun"
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] w-48"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px]"
              />
            </div>
            {(reportStore || reportFrom || reportTo) && (
              <button
                onClick={() => { setReportStore(""); setReportFrom(""); setReportTo(""); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Trend Completion Rate per Kategori</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="date" tick={chartAxisTick} />
                <YAxis tick={chartAxisTick} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => `${v ?? 0}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CATEGORIES.map((c, i) => (
                  <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={CHART_PALETTE[i]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-1">Progress Hari Ini per Item</h3>
            <p className="text-[10px] text-gray-400 mb-3">
              Persentase toko yang sudah mengerjakan item tersebut hari ini (dari {todayItemStats[0]?.total ?? 0} entri masuk hari ini)
            </p>
            {todayItemStats.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Belum ada item di master_dropdown.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {todayItemStats.map(({ category, item, done, total, missingStores }) => {
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const donutData = [
                    { name: "done", value: pct },
                    { name: "remaining", value: 100 - pct },
                  ];
                  const color = pct === 100 ? "#22c55e" : pct === 0 ? "#d1d5db" : "#f59e0b";
                  return (
                    <div key={`${category}-${item}`} className="group relative flex flex-col items-center text-center">
                      <div className="relative w-16 h-16">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={donutData}
                              dataKey="value"
                              innerRadius={20}
                              outerRadius={30}
                              startAngle={90}
                              endAngle={-270}
                              stroke="none"
                            >
                              <Cell fill={color} />
                              <Cell fill="#f1f5f9" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">
                          {pct}%
                        </div>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-gray-700 leading-tight line-clamp-2">{item}</p>
                      <p className="text-[9px] text-gray-400">{category}</p>

                      {/* Hover tooltip: daftar toko yang BELUM mengerjakan item ini hari ini. */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 w-44 rounded-lg bg-gray-900 px-2.5 py-2 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        <p className="text-[10px] font-semibold text-white mb-1">
                          {pct === 100 ? "Semua toko sudah selesai" : `Belum (${missingStores.length}/${total})`}
                        </p>
                        {pct !== 100 && (
                          missingStores.length === 0 ? (
                            <p className="text-[10px] text-gray-300">Belum ada data hari ini.</p>
                          ) : (
                            <ul className="max-h-28 space-y-0.5 overflow-y-auto text-[10px] text-gray-300">
                              {missingStores.map((s) => (
                                <li key={s} className="truncate">{s}</li>
                              ))}
                            </ul>
                          )
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {categoryBreakdown.map(({ category, itemStats }) => (
              <div key={category.key} className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-2">{category.label}</h3>
                <p className="text-[10px] text-gray-400 mb-3">Detail per item, dari {reportFiltered.length} entri pada rentang filter</p>
                {itemStats.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Belum ada item di master_dropdown.</p>
                ) : (
                  <div className="space-y-2">
                    {itemStats.map(({ item, done, total }) => {
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={item}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-700">{item}</span>
                            <span className="text-gray-500">{done}/{total}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : pct === 0 ? "bg-gray-300" : "bg-amber-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Semua Riwayat</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[140px]">Tanggal</th>
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[120px]">Toko</th>
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[140px]">Taft By</th>
                    <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap min-w-[90px]">Role</th>
                    {CATEGORIES.map((c) => (
                      <th key={c.key} className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap min-w-[120px]">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center whitespace-nowrap min-w-[100px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAll ? (
                    <tr><td colSpan={reportColCount} className="text-center py-6 text-gray-400">Memuat data...</td></tr>
                  ) : reportPaged.length === 0 ? (
                    <tr><td colSpan={reportColCount} className="text-center py-6 text-gray-400">Belum ada data</td></tr>
                  ) : (
                    reportPaged.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.created_at}</td>
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.taft_by || "-"}</td>
                        <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{r.role_taft || "-"}</td>
                        {CATEGORIES.map((c) => {
                          const { done, total } = countDone(r[c.key], categoryItems(c.key));
                          return (
                            <td key={c.key} className="px-3 py-2 border-r border-gray-200 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                total > 0 && done === total ? "bg-green-100 text-green-700" : done === 0 ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-700"
                              }`}>
                                {done}/{total}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => setDetailRow(r)} title="Lihat detail" className="p-1 rounded hover:bg-gray-200 text-gray-500">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(r)} title="Edit" className="p-1 rounded hover:bg-gray-200 text-gray-500">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteTarget(r)} title="Hapus" className="p-1 rounded hover:bg-red-100 text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={reportPage}
              totalPages={reportTotalPages}
              onPageChange={setReportPage}
              rangeLabel={`${reportFiltered.length === 0 ? 0 : (reportPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(reportPage * ITEMS_PER_PAGE, reportFiltered.length)} dari ${reportFiltered.length}`}
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-800">
              {editingRow ? `Edit Checklist${editingRow.name ? ` — ${editingRow.name}` : ""}` : "Isi Checklist Hari Ini"}
            </h2>

            <div>
              <label className="text-xs text-gray-500">Taft By</label>
              <select
                value={form.taft_by}
                onChange={(e) => setForm((p) => ({ ...p, taft_by: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="">-- Pilih Taft --</option>
                {form.taft_by && !taftOptions.includes(form.taft_by) && (
                  <option value={form.taft_by}>{form.taft_by}</option>
                )}
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

      {renderDetailModal()}

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
