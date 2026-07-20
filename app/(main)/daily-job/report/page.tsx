"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/shared/Button";
import { Eye, Check, X } from "lucide-react";
import { jakartaDateKeyFromCreatedAt } from "@/lib/dailyJobDate";

// Daily Job Report — akses KHUSUS daily_checklist_all: lihat riwayat
// checklist SEMUA toko (read-only). User dengan hanya daily_checklist
// (bukan _all) tidak bisa masuk ke halaman ini sama sekali — mereka cuma
// bisa lihat/isi punya toko sendiri di /daily-job/checklist.
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

function parseItems(str: string | undefined | null): string[] {
  if (!str) return [];
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

function countDone(storedCsv: string, currentItems: string[]): { done: number; total: number } {
  const stored = new Set(parseItems(storedCsv));
  const done = currentItems.filter((i) => stored.has(i)).length;
  return { done, total: currentItems.length };
}

const ITEMS_PER_PAGE = 10;

export default function DailyJobReportPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdowns, setDropdowns] = useState<DropdownData>({
    role_taft: [], checklist_opening: [], checklist_operational: [], checklist_closing: [],
  });
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<ChecklistRow | null>(null);

  const [filterStore, setFilterStore] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.daily_checklist_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-job/dropdown");
      if (res.ok) setDropdowns(await res.json());
    } catch {}
  }, []);

  const fetchRows = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-job/checklist?scope=all`, { cache: "no-store" });
      if (res.ok) setRows(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchDropdowns();
    fetchRows();
  }, [user, fetchDropdowns, fetchRows]);

  useEffect(() => {
    setPage(1);
  }, [filterStore, filterFrom, filterTo]);

  const categoryItems = (key: CategoryKey): string[] => dropdowns[CATEGORY_TO_DROPDOWN_KEY[key]] || [];

  if (!user) return null;

  const storeKey = filterStore.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (storeKey && !(r.name || "").toLowerCase().includes(storeKey)) return false;
    const dateKey = jakartaDateKeyFromCreatedAt(r.created_at);
    if (filterFrom && (!dateKey || dateKey < filterFrom)) return false;
    if (filterTo && (!dateKey || dateKey > filterTo)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paged = filteredRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const colCount = 5 + CATEGORIES.length;

  return (
    <div className="p-3 md:p-4 max-w-full mx-auto">
      <div className="mb-3">
        <h1 className="text-lg font-bold text-gray-800">Daily Job Report</h1>
        <p className="text-xs text-gray-500">Riwayat checklist harian — semua toko</p>
      </div>

      <div className="bg-white rounded-lg shadow p-3 mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Cari Toko</label>
          <input
            type="text"
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            placeholder="mis. Torch Tambun"
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-48"
          />
        </div>
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
        {(filterStore || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterStore(""); setFilterFrom(""); setFilterTo(""); }}
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
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[140px]">Toko</th>
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[160px]">Taft By</th>
                <th className="px-4 py-2.5 text-left border-r border-gray-200 whitespace-nowrap min-w-[110px]">Role</th>
                {CATEGORIES.map((c) => (
                  <th key={c.key} className="px-4 py-2.5 text-center border-r border-gray-200 whitespace-nowrap min-w-[150px]">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center whitespace-nowrap min-w-[80px]">Aksi</th>
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
                    <td className="px-4 py-2.5 border-r border-gray-200 whitespace-nowrap">{r.name}</td>
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
                      <button onClick={() => setDetailRow(r)} title="Lihat detail" className="p-1 rounded hover:bg-gray-200 text-gray-500">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
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
    </div>
  );
}
