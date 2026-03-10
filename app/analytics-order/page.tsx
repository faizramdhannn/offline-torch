"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

// ─── Traffic Code Map ────────────────────────────────────────────────────────
const TRAFFIC_MAP: Record<string, string> = {
  WG: "Whatsapp Group",
  TO: "Traffic Organic / Walk In",
  TT: "Teman",
  IO: "Instagram Official",
  IT: "Instagram Toko",
  KM: "Komunitas",
  TK: "Tiktok Official",
  MO: "Marketplace Official",
  MT: "Marketplace Toko",
  SG: "Searching Google",
  ET: "Event Torch",
  VT: "Voucher Torch",
  LB: "Liat Banyak yang Pakai",
  WS: "Webstore",
  AD: "Ads Promote",
  EM: "Email",
  WB: "Whatsapp Blast",
  PB: "Pernah Beli / Cust Lama",
  PH: "Perusahaan",
  DE: "Dari Eiger",
  KK: "Karyawan",
  DY: "Dealer Yamaha",
  TB: "T Banner",
};

const COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
  "#14b8a6","#e11d48","#a855f7","#22c55e","#fb923c",
  "#0ea5e9","#d946ef","#facc15","#4ade80","#fb7185",
];

function formatRupiah(val: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
}

function parseSubtotal(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function extractTrafficCode(notes: string | null | undefined): string | null {
  if (!notes) return null;

  const upper = notes.trim().toUpperCase();

  const tokens = upper
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^A-Z]/g, ""))
    .filter(Boolean);

  if (tokens.length === 0) return null;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];

    if (TRAFFIC_MAP[token]) return token;

    if (token.length > 2) {
      const tail = token.slice(-2);
      if (TRAFFIC_MAP[tail]) return tail;
    }
  }

  return null;
}

