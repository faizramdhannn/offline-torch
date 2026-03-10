"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

interface TrafficEntry {
  id: string;
  store_location: string;
  taft_name: string;
  traffic_source: string;
  intention: string;
  case: string;
  notes: string;
  created_at: string;
  update_at: string;
}

interface MasterRow {
  store_location: string;
  taft_name: string;
  traffic_source: string;
  intention: string;
  case: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }
  return (
    <div className="flex items-center justify-between pt-3 border-t mt-2">
      <p className="text-xs text-gray-400">
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} dari {total}
      </p>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">‹</button>
        {pages.map((p, i) => p === "..." ? (
          <span key={i} className="px-2 py-1 text-xs text-gray-400">…</span>
        ) : (
          <button key={i} onClick={() => onChange(p as number)}
            className={`px-2.5 py-1 text-xs border rounded ${page === p ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">›</button>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STORE_NAME_MAP: Record<string, string> = {
  cirebon: "Cirebon", jogja: "Jogja", karawaci: "Karawaci", karawang: "Karawang",
  lampung: "Lampung", lembong: "Lembong", makassar: "Makassar", malang: "Malang",
  margonda: "Margonda", medan: "Medan", pekalongan: "Pekalongan", purwokerto: "Purwokerto",
  surabaya: "Surabaya", tambun: "Tambun",
};

function toTitleCase(str: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const EMPTY_FORM = {
  taft_name: "", traffic_source: "", intention: "", case: "", notes: "",
};

export default function TrafficStorePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TrafficEntry[]>([]);
  const [master, setMaster] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<TrafficEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Filters
  const [filterStore, setFilterStore] = useState("all");
  const [filterTaft, setFilterTaft] = useState("all");
  const [filterTraffic, setFilterTraffic] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Report view
  const [activeTab, setActiveTab] = useState<"list" | "report">("list");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.traffic_store && !parsed.report_store) { router.push("/dashboard"); return; }
    setUser(parsed);
    fetchAll();
  }, []);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMsg(msg); setPopupType(type); setShowPopup(true);
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [dataRes, masterRes] = await Promise.all([
        fetch("/api/traffic-store"),
        fetch("/api/traffic-store?type=master"),
      ]);
      const dataJson = await dataRes.json();
      const masterJson = await masterRes.json();
      setData(Array.isArray(dataJson) ? dataJson : []);
      setMaster(Array.isArray(masterJson) ? masterJson : []);
    } catch {
      showMessage("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Derive user's store location
  const userStore = (() => {
    if (!user) return null;
    const username = user.user_name?.toLowerCase() || "";
    // If username matches a store key or name
    const storeKeys = Object.keys(STORE_NAME_MAP);
    const match = storeKeys.find(k => username === k || username === k.replace(/\s/g, "") || username.includes(k));
    // Also check from master data
    const masterStores = [...new Set(master.map(m => m.store_location))];
    const masterMatch = masterStores.find(s => s.toLowerCase() === username || username.includes(s.toLowerCase()));
    return masterMatch || match || null;
  })();

  const isStoreUser = !!userStore && user?.traffic_store && !user?.report_store;

  // Tafts for selected store (in form)
  const taftsForStore = master
    .filter(m => m.store_location?.toLowerCase() === (userStore?.toLowerCase() || ""))
    .map(m => m.taft_name)
    .filter(Boolean);

  // Unique dropdown values from master
  const trafficSources = [...new Set(master.map(m => m.traffic_source).filter(Boolean))];
  const intentions = [...new Set(master.map(m => m.intention).filter(Boolean))];

  // Cases filtered by selected intention
  const casesForIntention = form.intention
    ? [...new Set(master.filter(m => m.intention === form.intention).map(m => m.case).filter(Boolean))]
    : [];

  // Filtered data
  const filteredData = useCallback(() => {
    let rows = data.filter(r => r.id);
    if (isStoreUser && userStore) {
      rows = rows.filter(r => r.store_location?.toLowerCase() === userStore.toLowerCase());
    }
    if (filterStore !== "all" && !isStoreUser) {
      rows = rows.filter(r => r.store_location?.toLowerCase() === filterStore.toLowerCase());
    }
    if (filterTaft !== "all") rows = rows.filter(r => r.taft_name === filterTaft);
    if (filterTraffic !== "all") rows = rows.filter(r => r.traffic_source === filterTraffic);
    if (filterDateFrom) rows = rows.filter(r => r.created_at >= filterDateFrom);
    if (filterDateTo) rows = rows.filter(r => r.created_at <= filterDateTo + "T23:59:59");
    return rows;
  }, [data, filterStore, filterTaft, filterTraffic, filterDateFrom, filterDateTo, isStoreUser, userStore]);

  const fd = filteredData();
  const paginated = fd.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Report: aggregate by store + traffic source
  const reportData = (() => {
    const rows = isStoreUser && userStore
      ? data.filter(r => r.id && r.store_location?.toLowerCase() === userStore.toLowerCase())
      : data.filter(r => r.id);

    const stores = [...new Set(rows.map(r => r.store_location).filter(Boolean))].sort();
    const sources = [...new Set(rows.map(r => r.traffic_source).filter(Boolean))].sort();

    const map: Record<string, Record<string, number>> = {};
    rows.forEach(r => {
      if (!map[r.store_location]) map[r.store_location] = {};
      map[r.store_location][r.traffic_source] = (map[r.store_location][r.traffic_source] || 0) + 1;
    });

    return { stores, sources, map };
  })();

  const openAdd = () => {
    setEditEntry(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (entry: TrafficEntry) => {
    setEditEntry(entry);
    setForm({
      taft_name: entry.taft_name,
      traffic_source: entry.traffic_source,
      intention: entry.intention,
      case: entry.case,
      notes: entry.notes,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.taft_name || !form.traffic_source || !form.intention || !form.case) {
      showMessage("Taft, Traffic Source, Intensi, dan Case wajib diisi", "error"); return;
    }
    setSaving(true);
    try {
      const storeLocation = userStore || filterStore !== "all" ? (userStore || filterStore) : "";
      if (!storeLocation && !editEntry) {
        showMessage("Store tidak dikenali", "error"); setSaving(false); return;
      }
      if (editEntry) {
        const res = await fetch("/api/traffic-store", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editEntry.id, ...form, case: form.case }),
        });
        const result = await res.json();
        if (result.success) { showMessage("Data berhasil diupdate", "success"); setShowForm(false); fetchAll(); }
        else showMessage(result.error || "Gagal update", "error");
      } else {
        const res = await fetch("/api/traffic-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_location: storeLocation,
            ...form,
            case: form.case,
            created_by: user?.user_name,
          }),
        });
        const result = await res.json();
        if (result.success) { showMessage("Data berhasil ditambahkan", "success"); setShowForm(false); fetchAll(); }
        else showMessage(result.error || "Gagal simpan", "error");
      }
    } catch { showMessage("Terjadi kesalahan", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data ini?")) return;
    try {
      const res = await fetch(`/api/traffic-store?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { showMessage("Data dihapus", "success"); fetchAll(); }
      else showMessage(result.error || "Gagal hapus", "error");
    } catch { showMessage("Terjadi kesalahan", "error"); }
  };

  // Export report as CSV
  const exportReport = () => {
    const { stores, sources, map } = reportData;
    const header = ["Store", ...sources];
    const rows = stores.map(store => [
      toTitleCase(store),
      ...sources.map(src => String(map[store]?.[src] || 0)),
    ]);
    // Add totals row
    const totals = ["TOTAL", ...sources.map(src =>
      String(stores.reduce((s, store) => s + (map[store]?.[src] || 0), 0))
    )];
    const csv = [header, ...rows, totals].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Traffic_Store_Report_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export list as CSV
  const exportList = () => {
    const headers = ["ID", "Store", "Taft", "Traffic Source", "Intensi", "Case", "Notes", "Tanggal"];
    const rows = fd.map(r => [
      r.id, r.store_location, r.taft_name, r.traffic_source,
      r.intention, r.case, r.notes, formatDate(r.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Traffic_Store_List_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allStores = [...new Set(master.map(m => m.store_location).filter(Boolean))].sort();

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-primary">Traffic Store</h1>
              {userStore && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Store: <span className="font-medium text-gray-700">{toTitleCase(userStore)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {user?.report_store && activeTab === "report" && (
                <button onClick={exportReport}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors">
                  ↓ Export CSV
                </button>
              )}
              {activeTab === "list" && (
                <button onClick={exportList}
                  className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors">
                  ↓ Export List
                </button>
              )}
              {user?.traffic_store && (
                <button onClick={openAdd}
                  className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors">
                  + Tambah Traffic
                </button>
              )}
            </div>
          </div>

          {/* Tabs (only for report_store) */}
          {user?.report_store && (
            <div className="flex gap-1 mb-4">
              {[
                { id: "list", label: "Data List" },
                { id: "report", label: "Laporan" },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className={`px-4 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${
                    activeTab === t.id ? "border-primary text-primary bg-white" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* ── LIST TAB ── */}
          {activeTab === "list" && (
            <div className="bg-white rounded-lg shadow">
              {/* Filters */}
              <div className="p-4 border-b">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {!isStoreUser && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                      <select value={filterStore} onChange={e => { setFilterStore(e.target.value); setPage(1); }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="all">Semua Store</option>
                        {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Traffic Source</label>
                    <select value={filterTraffic} onChange={e => { setFilterTraffic(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="all">Semua</option>
                      {trafficSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dari</label>
                    <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sampai</label>
                    <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setFilterStore("all"); setFilterTaft("all"); setFilterTraffic("all"); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }}
                      className="w-full px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">
                      Reset
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{fd.length} data ditemukan</p>
              </div>

              {/* Table */}
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : fd.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">Belum ada data traffic</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Tanggal</th>
                            {!isStoreUser && <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>}
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Taft</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Traffic Source</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Intensi</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Case</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                            {user?.traffic_store && <th className="px-3 py-2 text-center font-semibold text-gray-700">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((row, i) => (
                            <tr key={row.id || i} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-gray-500">{formatDate(row.created_at)}</td>
                              {!isStoreUser && <td className="px-3 py-2 font-medium">{toTitleCase(row.store_location)}</td>}
                              <td className="px-3 py-2">{row.taft_name}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                                  {row.traffic_source}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{row.intention || "-"}</td>
                              <td className="px-3 py-2 text-gray-600">{row.case || "-"}</td>
                              <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{row.notes || "-"}</td>
                              {user?.traffic_store && (
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => openEdit(row)}
                                      className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                                      Edit
                                    </button>
                                    <button onClick={() => handleDelete(row.id)}
                                      className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100">
                                      Hapus
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={page} total={fd.length} pageSize={PAGE_SIZE} onChange={setPage} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── REPORT TAB ── */}
          {activeTab === "report" && user?.report_store && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Laporan Traffic per Store × Traffic Source
              </h3>
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-50 border border-gray-200 whitespace-nowrap">
                          Store
                        </th>
                        {reportData.sources.map(src => (
                          <th key={src} className="px-3 py-2 text-center font-semibold text-gray-700 bg-gray-50 border border-gray-200 whitespace-nowrap min-w-[90px]">
                            {src}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-primary/10 border border-gray-200 whitespace-nowrap">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.stores.map((store, i) => {
                        const rowTotal = reportData.sources.reduce((s, src) => s + (reportData.map[store]?.[src] || 0), 0);
                        return (
                          <tr key={store} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 font-medium border border-gray-200 whitespace-nowrap">
                              {toTitleCase(store)}
                            </td>
                            {reportData.sources.map(src => {
                              const val = reportData.map[store]?.[src] || 0;
                              return (
                                <td key={src} className="px-3 py-2 text-center border border-gray-200">
                                  {val > 0 ? (
                                    <span className="font-semibold text-blue-700">{val}</span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center border border-gray-200 font-bold text-primary bg-primary/5">
                              {rowTotal}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="bg-primary/10 font-bold">
                        <td className="px-3 py-2 border border-gray-200">TOTAL</td>
                        {reportData.sources.map(src => {
                          const colTotal = reportData.stores.reduce((s, store) => s + (reportData.map[store]?.[src] || 0), 0);
                          return (
                            <td key={src} className="px-3 py-2 text-center border border-gray-200 text-primary">
                              {colTotal}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center border border-gray-200 text-primary">
                          {reportData.stores.reduce((s, store) =>
                            s + reportData.sources.reduce((ss, src) => ss + (reportData.map[store]?.[src] || 0), 0), 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Per-Store Detail Tables */}
              <div className="mt-8 space-y-6">
                <h3 className="text-sm font-semibold text-gray-700">Detail per Store</h3>
                {reportData.stores.map(store => {
                  const storeRows = data.filter(r => r.id && r.store_location?.toLowerCase() === store.toLowerCase());
                  const tafts = [...new Set(storeRows.map(r => r.taft_name).filter(Boolean))].sort();
                  const sources = [...new Set(storeRows.map(r => r.traffic_source).filter(Boolean))].sort();
                  const taftMap: Record<string, Record<string, number>> = {};
                  storeRows.forEach(r => {
                    if (!taftMap[r.taft_name]) taftMap[r.taft_name] = {};
                    taftMap[r.taft_name][r.traffic_source] = (taftMap[r.taft_name][r.traffic_source] || 0) + 1;
                  });
                  if (tafts.length === 0) return null;
                  return (
                    <div key={store}>
                      <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                        {toTitleCase(store)}
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="text-xs border-collapse">
                          <thead>
                            <tr>
                              <th className="px-3 py-1.5 text-left font-semibold bg-gray-50 border border-gray-200 whitespace-nowrap">Taft</th>
                              {sources.map(src => (
                                <th key={src} className="px-3 py-1.5 text-center font-semibold bg-gray-50 border border-gray-200 whitespace-nowrap min-w-[80px]">{src}</th>
                              ))}
                              <th className="px-3 py-1.5 text-center font-semibold bg-primary/10 border border-gray-200 whitespace-nowrap">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tafts.map((taft, i) => {
                              const rowTotal = sources.reduce((s, src) => s + (taftMap[taft]?.[src] || 0), 0);
                              return (
                                <tr key={taft} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-3 py-1.5 border border-gray-200 whitespace-nowrap">{taft}</td>
                                  {sources.map(src => {
                                    const val = taftMap[taft]?.[src] || 0;
                                    return (
                                      <td key={src} className="px-3 py-1.5 text-center border border-gray-200">
                                        {val > 0 ? <span className="font-semibold text-blue-700">{val}</span> : <span className="text-gray-300">-</span>}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-1.5 text-center border border-gray-200 font-bold text-primary">{rowTotal}</td>
                                </tr>
                              );
                            })}
                            <tr className="bg-primary/10 font-bold">
                              <td className="px-3 py-1.5 border border-gray-200">TOTAL</td>
                              {sources.map(src => (
                                <td key={src} className="px-3 py-1.5 text-center border border-gray-200 text-primary">
                                  {tafts.reduce((s, taft) => s + (taftMap[taft]?.[src] || 0), 0)}
                                </td>
                              ))}
                              <td className="px-3 py-1.5 text-center border border-gray-200 text-primary">
                                {tafts.reduce((s, taft) => s + sources.reduce((ss, src) => ss + (taftMap[taft]?.[src] || 0), 0), 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-gray-800 mb-4">
              {editEntry ? "Edit Data Traffic" : "Tambah Data Traffic"}
            </h2>

            {userStore && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                <input type="text" value={toTitleCase(userStore)} disabled
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-gray-50 text-gray-500" />
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Taft <span className="text-red-500">*</span>
              </label>
              <select value={form.taft_name} onChange={e => setForm(f => ({ ...f, taft_name: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Pilih Taft --</option>
                {taftsForStore.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Traffic Source <span className="text-red-500">*</span>
              </label>
              <select value={form.traffic_source} onChange={e => setForm(f => ({ ...f, traffic_source: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Pilih Traffic Source --</option>
                {trafficSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Intensi <span className="text-red-500">*</span>
              </label>
              <select value={form.intention} onChange={e => setForm(f => ({ ...f, intention: e.target.value, case: "" }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Pilih Intensi --</option>
                {intentions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Case <span className="text-red-500">*</span>
              </label>
              <select
                value={form.case}
                onChange={e => setForm(f => ({ ...f, case: e.target.value }))}
                disabled={!form.intention}
                className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary
                  ${!form.intention
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-white border-gray-300"
                  }`}
              >
                <option value="">
                  {!form.intention ? "Pilih Intensi terlebih dahulu" : "-- Pilih Case --"}
                </option>
                {casesForIntention.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Catatan tambahan..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMsg} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}