function cleanLocationName(loc: string | null | undefined): string {
  if (!loc) return "Unknown";
  return loc
    .replace(/Torch Store\s*/i, "")
    .replace(/Torch\s*/i, "")
    .split(" - ")[0]
    .trim() || loc;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

interface Row {
  Name?: string;
  "Created at"?: string;
  Subtotal?: string;
  Notes?: string;
  "Discount Code"?: string;
  "Discount Amount"?: string;
  "Lineitem name"?: string;
  "Lineitem quantity"?: string;
  "Lineitem price"?: string;
  Employee?: string;
  Location?: string;
  [key: string]: string | null | undefined;
}

const CHART_TABS = [
  { id: "store", label: "Revenue per Store" },
  { id: "traffic", label: "Traffic Source" },
  { id: "discount", label: "Discount Code" },
  { id: "product", label: "Product Sales" },
  { id: "employee", label: "Employee" },
];

// Custom dark tooltip
const DarkTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.name || p.dataKey}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: p.fill || p.color || "#60a5fa" }}>
            {formatter ? formatter(p.value) : p.value?.toLocaleString?.() ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieLegend = ({ data }: { data: { name: string; value: number; color: string }[] }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
    {data.map((d, i) => (
      <div key={i} className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
        <span className="text-[10px] text-gray-500">{d.name}</span>
      </div>
    ))}
  </div>
);

// ─── Reusable Pagination Component ───────────────────────────────────────────
function Pagination({ page, total, pageSize, onChange }: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  return (
    <div className="flex items-center justify-between pt-3 border-t mt-2">
      <p className="text-xs text-gray-400">
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} dari {total}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
        >‹</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={i} className="px-2 py-1 text-xs text-gray-400">…</span>
          ) : (
            <button
              key={i}
              onClick={() => onChange(p as number)}
              className={`px-2.5 py-1 text-xs border rounded ${page === p ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}
            >{p}</button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
        >›</button>
      </div>
    </div>
  );
}

export default function AnalyticsOrderPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "refresh" | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [activeTab, setActiveTab] = useState("store");

  // Pagination per tab
  const [pageStore, setPageStore] = useState(1);
  const [pageTraffic, setPageTraffic] = useState(1);
  const [pageDiscount, setPageDiscount] = useState(1);
  const [pageProduct, setPageProduct] = useState(1);
  const [pageEmployee, setPageEmployee] = useState(1);
  const PAGE_SIZE = 10;
  const [hideUnknownTraffic, setHideUnknownTraffic] = useState(false);

  // ─── Filters — default: awal bulan ini s/d hari ini ──────────────────────
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getFirstOfMonthStr = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  };

  const [dateFrom, setDateFrom] = useState(getFirstOfMonthStr);
  const [dateTo, setDateTo] = useState(getTodayStr);
  const [storeFilter, setStoreFilter] = useState("all");

  // Store filter options
  const [stores, setStores] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.analytics_order) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, []);

  const showMessage = (msg: string, type: "success" | "error") => {
    setPopupMessage(msg);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shopify-analytics");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      const uniq = [...new Set((Array.isArray(data) ? data : []).map((r: Row) => cleanLocationName(r.Location)).filter(Boolean))] as string[];
      setStores(uniq.sort());
    } catch {
      showMessage("Failed to fetch analytics data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importMode) return;
    setShowImportModal(false);
    setImporting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              const data = results.data as any[][];
              const res = await fetch("/api/shopify-analytics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data, mode: importMode }),
              });
              const result = await res.json();
              if (res.ok && result.success) {
                showMessage(`Import berhasil!\n${result.message}`, "success");
                await fetchData();
              } else {
                showMessage(result.error || "Import failed", "error");
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          error: reject,
        });
      });
    } catch {
      showMessage("Gagal import data", "error");
    } finally {
      setImporting(false);
      setImportMode(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerImport = (mode: "append" | "refresh") => {
    setImportMode(mode);
    setShowImportModal(true);
  };

  // ─── Filtered Rows ────────────────────────────────────────────────────────
  const filteredRows = useCallback(() => {
    return rows.filter((r) => {
      const rawDate = r["Created at"] || "";
      const dateStr = rawDate.split(" ")[0];
      if (dateFrom && dateStr < dateFrom) return false;
      if (dateTo && dateStr > dateTo) return false;
      if (storeFilter !== "all") {
        const loc = cleanLocationName(r.Location);
        if (loc !== storeFilter) return false;
      }
      return true;
    });
  }, [rows, dateFrom, dateTo, storeFilter]);

  const fr = filteredRows();

  // ─── Data range info (min & max date dari SEMUA data) ─────────────────────
  const dataDateRange = (() => {
    const dates = rows
      .map((r) => (r["Created at"] || "").split(" ")[0])
      .filter((d) => d && d.length === 10)
      .sort();
    if (dates.length === 0) return null;
    return { min: dates[0], max: dates[dates.length - 1] };
  })();

  // ─── 1. Revenue per Store ─────────────────────────────────────────────────
  const revenueByStore = (() => {
    const orderSeen = new Set<string>();
    const map: Record<string, number> = {};
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const store = cleanLocationName(r.Location);
      const sub = parseSubtotal(r.Subtotal);
      map[store] = (map[store] || 0) + sub;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const orderCountByStore = (() => {
    const map: Record<string, Set<string>> = {};
    fr.forEach((r) => {
      const store = cleanLocationName(r.Location);
      if (!map[store]) map[store] = new Set();
      if (r.Name) map[store].add(r.Name);
    });
    return Object.entries(map).map(([name, s]) => ({ name, count: s.size }));
  })();

  // ─── 2. Traffic Source ────────────────────────────────────────────────────
  const trafficData = (() => {
    const map: Record<string, number> = {};
    let nullCount = 0;
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const code = extractTrafficCode(r.Notes);
      if (code) {
        const label = TRAFFIC_MAP[code] || code;
        map[label] = (map[label] || 0) + 1;
      } else {
        nullCount++;
      }
    });
    const result = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (nullCount > 0) result.push({ name: "Tidak Diketahui", value: nullCount });
    return result;
  })();

  const trafficDataForPie = trafficData.filter(d => d.name !== "Tidak Diketahui");

  const trafficByStore = (() => {
    if (storeFilter !== "all") return [];
    const storeList = [...new Set(fr.map(r => cleanLocationName(r.Location)))].sort();
    const codes = [...new Set(
      fr.map(r => {
        const code = extractTrafficCode(r.Notes);
        return code ? (TRAFFIC_MAP[code] || code) : null;
      }).filter(Boolean)
    )] as string[];

    const orderSeen = new Set<string>();
    const map: Record<string, Record<string, number>> = {};
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const store = cleanLocationName(r.Location);
      const code = extractTrafficCode(r.Notes);
      const label = code ? (TRAFFIC_MAP[code] || code) : "Tidak Diketahui";
      if (!map[store]) map[store] = {};
      map[store][label] = (map[store][label] || 0) + 1;
    });

    return storeList.map(store => ({
      name: store,
      ...codes.reduce((acc, c) => ({ ...acc, [c]: map[store]?.[c] || 0 }), {}),
    }));
  })();

  // ─── 3. Discount Code ────────────────────────────────────────────────────
  const discountData = (() => {
    const map: Record<string, { count: number; total: number }> = {};
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      if (orderSeen.has(key)) return;
      orderSeen.add(key);
      const code = r["Discount Code"]?.trim();
      if (!code) return;
      if (!map[code]) map[code] = { count: 0, total: 0 };
      map[code].count++;
      map[code].total += parseSubtotal(r["Discount Amount"]);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, total: d.total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  })();

  // ─── 4. Product Sales ─────────────────────────────────────────────────────
  const productData = (() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    fr.forEach((r) => {
      const name = r["Lineitem name"]?.trim();
      if (!name) return;
      const qty = parseInt(r["Lineitem quantity"] || "1") || 1;
      const price = parseSubtotal(r["Lineitem price"]);
      if (!map[name]) map[name] = { qty: 0, revenue: 0 };
      map[name].qty += qty;
      map[name].revenue += price * qty;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 20);
  })();

  // ─── 5. Employee ─────────────────────────────────────────────────────────
  const employeeData = (() => {
    const map: Record<string, { orders: Set<string>; subtotal: number }> = {};
    const orderSeen = new Set<string>();
    fr.forEach((r) => {
      const key = r.Name || "";
      const emp = r.Employee?.trim();
      if (!emp) return;
      if (!map[emp]) map[emp] = { orders: new Set(), subtotal: 0 };
      map[emp].orders.add(key);
      if (!orderSeen.has(key)) {
        orderSeen.add(key);
        map[emp].subtotal += parseSubtotal(r.Subtotal);
      }
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, orders: d.orders.size, subtotal: d.subtotal }))
      .sort((a, b) => b.subtotal - a.subtotal);
  })();

  // ─── Summary Stats ────────────────────────────────────────────────────────
  const totalRevenue = (() => {
    const seen = new Set<string>();
    return fr.reduce((s, r) => {
      if (!seen.has(r.Name || "")) {
        seen.add(r.Name || "");
        return s + parseSubtotal(r.Subtotal);
      }
      return s;
    }, 0);
  })();

  const totalOrders = new Set(fr.map(r => r.Name).filter(Boolean)).size;
  const totalDiscountUsed = new Set(
    fr.filter(r => r["Discount Code"]?.trim()).map(r => r.Name).filter(Boolean)
  ).size;

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Analytics Order</h1>
            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                id="shopify-import"
              />
              {importing ? (
                <span className="px-4 py-2 bg-gray-400 text-white rounded text-sm opacity-70 cursor-not-allowed">
                  Importing...
                </span>
              ) : (
                <>
                  <button
                    onClick={() => triggerImport("append")}
                    className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors"
                  >
                    + Tambah Data
                  </button>
                  <button
                    onClick={() => triggerImport("refresh")}
                    className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                  >
                    ↺ Refresh Semua
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: formatRupiah(totalRevenue), color: "text-green-600" },
              { label: "Total Orders", value: totalOrders.toLocaleString(), color: "text-blue-600" },
              { label: "Pakai Discount", value: totalDiscountUsed.toLocaleString(), color: "text-purple-600" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                >
                  <option value="all">All Stores</option>
                  {stores.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <button
                  onClick={() => {
                    setDateFrom(getFirstOfMonthStr());
                    setDateTo(getTodayStr());
                    setStoreFilter("all");
                  }}
                  className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 w-full"
                >
                  Reset Filter
                </button>
              </div>
            </div>

            {/* Data range info */}
            {dataDateRange && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-gray-400">📅 Data tersedia:</span>
                <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {formatDisplayDate(dataDateRange.min)} — {formatDisplayDate(dataDateRange.max)}
                </span>
                <span className="text-[10px] text-gray-400 ml-1">
                  (filter aktif: {formatDisplayDate(dateFrom) || "—"} s/d {formatDisplayDate(dateTo) || "—"})
                </span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex border-b overflow-x-auto">
              {CHART_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {loading ? (
                <div className="text-center py-16 text-gray-400">Loading data...</div>
              ) : fr.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg font-semibold">Belum ada data</p>
                  <p className="text-sm mt-1">Import CSV Shopify untuk mulai analitik</p>
                </div>
              ) : (
                <>
                  {/* ── Tab 1: Revenue per Store ─────────────────────────── */}
                  {activeTab === "store" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue per Store (IDR)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={revenueByStore} margin={{ top: 16, right: 8, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                            <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                            <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={48}>
                              {revenueByStore.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Store</h3>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={orderCountByStore.sort((a,b) => b.count - a.count)} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                            <Tooltip content={<DarkTooltip />} />
                            <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]} maxBarSize={48}>
                              {orderCountByStore.map((_, i) => (
                                <Cell key={i} fill={COLORS[(i + 5) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail per Store</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Orders</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revenueByStore.slice((pageStore - 1) * PAGE_SIZE, pageStore * PAGE_SIZE).map((s, i) => {
                                const orders = orderCountByStore.find(o => o.name === s.name)?.count || 0;
                                return (
                                  <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="px-3 py-2">{s.name}</td>
                                    <td className="px-3 py-2 text-right">{orders}</td>
                                    <td className="px-3 py-2 text-right">{formatRupiah(s.value)}</td>
                                    <td className="px-3 py-2 text-right">{orders ? formatRupiah(Math.round(s.value / orders)) : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <Pagination page={pageStore} total={revenueByStore.length} pageSize={PAGE_SIZE} onChange={setPageStore} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 2: Traffic Source ────────────────────────────── */}
                  {activeTab === "traffic" && (
                    <div className="space-y-8">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => setHideUnknownTraffic(v => !v)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${hideUnknownTraffic ? "bg-primary" : "bg-gray-300"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideUnknownTraffic ? "translate-x-4" : "translate-x-0.5"}`} />
                          </div>
                          <span className="text-xs text-gray-600">Sembunyikan <strong>"Tidak Diketahui"</strong> di bar chart</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Traffic Source</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={trafficDataForPie}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                label={(props) => (props.percent ?? 0) > 0.04 ? `${((props.percent ?? 0) * 100).toFixed(0)}%` : ""}
                                labelLine={false}
                              >
                                {trafficDataForPie.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const item = payload[0];
                                  const total = trafficDataForPie.reduce((s, d) => s + d.value, 0);
                                  const pct = total ? ((Number(item.value) / total) * 100).toFixed(1) : "0";
                                  return (
                                    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 180 }}>
                                      <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{item.name}</p>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Jumlah Order</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: item.payload?.fill || "#60a5fa" }}>{Number(item.value).toLocaleString()}</span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
                                        <span style={{ fontSize: 11, color: "#94a3b8" }}>Persentase</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{pct}%</span>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <PieLegend
                            data={trafficDataForPie.map((d, i) => ({
                              name: d.name,
                              value: d.value,
                              color: COLORS[i % COLORS.length],
                            }))}
                          />
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Traffic</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={(hideUnknownTraffic ? trafficData.filter(d => d.name !== "Tidak Diketahui") : trafficData).slice(0, 12)}
                              layout="vertical"
                              margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                              <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={130} />
                              <Tooltip content={<DarkTooltip />} />
                              <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]} maxBarSize={20}
                                label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                {(hideUnknownTraffic ? trafficData.filter(d => d.name !== "Tidak Diketahui") : trafficData).slice(0, 12).map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Traffic Source</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Traffic Source</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Jumlah Order</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Persentase</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const total = trafficData.reduce((s, d) => s + d.value, 0);
                                return trafficData.slice((pageTraffic - 1) * PAGE_SIZE, pageTraffic * PAGE_SIZE).map((t, i) => {
                                  const globalIdx = (pageTraffic - 1) * PAGE_SIZE + i;
                                  return (
                                    <tr key={i} className="border-b hover:bg-gray-50">
                                      <td className="px-3 py-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[globalIdx % COLORS.length] }} />
                                        {t.name}
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium">{t.value}</td>
                                      <td className="px-3 py-2 text-right text-gray-500">
                                        {total ? `${((t.value / total) * 100).toFixed(1)}%` : "-"}
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                          <Pagination page={pageTraffic} total={trafficData.length} pageSize={PAGE_SIZE} onChange={setPageTraffic} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 3: Discount Code ─────────────────────────────── */}
                  {activeTab === "discount" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Penggunaan Discount Code (Top 20)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={discountData} margin={{ top: 16, right: 8, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                            <Tooltip content={<DarkTooltip />} />
                            <Bar dataKey="count" name="Pakai" radius={[4, 4, 0, 0]} maxBarSize={40}
                              label={{ position: "top", fontSize: 9, fill: "#6b7280" }}>
                              {discountData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Discount Amount per Kode</h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={discountData} margin={{ top: 16, right: 8, left: 0, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                            <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                            <Bar dataKey="total" name="Total Diskon" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#8b5cf6">
                              {discountData.map((_, i) => (
                                <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Discount Code</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Discount Code</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Dipakai (Order)</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Potongan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {discountData.slice((pageDiscount - 1) * PAGE_SIZE, pageDiscount * PAGE_SIZE).map((d, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono">{d.name}</td>
                                  <td className="px-3 py-2 text-right">{d.count}</td>
                                  <td className="px-3 py-2 text-right">{formatRupiah(d.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Pagination page={pageDiscount} total={discountData.length} pageSize={PAGE_SIZE} onChange={setPageDiscount} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 4: Product Sales ─────────────────────────────── */}
                  {activeTab === "product" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 20 Produk Terjual (by Quantity)</h3>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart
                            data={productData}
                            layout="vertical"
                            margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                            <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tick={{ fontSize: 9, fill: "#6b7280" }}
                              width={200}
                              tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + "…" : v}
                            />
                            <Tooltip content={<DarkTooltip />} />
                            <Bar dataKey="qty" name="Qty Terjual" radius={[0, 4, 4, 0]} maxBarSize={18}
                              label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                              {productData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 20 Produk berdasarkan Revenue</h3>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart
                            data={[...productData].sort((a, b) => b.revenue - a.revenue).slice(0, 20)}
                            layout="vertical"
                            margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                            <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : `${(v/1e3).toFixed(0)}k`} />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tick={{ fontSize: 9, fill: "#6b7280" }}
                              width={200}
                              tickFormatter={(v: string) => v.length > 32 ? v.slice(0, 32) + "…" : v}
                            />
                            <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                            <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={18}>
                              {productData.map((_, i) => (
                                <Cell key={i} fill={COLORS[(i + 7) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Produk Terjual</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Produk</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty Terjual</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productData.slice((pageProduct - 1) * PAGE_SIZE, pageProduct * PAGE_SIZE).map((p, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2">{p.name}</td>
                                  <td className="px-3 py-2 text-right">{p.qty}</td>
                                  <td className="px-3 py-2 text-right">{formatRupiah(p.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Pagination page={pageProduct} total={productData.length} pageSize={PAGE_SIZE} onChange={setPageProduct} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab 5: Employee ──────────────────────────────────── */}
                  {activeTab === "employee" && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue yang Ditangani per Karyawan</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={employeeData} margin={{ top: 16, right: 8, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v} width={50} />
                            <Tooltip content={<DarkTooltip formatter={formatRupiah} />} />
                            <Bar dataKey="subtotal" name="Revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                              {employeeData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah Order per Karyawan</h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={employeeData} margin={{ top: 16, right: 8, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                            <Tooltip content={<DarkTooltip />} />
                            <Bar dataKey="orders" name="Orders" radius={[4, 4, 0, 0]} maxBarSize={40}
                              label={{ position: "top", fontSize: 9, fill: "#6b7280" }}>
                              {employeeData.map((_, i) => (
                                <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Karyawan</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 border-b">
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Karyawan</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Jumlah Order</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Revenue</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employeeData.slice((pageEmployee - 1) * PAGE_SIZE, pageEmployee * PAGE_SIZE).map((e, i) => (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2">{e.name}</td>
                                  <td className="px-3 py-2 text-right">{e.orders}</td>
                                  <td className="px-3 py-2 text-right">{formatRupiah(e.subtotal)}</td>
                                  <td className="px-3 py-2 text-right">
                                    {e.orders ? formatRupiah(Math.round(e.subtotal / e.orders)) : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Pagination page={pageEmployee} total={employeeData.length} pageSize={PAGE_SIZE} onChange={setPageEmployee} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Mode Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-gray-800 mb-1">
              {importMode === "append" ? "Tambah Data Baru" : "Refresh Semua Data"}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              {importMode === "append"
                ? "Data baru akan ditambahkan ke data yang sudah ada. Data lama tidak akan terhapus. Duplikat (berdasarkan Order Name) akan diabaikan."
                : "Semua data yang ada akan dihapus dan diganti dengan data dari file ini. Gunakan ini jika ingin reset total."}
            </p>

            {importMode === "refresh" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5 flex gap-2">
                <span className="text-red-500 text-sm mt-0.5">⚠️</span>
                <p className="text-xs text-red-600">
                  <strong>Perhatian:</strong> Seluruh data historis akan terhapus permanen dan diganti data dari file baru.
                </p>
              </div>
            )}

            {importMode === "append" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 flex gap-2">
                <span className="text-blue-500 text-sm mt-0.5">ℹ️</span>
                <p className="text-xs text-blue-600">
                  Data yang sudah ada akan tetap tersimpan. Hanya order baru yang akan ditambahkan.
                </p>
              </div>
            )}

            <label
              htmlFor="shopify-import"
              onClick={() => {}}
              className="block w-full text-center cursor-pointer px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors mb-3"
            >
              Pilih File CSV
            </label>
            <button
              onClick={() => { setShowImportModal(false); setImportMode(null); }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}