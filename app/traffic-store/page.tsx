"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend,
} from "recharts";

interface TrafficEntry {
  id: string;
  store_location: string;
  taft_name: string;
  customer_convert: string;
  traffic_source: string;
  wag_addition: string;
  eiger_addition: string;
  organic_addition: string;
  brand_competitor: string;
  intention: string;
  case: string;
  notes: string;
  sales_order: string;
  created_at: string;
  update_at: string;
  // formula columns from sheet (read-only, never written)
  value_order?: string;
  discount_code?: string;
}

interface MasterRow {
  store_location: string;
  taft_name: string;
  traffic_source: string;
  intention: string;
  case: string;
  wag_addition: string;
  eiger_addition: string;
  organic_addition: string;
  brand_competitor: string;
}

const COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
  "#14b8a6","#e11d48","#a855f7","#22c55e","#fb923c",
  "#0ea5e9","#d946ef","#facc15","#4ade80","#fb7185",
];

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

// ─── View Toggle ──────────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: "all" | "daily"; onChange: (v: "all" | "daily") => void }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {(["all", "daily"] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
          {v === "all" ? "All" : "Daily"}
        </button>
      ))}
    </div>
  );
}

// ─── Dark Tooltip ─────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.name || p.dataKey}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: p.fill || p.color || p.stroke || "#60a5fa" }}>
            {p.value?.toLocaleString?.() ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Pie Legend ───────────────────────────────────────────────────────────────
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

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatShortDate(isoOrDate: string): string {
  if (!isoOrDate) return "";
  const dateStr = isoOrDate.split("T")[0];
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatRupiah(val: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(val);
}

function parseValue(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
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
  taft_name: "",
  customer_convert: "",
  traffic_source: "",
  wag_addition: "",
  eiger_addition: "",
  organic_addition: "",
  brand_competitor: "",
  brand_custom: "",
  intention: "",
  case: "",
  notes: "",
  sales_order: "",
};

// ─── Export XLSX ──────────────────────────────────────────────────────────────
function exportReportXLSX(
  filteredData: TrafficEntry[],
  trafficData: { name: string; value: number }[],
  dateLabel: string
) {
  const wb = XLSX.utils.book_new();

  const allSources = [...new Set(filteredData.map(r => r.traffic_source).filter(Boolean))].sort();
  const allStores = [...new Set(filteredData.map(r => r.store_location).filter(Boolean))].sort();

  // Sheet 1: Summary Traffic Source
  const total = trafficData.reduce((s, d) => s + d.value, 0);
  const buyCount = filteredData.filter(r => r.customer_convert === "Beli").length;
  const notBuyCount = filteredData.filter(r => r.customer_convert === "Tidak Beli").length;
  const convRate = total ? `${((buyCount / total) * 100).toFixed(1)}%` : "0%";

  const summaryRows = [
    ["Traffic Source", "Jumlah", "Persentase"],
    ...trafficData.map(d => [d.name, d.value, total ? `${((d.value / total) * 100).toFixed(1)}%` : "0%"]),
    [],
    ["TOTAL", total, "100%"],
    [],
    ["Konversi", "", ""],
    ["Beli", buyCount, convRate],
    ["Tidak Beli", notBuyCount, total ? `${((notBuyCount / total) * 100).toFixed(1)}%` : "0%"],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Traffic Source");

  // Sheet 2: Store × Traffic Source Matrix
  const matrixMap: Record<string, Record<string, number>> = {};
  filteredData.forEach(r => {
    if (!matrixMap[r.store_location]) matrixMap[r.store_location] = {};
    matrixMap[r.store_location][r.traffic_source] = (matrixMap[r.store_location][r.traffic_source] || 0) + 1;
  });
  const matrixHeader = ["Store", ...allSources, "TOTAL"];
  const matrixRows = allStores.map(store => [
    toTitleCase(store),
    ...allSources.map(src => matrixMap[store]?.[src] || 0),
    allSources.reduce((s, src) => s + (matrixMap[store]?.[src] || 0), 0),
  ]);
  const matrixTotals = [
    "TOTAL",
    ...allSources.map(src => allStores.reduce((s, store) => s + (matrixMap[store]?.[src] || 0), 0)),
    allStores.reduce((s, store) => s + allSources.reduce((ss, src) => ss + (matrixMap[store]?.[src] || 0), 0), 0),
  ];
  const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeader, ...matrixRows, [], matrixTotals]);
  wsMatrix["!cols"] = [{ wch: 20 }, ...allSources.map(() => ({ wch: 16 })), { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Store vs Traffic");

  // Sheet 3: Conversion per Store
  const convRows = allStores.map(store => {
    const storeData = filteredData.filter(r => r.store_location === store);
    const b = storeData.filter(r => r.customer_convert === "Beli").length;
    const nb = storeData.filter(r => r.customer_convert === "Tidak Beli").length;
    const t = storeData.length;
    const rev = storeData.reduce((s, r) => s + parseValue(r.value_order), 0);
    return [toTitleCase(store), t, b, nb, t ? `${((b / t) * 100).toFixed(1)}%` : "0%", rev];
  });
  const wsConv = XLSX.utils.aoa_to_sheet([
    ["Store", "Total", "Beli", "Tidak Beli", "Conv. Rate", "Value Order (IDR)"],
    ...convRows,
  ]);
  wsConv["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsConv, "Konversi per Store");

  // Sheet 4: Discount Code Report
  const discountMap: Record<string, { count: number; value: number }> = {};
  filteredData.forEach(r => {
    if (r.discount_code) {
      if (!discountMap[r.discount_code]) discountMap[r.discount_code] = { count: 0, value: 0 };
      discountMap[r.discount_code].count += 1;
      discountMap[r.discount_code].value += parseValue(r.value_order);
    }
  });
  const discountRows = Object.entries(discountMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, d]) => [code, d.count, d.value, formatRupiah(d.value)]);
  const wsDiscount = XLSX.utils.aoa_to_sheet([
    ["Discount Code", "Jumlah Pemakai", "Total Value (IDR)", "Total Value (Rp)"],
    ...discountRows,
  ]);
  wsDiscount["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsDiscount, "Discount Code");

  // Sheet 5: WAG, Eiger & Organic Additions
  const wagMap: Record<string, number> = {};
  const eigerMap: Record<string, number> = {};
  const organicMap: Record<string, number> = {};
  filteredData.forEach(r => {
    if (r.wag_addition) wagMap[r.wag_addition] = (wagMap[r.wag_addition] || 0) + 1;
    if (r.eiger_addition) eigerMap[r.eiger_addition] = (eigerMap[r.eiger_addition] || 0) + 1;
    if (r.organic_addition) organicMap[r.organic_addition] = (organicMap[r.organic_addition] || 0) + 1;
  });
  const addRows = [
    ["WAG Addition", "Jumlah"],
    ...Object.entries(wagMap).sort((a, b) => b[1] - a[1]),
    [],
    ["Eiger Addition", "Jumlah"],
    ...Object.entries(eigerMap).sort((a, b) => b[1] - a[1]),
    [],
    ["Organic Addition", "Jumlah"],
    ...Object.entries(organicMap).sort((a, b) => b[1] - a[1]),
  ];
  const wsAdd = XLSX.utils.aoa_to_sheet(addRows);
  wsAdd["!cols"] = [{ wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsAdd, "WAG, Eiger & Organic");

  // Sheet 6: Brand Competitor
  const brandMap: Record<string, number> = {};
  filteredData.forEach(r => {
    if (r.brand_competitor) brandMap[r.brand_competitor] = (brandMap[r.brand_competitor] || 0) + 1;
  });
  const brandRows = [
    ["Brand Competitor", "Jumlah", "Persentase"],
    ...Object.entries(brandMap).sort((a, b) => b[1] - a[1]).map(([name, val]) => [
      name, val, total ? `${((val / total) * 100).toFixed(1)}%` : "0%"
    ]),
  ];
  const wsBrand = XLSX.utils.aoa_to_sheet(brandRows);
  wsBrand["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsBrand, "Brand Competitor");

  // Sheet 7: Daily Trend
  const dailyMap: Record<string, Record<string, number>> = {};
  filteredData.forEach(r => {
    const date = r.created_at?.split("T")[0];
    if (!date) return;
    if (!dailyMap[date]) dailyMap[date] = {};
    dailyMap[date][r.traffic_source] = (dailyMap[date][r.traffic_source] || 0) + 1;
  });
  const dailyHeader = ["Tanggal", ...allSources, "TOTAL"];
  const dailyRows = Object.keys(dailyMap).sort().map(date => [
    date,
    ...allSources.map(src => dailyMap[date]?.[src] || 0),
    allSources.reduce((s, src) => s + (dailyMap[date]?.[src] || 0), 0),
  ]);
  const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeader, ...dailyRows]);
  wsDaily["!cols"] = [{ wch: 14 }, ...allSources.map(() => ({ wch: 16 })), { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDaily, "Daily Trend");

  // Sheet 8: Raw Data
  const rawHeader = ["Tanggal", "Store", "Taft", "Beli?", "Sales Order", "Traffic Source", "WAG Addition", "Eiger Addition", "Organic Addition", "Brand Competitor", "Intensi", "Case", "Notes", "Value Order", "Discount Code"];
  const rawRows = filteredData.map(r => [
    formatDate(r.created_at),
    toTitleCase(r.store_location),
    r.taft_name,
    r.customer_convert,
    r.sales_order || "",
    r.traffic_source,
    r.wag_addition,
    r.eiger_addition,
    r.organic_addition,
    r.brand_competitor,
    r.intention,
    r.case,
    r.notes,
    r.value_order || "",
    r.discount_code || "",
  ]);
  const wsRaw = XLSX.utils.aoa_to_sheet([rawHeader, ...rawRows]);
  wsRaw["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsRaw, "Raw Data");

  const filename = `Traffic_Store_Report_${dateLabel || Date.now()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

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
  const [filterTraffic, setFilterTraffic] = useState("all");
  const [filterConvert, setFilterConvert] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Report view toggle
  const [chartView, setChartView] = useState<"all" | "daily">("all");
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

  // ─── Derive user's store ────────────────────────────────────────────────────
  const userStore = useMemo(() => {
    if (!user || master.length === 0) return null;
    const username = user.user_name?.toLowerCase().trim() || "";
    const masterStores = [...new Set(master.map(m => m.store_location).filter(Boolean))];
    const exactMatch = masterStores.find(s => s.toLowerCase().trim() === username);
    if (exactMatch) return exactMatch;
    const partialMatch = masterStores.find(
      s => username.includes(s.toLowerCase().trim()) || s.toLowerCase().trim().includes(username)
    );
    if (partialMatch) return partialMatch;
    const storeKeys = Object.keys(STORE_NAME_MAP);
    const mapMatch = storeKeys.find(
      k => username === k || username === k.replace(/\s/g, "") || username.includes(k)
    );
    return mapMatch || null;
  }, [user, master]);

  const isStoreUser = useMemo(
    () => !!userStore && !!user?.traffic_store && !user?.report_store,
    [userStore, user]
  );

  const taftsForStore = useMemo(() => {
    if (!userStore) return [];
    return master
      .filter(m => m.store_location?.toLowerCase().trim() === userStore.toLowerCase().trim())
      .map(m => m.taft_name)
      .filter(Boolean);
  }, [master, userStore]);

  const trafficSources = useMemo(
    () => [...new Set(master.map(m => m.traffic_source).filter(Boolean))],
    [master]
  );
  const intentions = useMemo(
    () => [...new Set(master.map(m => m.intention).filter(Boolean))],
    [master]
  );
  const wagAdditions = useMemo(
    () => [...new Set(master.map(m => m.wag_addition).filter(Boolean))],
    [master]
  );
  const eigerAdditions = useMemo(
    () => [...new Set(master.map(m => m.eiger_addition).filter(Boolean))],
    [master]
  );
  const organicAdditions = useMemo(
    () => [...new Set(master.map(m => m.organic_addition).filter(Boolean))],
    [master]
  );
  const brandCompetitors = useMemo(
    () => [...new Set(master.map(m => m.brand_competitor).filter(Boolean))],
    [master]
  );
  const casesForIntention = useMemo(() => {
    if (!form.intention) return [];
    return [...new Set(
      master.filter(m => m.intention === form.intention).map(m => m.case).filter(Boolean)
    )];
  }, [master, form.intention]);

  const allStores = useMemo(
    () => [...new Set(master.map(m => m.store_location).filter(Boolean))].sort(),
    [master]
  );

  // ─── Filtered data ──────────────────────────────────────────────────────────
  const filteredData = useCallback(() => {
    let rows = data.filter(r => r.id);
    if (isStoreUser && userStore) {
      rows = rows.filter(r => r.store_location?.toLowerCase().trim() === userStore.toLowerCase().trim());
    }
    if (filterStore !== "all" && !isStoreUser) {
      rows = rows.filter(r => r.store_location?.toLowerCase() === filterStore.toLowerCase());
    }
    if (filterTraffic !== "all") rows = rows.filter(r => r.traffic_source === filterTraffic);
    if (filterConvert !== "all") rows = rows.filter(r => r.customer_convert === filterConvert);
    if (filterDateFrom) rows = rows.filter(r => r.created_at >= filterDateFrom);
    if (filterDateTo) rows = rows.filter(r => r.created_at <= filterDateTo + "T23:59:59");
    return rows;
  }, [data, filterStore, filterTraffic, filterConvert, filterDateFrom, filterDateTo, isStoreUser, userStore]);

  const fd = filteredData();
  const paginated = fd.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Chart data ─────────────────────────────────────────────────────────────
  const trafficChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => {
      const src = r.traffic_source?.trim();
      if (!src) return;
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  const conversionData = useMemo(() => {
    const beli = fd.filter(r => r.customer_convert === "Beli").length;
    const tidakBeli = fd.filter(r => r.customer_convert === "Tidak Beli").length;
    return [
      { name: "Beli", value: beli },
      { name: "Tidak Beli", value: tidakBeli },
    ].filter(d => d.value > 0);
  }, [fd]);

  const conversionByTraffic = useMemo(() => {
    const map: Record<string, { beli: number; tidakBeli: number }> = {};
    fd.forEach(r => {
      const src = r.traffic_source?.trim();
      if (!src) return;
      if (!map[src]) map[src] = { beli: 0, tidakBeli: 0 };
      if (r.customer_convert === "Beli") map[src].beli++;
      else if (r.customer_convert === "Tidak Beli") map[src].tidakBeli++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, beli: v.beli, tidakBeli: v.tidakBeli, total: v.beli + v.tidakBeli }))
      .sort((a, b) => b.total - a.total);
  }, [fd]);

  const wagChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => { if (r.wag_addition) map[r.wag_addition] = (map[r.wag_addition] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  const eigerChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => { if (r.eiger_addition) map[r.eiger_addition] = (map[r.eiger_addition] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  const organicChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => { if (r.organic_addition) map[r.organic_addition] = (map[r.organic_addition] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  const brandChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => { if (r.brand_competitor) map[r.brand_competitor] = (map[r.brand_competitor] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  const storeTrafficMatrix = useMemo(() => {
    const stores = [...new Set(fd.map(r => r.store_location).filter(Boolean))].sort();
    const sources = [...new Set(fd.map(r => r.traffic_source).filter(Boolean))].sort();
    const map: Record<string, Record<string, number>> = {};
    fd.forEach(r => {
      if (!map[r.store_location]) map[r.store_location] = {};
      map[r.store_location][r.traffic_source] = (map[r.store_location][r.traffic_source] || 0) + 1;
    });
    const barData = stores.map(store => ({
      name: toTitleCase(store),
      total: sources.reduce((s, src) => s + (map[store]?.[src] || 0), 0),
      beli: fd.filter(r => r.store_location === store && r.customer_convert === "Beli").length,
      tidakBeli: fd.filter(r => r.store_location === store && r.customer_convert === "Tidak Beli").length,
      ...sources.reduce((acc, src) => ({ ...acc, [src]: map[store]?.[src] || 0 }), {}),
    })).sort((a, b) => b.total - a.total);
    return { stores, sources, map, barData };
  }, [fd]);

  const intentionData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => {
      const intent = r.intention?.trim();
      if (!intent) return;
      map[intent] = (map[intent] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  // ─── Discount code chart data ────────────────────────────────────────────────
  const discountChartData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    fd.forEach(r => {
      if (!r.discount_code) return;
      if (!map[r.discount_code]) map[r.discount_code] = { count: 0, value: 0 };
      map[r.discount_code].count += 1;
      map[r.discount_code].value += parseValue(r.value_order);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, value: d.value }))
      .sort((a, b) => b.count - a.count);
  }, [fd]);

  // ─── Value order stats ───────────────────────────────────────────────────────
  const valueOrderStats = useMemo(() => {
    const beliRows = fd.filter(r => r.customer_convert === "Beli");
    const totalValue = beliRows.reduce((s, r) => s + parseValue(r.value_order), 0);
    const avgValue = beliRows.length ? totalValue / beliRows.length : 0;
    return { totalValue, avgValue, beliCount: beliRows.length };
  }, [fd]);

  const dailyTrafficChartData = useMemo(() => {
    const top6 = trafficChartData.slice(0, 6).map(d => d.name);
    const map: Record<string, Record<string, number>> = {};
    fd.forEach(r => {
      const date = r.created_at?.split("T")[0];
      if (!date) return;
      const src = r.traffic_source?.trim() || "Lainnya";
      if (!map[date]) map[date] = {};
      map[date][src] = (map[date][src] || 0) + 1;
    });
    const chartData = Object.keys(map).sort().map(date => ({
      date: formatShortDate(date),
      fullDate: date,
      ...top6.reduce((acc, t) => ({ ...acc, [t]: map[date]?.[t] || 0 }), {}),
    }));
    return { chartData, top6 };
  }, [fd, trafficChartData]);

  const dailyStoreChartData = useMemo(() => {
    const storeNames = [...new Set(fd.map(r => r.store_location).filter(Boolean))].sort();
    const map: Record<string, Record<string, number>> = {};
    fd.forEach(r => {
      const date = r.created_at?.split("T")[0];
      if (!date) return;
      if (!map[date]) map[date] = {};
      map[date][r.store_location] = (map[date][r.store_location] || 0) + 1;
    });
    const chartData = Object.keys(map).sort().map(date => ({
      date: formatShortDate(date),
      fullDate: date,
      ...storeNames.reduce((acc, s) => ({ ...acc, [s]: map[date]?.[s] || 0 }), {}),
    }));
    return { chartData, storeNames };
  }, [fd]);

  const dailyConversionData = useMemo(() => {
    const map: Record<string, { beli: number; tidakBeli: number }> = {};
    fd.forEach(r => {
      const date = r.created_at?.split("T")[0];
      if (!date) return;
      if (!map[date]) map[date] = { beli: 0, tidakBeli: 0 };
      if (r.customer_convert === "Beli") map[date].beli++;
      else if (r.customer_convert === "Tidak Beli") map[date].tidakBeli++;
    });
    return Object.keys(map).sort().map(date => ({
      date: formatShortDate(date),
      Beli: map[date].beli,
      "Tidak Beli": map[date].tidakBeli,
    }));
  }, [fd]);

  // Summary stats
  const totalEntries = fd.length;
  const totalStores = new Set(fd.map(r => r.store_location).filter(Boolean)).size;
  const topTraffic = trafficChartData[0]?.name || "-";
  const totalBeli = fd.filter(r => r.customer_convert === "Beli").length;
  const convRate = totalEntries ? `${((totalBeli / totalEntries) * 100).toFixed(1)}%` : "0%";

  const handleExportXLSX = () => {
    if (fd.length === 0) { showMessage("Tidak ada data untuk diexport", "error"); return; }
    const dateLabel = filterDateFrom || filterDateTo
      ? `${filterDateFrom || "all"}_to_${filterDateTo || "all"}`
      : new Date().toISOString().split("T")[0];
    exportReportXLSX(fd, trafficChartData, dateLabel);
    showMessage("Export berhasil!", "success");
  };

  const openAdd = () => {
    setEditEntry(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (entry: TrafficEntry) => {
    setEditEntry(entry);
    const isCustomBrand = entry.brand_competitor && !brandCompetitors.includes(entry.brand_competitor) && entry.brand_competitor !== "Lainnya";
    setForm({
      taft_name: entry.taft_name,
      customer_convert: entry.customer_convert || "",
      traffic_source: entry.traffic_source,
      wag_addition: entry.wag_addition || "",
      eiger_addition: entry.eiger_addition || "",
      organic_addition: entry.organic_addition || "",
      brand_competitor: isCustomBrand ? "Lainnya" : (entry.brand_competitor || ""),
      brand_custom: isCustomBrand ? entry.brand_competitor : "",
      intention: entry.intention,
      case: entry.case,
      notes: entry.notes,
      sales_order: entry.sales_order || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const needsWag = form.traffic_source === "Whatsapp Group" && !form.wag_addition;
    const needsEiger = form.traffic_source === "Dari Eiger" && !form.eiger_addition;
    const needsOrganic = form.traffic_source === "Traffic Organic/Walk In" && !form.organic_addition;
    const needsSalesOrder = form.customer_convert === "Beli" && !form.sales_order?.trim();
    // ─── Validasi format Sales Order: harus diawali # diikuti angka, misal #4098769 ───
    const invalidSalesOrder =
      form.customer_convert === "Beli" &&
      !!form.sales_order?.trim() &&
      !/^#\d+$/.test(form.sales_order.trim());
    const needsNotes = form.customer_convert === "Tidak Beli" && !form.notes?.trim();

    if (!form.taft_name || !form.traffic_source || !form.intention || !form.case || !form.customer_convert) {
      showMessage("Taft, Status Beli, Traffic Source, Intensi, dan Case wajib diisi", "error"); return;
    }
    if (needsWag) { showMessage("Pilih WAG Addition terlebih dahulu", "error"); return; }
    if (needsEiger) { showMessage("Pilih Eiger Addition terlebih dahulu", "error"); return; }
    if (needsOrganic) { showMessage("Pilih Organic Addition terlebih dahulu", "error"); return; }
    if (needsSalesOrder) { showMessage("Sales Order wajib diisi ketika customer membeli", "error"); return; }
    if (invalidSalesOrder) {
      showMessage("Format Sales Order tidak valid. Gunakan format #angka, contoh: #4098769", "error"); return;
    }
    if (needsNotes) { showMessage("Notes wajib diisi ketika customer tidak membeli", "error"); return; }

    setSaving(true);
    try {
      const storeLocation = userStore || (filterStore !== "all" ? filterStore : "");
      if (!storeLocation && !editEntry) {
        showMessage("Store tidak dikenali", "error"); setSaving(false); return;
      }
      const finalBrand = form.brand_competitor === "Lainnya"
        ? (form.brand_custom?.trim() || "Lainnya")
        : form.brand_competitor;
      const payload = { ...form, brand_competitor: finalBrand };
      delete (payload as any).brand_custom;

      if (editEntry) {
        const res = await fetch("/api/traffic-store", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editEntry.id, ...payload, case: form.case }),
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
            ...payload,
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

  const exportList = () => {
    const headers = ["ID", "Store", "Taft", "Beli?", "Sales Order", "Traffic Source", "WAG Addition", "Eiger Addition", "Organic Addition", "Brand Competitor", "Intensi", "Case", "Notes", "Value Order", "Discount Code", "Tanggal"];
    const rows = fd.map(r => [
      r.id, r.store_location, r.taft_name, r.customer_convert,
      r.sales_order || "",
      r.traffic_source, r.wag_addition, r.eiger_addition, r.organic_addition,
      r.brand_competitor, r.intention, r.case, r.notes,
      r.value_order || "", r.discount_code || "",
      formatDate(r.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Traffic_Store_List_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  // ─── Shared Filter Bar ────────────────────────────────────────────────────
  const FilterBar = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Status Beli</label>
          <select value={filterConvert} onChange={e => { setFilterConvert(e.target.value); setPage(1); }}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">Semua</option>
            <option value="Beli">Beli</option>
            <option value="Tidak Beli">Tidak Beli</option>
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
          <button onClick={() => { setFilterStore("all"); setFilterTraffic("all"); setFilterConvert("all"); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); }}
            className="w-full px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">
            Reset Filter
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{fd.length} data ditemukan</p>
    </div>
  );

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
              {activeTab === "list" && (
                <button onClick={exportList}
                  className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors">
                  ↓ Export List CSV
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

          {/* Tabs */}
          {user?.report_store && (
            <div className="flex gap-1 mb-4 border-b">
              {[
                { id: "list", label: "Data List" },
                { id: "report", label: "Report" },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className={`px-5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === t.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Shared filter bar */}
          <FilterBar />

          {/* ── LIST TAB ── */}
          {activeTab === "list" && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-400">Loading...</div>
                ) : fd.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">Belum ada data traffic</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Tanggal</th>
                            {!isStoreUser && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Store</th>}
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Taft</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Beli?</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Sales Order</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Traffic Source</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Detail</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Brand</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Intensi</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Case</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Notes</th>
                            {user?.traffic_store && <th className="px-2 py-1.5 text-center font-semibold text-gray-700">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map((row, i) => {
                            const detail = row.traffic_source === "Whatsapp Group"
                              ? row.wag_addition
                              : row.traffic_source === "Dari Eiger"
                              ? row.eiger_addition
                              : row.traffic_source === "Traffic Organic/Walk In"
                              ? row.organic_addition
                              : "";
                            return (
                              <tr key={row.id || i} className="border-b hover:bg-gray-50">
                                <td className="px-2 py-1 whitespace-nowrap text-gray-500">{formatDate(row.created_at)}</td>
                                {!isStoreUser && <td className="px-2 py-1 font-medium">{toTitleCase(row.store_location)}</td>}
                                <td className="px-2 py-1">{row.taft_name}</td>
                                <td className="px-2 py-1">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                    row.customer_convert === "Beli"
                                      ? "bg-green-50 text-green-700"
                                      : row.customer_convert === "Tidak Beli"
                                      ? "bg-red-50 text-red-600"
                                      : "bg-gray-50 text-gray-400"
                                  }`}>
                                    {row.customer_convert || "-"}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-gray-600 font-mono text-[10px]">
                                  {row.sales_order || "-"}
                                </td>
                                <td className="px-2 py-1">
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-medium">
                                    {row.traffic_source}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-gray-500">{detail || "-"}</td>
                                <td className="px-2 py-1 text-gray-500">{row.brand_competitor || "-"}</td>
                                <td className="px-2 py-1 text-gray-600">{row.intention || "-"}</td>
                                <td className="px-2 py-1 text-gray-600">{row.case || "-"}</td>
                                <td className="px-2 py-1 text-gray-500 max-w-[120px] truncate">{row.notes || "-"}</td>
                                {user?.traffic_store && (
                                  <td className="px-2 py-1 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => openEdit(row)}
                                        className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                                        Edit
                                      </button>
                                      <button onClick={() => handleDelete(row.id)}
                                        className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100">
                                        Hapus
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
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
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {[
                  { label: "Total Data", value: totalEntries.toLocaleString(), color: "text-blue-600" },
                  { label: "Jumlah Store", value: totalStores.toLocaleString(), color: "text-purple-600" },
                  { label: "Total Beli", value: totalBeli.toLocaleString(), color: "text-green-600" },
                  { label: "Conv. Rate", value: convRate, color: "text-orange-600" },
                  { label: "Total Value Beli", value: formatRupiah(valueOrderStats.totalValue), color: "text-teal-600" },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-lg shadow p-4">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className={`text-xl font-bold truncate ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart Card */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b">
                  <h2 className="text-sm font-semibold text-gray-700">Analitik Survey Store</h2>
                  <div className="flex items-center gap-3">
                    {!loading && fd.length > 0 && (
                      <>
                        <ViewToggle view={chartView} onChange={setChartView} />
                        <button onClick={handleExportXLSX}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export XLSX
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-16 text-gray-400">Loading data...</div>
                  ) : fd.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <p className="text-lg font-semibold">Belum ada data</p>
                      <p className="text-sm mt-1">Tambah data traffic untuk melihat laporan</p>
                    </div>
                  ) : (
                    <div className="space-y-10">

                      {/* ── ALL VIEW ── */}
                      {chartView === "all" && (
                        <>
                          {/* Pie + Bar: Traffic Source */}
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Survey Source</h3>
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie data={trafficChartData} dataKey="value" nameKey="name"
                                    cx="50%" cy="50%" outerRadius={110}
                                    label={(props) => (props.percent ?? 0) > 0.04
                                      ? `${((props.percent ?? 0) * 100).toFixed(0)}%` : ""}
                                    labelLine={false}>
                                    {trafficChartData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const item = payload[0];
                                    const total = trafficChartData.reduce((s, d) => s + d.value, 0);
                                    const pct = total ? ((Number(item.value) / total) * 100).toFixed(1) : "0";
                                    return (
                                      <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 180 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{item.name}</p>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Jumlah</span>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: item.payload?.fill || "#60a5fa" }}>{Number(item.value).toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
                                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Persentase</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{pct}%</span>
                                        </div>
                                      </div>
                                    );
                                  }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <PieLegend data={trafficChartData.map((d, i) => ({ name: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} />
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Jumlah per Survey Source</h3>
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={trafficChartData.slice(0, 12)}
                                  layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                  <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={130} />
                                  <Tooltip content={<DarkTooltip />} />
                                  <Bar dataKey="value" name="Jumlah" radius={[0, 4, 4, 0]} maxBarSize={20}
                                    label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                    {trafficChartData.slice(0, 12).map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Conversion Pie + Bar by Traffic */}
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Konversi Pembelian</h3>
                              <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                  <Pie data={conversionData} dataKey="value" nameKey="name"
                                    cx="50%" cy="50%" outerRadius={100}
                                    label={(props) => (props.percent ?? 0) > 0.04
                                      ? `${props.name}: ${((props.percent ?? 0) * 100).toFixed(0)}%` : ""}
                                    labelLine={false}>
                                    {conversionData.map((d, i) => (
                                      <Cell key={i} fill={d.name === "Beli" ? "#10b981" : "#ef4444"} />
                                    ))}
                                  </Pie>
                                  <Tooltip content={<DarkTooltip />} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="flex justify-center gap-6 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-sm bg-green-500" />
                                  <span className="text-xs text-gray-500">Beli: <strong>{conversionData.find(d => d.name === "Beli")?.value || 0}</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-sm bg-red-500" />
                                  <span className="text-xs text-gray-500">Tidak Beli: <strong>{conversionData.find(d => d.name === "Tidak Beli")?.value || 0}</strong></span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Konversi per Survey Source</h3>
                              <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={conversionByTraffic.slice(0, 8)}
                                  margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                  <Tooltip content={<DarkTooltip />} />
                                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                  <Bar dataKey="beli" name="Beli" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} stackId="a" />
                                  <Bar dataKey="tidakBeli" name="Tidak Beli" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} stackId="a" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Total per Store */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Survey per Store</h3>
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={storeTrafficMatrix.barData}
                                margin={{ top: 16, right: 8, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                <Bar dataKey="beli" name="Beli" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} stackId="b" />
                                <Bar dataKey="tidakBeli" name="Tidak Beli" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={40} stackId="b"
                                  label={{ position: "top", fontSize: 9, fill: "#6b7280" }} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {/* ── Discount Code Section ── */}
                          {discountChartData.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Discount Code — Pemakai & Value</h3>
                              <div className="grid grid-cols-2 gap-8">
                                {/* Bar: jumlah pemakai */}
                                <div>
                                  <p className="text-xs text-gray-500 mb-3">Jumlah Pemakai</p>
                                  <ResponsiveContainer width="100%" height={Math.max(200, discountChartData.length * 36)}>
                                    <BarChart data={discountChartData.slice(0, 12)}
                                      layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                      <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={120} />
                                      <Tooltip content={<DarkTooltip />} />
                                      <Bar dataKey="count" name="Pemakai" radius={[0, 4, 4, 0]} maxBarSize={22}
                                        label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                        {discountChartData.map((_, i) => (
                                          <Cell key={i} fill={COLORS[(i + 6) % COLORS.length]} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>

                                {/* Table: discount detail */}
                                <div>
                                  <p className="text-xs text-gray-500 mb-3">Detail per Kode</p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-gray-50 border-b">
                                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Kode Discount</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Pemakai</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Total Value</th>
                                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Avg/Pemakai</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {discountChartData.map((d, i) => (
                                          <tr key={i} className="border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: COLORS[(i + 6) % COLORS.length] }} />
                                              <span className="font-mono font-medium">{d.name}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold text-blue-700">{d.count}</td>
                                            <td className="px-3 py-2 text-right text-green-700 font-semibold">{formatRupiah(d.value)}</td>
                                            <td className="px-3 py-2 text-right text-gray-500">{formatRupiah(d.count ? d.value / d.count : 0)}</td>
                                          </tr>
                                        ))}
                                        <tr className="bg-primary/5 font-bold border-t-2">
                                          <td className="px-3 py-2 text-primary">TOTAL</td>
                                          <td className="px-3 py-2 text-right text-primary">
                                            {discountChartData.reduce((s, d) => s + d.count, 0)}
                                          </td>
                                          <td className="px-3 py-2 text-right text-green-700">
                                            {formatRupiah(discountChartData.reduce((s, d) => s + d.value, 0))}
                                          </td>
                                          <td className="px-3 py-2" />
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Brand Competitor + WAG/Eiger/Organic */}
                          {(brandChartData.length > 0 || wagChartData.length > 0 || eigerChartData.length > 0 || organicChartData.length > 0) && (
                            <div className="grid grid-cols-2 gap-8">
                              {brandChartData.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Brand Competitor (Pernah Beli Di)</h3>
                                  <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={brandChartData.slice(0, 10)}
                                      layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                      <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} width={100} />
                                      <Tooltip content={<DarkTooltip />} />
                                      <Bar dataKey="value" name="Jumlah" radius={[0, 4, 4, 0]} maxBarSize={20}
                                        label={{ position: "right", fontSize: 9, fill: "#6b7280" }}>
                                        {brandChartData.map((_, i) => (
                                          <Cell key={i} fill={COLORS[(i + 8) % COLORS.length]} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              <div className="space-y-6">
                                {wagChartData.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Whatsapp Group</h3>
                                    <div className="space-y-1.5">
                                      {wagChartData.map((d, i) => {
                                        const wagTotal = wagChartData.reduce((s, x) => s + x.value, 0);
                                        const pct = wagTotal ? ((d.value / wagTotal) * 100).toFixed(0) : 0;
                                        return (
                                          <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600 w-32 truncate">{d.name}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                              <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.value}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {eigerChartData.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Dari Eiger</h3>
                                    <div className="space-y-1.5">
                                      {eigerChartData.map((d, i) => {
                                        const eigerTotal = eigerChartData.reduce((s, x) => s + x.value, 0);
                                        const pct = eigerTotal ? ((d.value / eigerTotal) * 100).toFixed(0) : 0;
                                        return (
                                          <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600 w-32 truncate">{d.name}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                              <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[(i + 4) % COLORS.length] }} />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.value}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {organicChartData.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Traffic Organic/Walk In</h3>
                                    <div className="space-y-1.5">
                                      {organicChartData.map((d, i) => {
                                        const organicTotal = organicChartData.reduce((s, x) => s + x.value, 0);
                                        const pct = organicTotal ? ((d.value / organicTotal) * 100).toFixed(0) : 0;
                                        return (
                                          <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600 w-32 truncate">{d.name}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                              <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[(i + 12) % COLORS.length] }} />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.value}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Intention breakdown */}
                          {intentionData.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Intensi Kunjungan</h3>
                              <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={intentionData} margin={{ top: 16, right: 8, left: 0, bottom: 40 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-30} textAnchor="end" interval={0} />
                                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                  <Tooltip content={<DarkTooltip />} />
                                  <Bar dataKey="value" name="Jumlah" radius={[4, 4, 0, 0]} maxBarSize={48}
                                    label={{ position: "top", fontSize: 9, fill: "#6b7280" }}>
                                    {intentionData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[(i + 10) % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Detail table: Store × Source */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Store × Survey Source</h3>
                            <div className="overflow-x-auto">
                              <table className="text-xs border-collapse">
                                <thead>
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold bg-gray-50 border border-gray-200 whitespace-nowrap">Store</th>
                                    {storeTrafficMatrix.sources.map(src => (
                                      <th key={src} className="px-3 py-2 text-center font-semibold bg-gray-50 border border-gray-200 whitespace-nowrap min-w-[90px]">{src}</th>
                                    ))}
                                    <th className="px-3 py-2 text-center font-semibold bg-green-50 border border-gray-200 whitespace-nowrap">Beli</th>
                                    <th className="px-3 py-2 text-center font-semibold bg-red-50 border border-gray-200 whitespace-nowrap">Tdk Beli</th>
                                    <th className="px-3 py-2 text-center font-semibold bg-primary/10 border border-gray-200 whitespace-nowrap">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {storeTrafficMatrix.stores.map((store, i) => {
                                    const rowTotal = storeTrafficMatrix.sources.reduce((s, src) => s + (storeTrafficMatrix.map[store]?.[src] || 0), 0);
                                    const storeBeli = fd.filter(r => r.store_location === store && r.customer_convert === "Beli").length;
                                    const storeTidak = fd.filter(r => r.store_location === store && r.customer_convert === "Tidak Beli").length;
                                    return (
                                      <tr key={store} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-3 py-2 font-medium border border-gray-200 whitespace-nowrap">{toTitleCase(store)}</td>
                                        {storeTrafficMatrix.sources.map(src => {
                                          const val = storeTrafficMatrix.map[store]?.[src] || 0;
                                          return (
                                            <td key={src} className="px-3 py-2 text-center border border-gray-200">
                                              {val > 0 ? <span className="font-semibold text-blue-700">{val}</span> : <span className="text-gray-300">-</span>}
                                            </td>
                                          );
                                        })}
                                        <td className="px-3 py-2 text-center border border-gray-200 font-semibold text-green-700 bg-green-50/50">{storeBeli || "-"}</td>
                                        <td className="px-3 py-2 text-center border border-gray-200 font-semibold text-red-600 bg-red-50/50">{storeTidak || "-"}</td>
                                        <td className="px-3 py-2 text-center border border-gray-200 font-bold text-primary bg-primary/5">{rowTotal}</td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="bg-primary/10 font-bold">
                                    <td className="px-3 py-2 border border-gray-200">TOTAL</td>
                                    {storeTrafficMatrix.sources.map(src => {
                                      const colTotal = storeTrafficMatrix.stores.reduce((s, store) => s + (storeTrafficMatrix.map[store]?.[src] || 0), 0);
                                      return (
                                        <td key={src} className="px-3 py-2 text-center border border-gray-200 text-primary">{colTotal}</td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-center border border-gray-200 text-green-700">{totalBeli}</td>
                                    <td className="px-3 py-2 text-center border border-gray-200 text-red-600">{fd.filter(r => r.customer_convert === "Tidak Beli").length}</td>
                                    <td className="px-3 py-2 text-center border border-gray-200 text-primary">{totalEntries}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      {/* ── DAILY VIEW ── */}
                      {chartView === "daily" && (
                        <>
                          {/* Daily Conversion trend */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Konversi Harian</h3>
                            <p className="text-xs text-gray-400 mb-4">Beli vs Tidak Beli per hari</p>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={dailyConversionData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end"
                                  interval={Math.max(0, Math.floor(dailyConversionData.length / 15))} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                <Bar dataKey="Beli" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={28} stackId="c" />
                                <Bar dataKey="Tidak Beli" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} stackId="c" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Survey Source Harian (Top 6)</h3>
                            <p className="text-xs text-gray-400 mb-4">Jumlah survey per hari</p>
                            <ResponsiveContainer width="100%" height={320}>
                              <LineChart data={dailyTrafficChartData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end"
                                  interval={Math.max(0, Math.floor(dailyTrafficChartData.chartData.length / 15))} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                {dailyTrafficChartData.top6.map((t, i) => (
                                  <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">Tren Survey Harian per Store</h3>
                            <p className="text-xs text-gray-400 mb-4">Jumlah survey per hari berdasarkan store</p>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={dailyStoreChartData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-40} textAnchor="end"
                                  interval={Math.max(0, Math.floor(dailyStoreChartData.chartData.length / 15))} />
                                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={36} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                                {dailyStoreChartData.storeNames.map((s, i) => (
                                  <Line key={s} type="monotone" dataKey={s} stroke={COLORS[(i + 5) % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Summary table */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Survey Source</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-b">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Survey Source</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Jumlah</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Beli</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Conv. Rate</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-700">% Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const total = trafficChartData.reduce((s, d) => s + d.value, 0);
                                    return trafficChartData.map((t, i) => {
                                      const trafficBeli = fd.filter(r => r.traffic_source === t.name && r.customer_convert === "Beli").length;
                                      const convPct = t.value ? `${((trafficBeli / t.value) * 100).toFixed(1)}%` : "-";
                                      return (
                                        <tr key={i} className="border-b hover:bg-gray-50">
                                          <td className="px-3 py-2 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            {t.name}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium">{t.value}</td>
                                          <td className="px-3 py-2 text-right text-green-700 font-medium">{trafficBeli}</td>
                                          <td className="px-3 py-2 text-right text-orange-600">{convPct}</td>
                                          <td className="px-3 py-2 text-right text-gray-500">
                                            {total ? `${((t.value / total) * 100).toFixed(1)}%` : "-"}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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

            {/* Taft */}
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

            {/* Apakah customer membeli? */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Apakah customer membeli? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {["Beli", "Tidak Beli"].map(opt => (
                  <button key={opt} type="button"
                    onClick={() => setForm(f => ({ ...f, customer_convert: opt, sales_order: opt === "Tidak Beli" ? "" : f.sales_order }))}
                    className={`flex-1 px-3 py-2 border rounded text-xs font-medium transition-colors ${
                      form.customer_convert === opt
                        ? opt === "Beli"
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-red-500 border-red-500 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Sales Order — hanya muncul ketika Beli */}
            {form.customer_convert === "Beli" && (
              <div className="mb-3 pl-3 border-l-2 border-green-300">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Sales Order <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.sales_order}
                  onChange={e => setForm(f => ({ ...f, sales_order: e.target.value }))}
                  placeholder="Contoh: #4098769"
                  autoFocus
                  className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 bg-green-50 font-mono ${
                    form.sales_order.trim() && !/^#\d+$/.test(form.sales_order.trim())
                      ? "border-red-400 focus:ring-red-400"
                      : "border-green-300 focus:ring-green-400"
                  }`}
                />
                {form.sales_order.trim() && !/^#\d+$/.test(form.sales_order.trim()) && (
                  <p className="text-[10px] text-red-500 mt-0.5">
                    Format tidak valid. Gunakan format #angka, contoh: #4098769
                  </p>
                )}
                {(!form.sales_order.trim() || /^#\d+$/.test(form.sales_order.trim())) && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Wajib diisi dengan format #angka, contoh: #4098769</p>
                )}
              </div>
            )}

            {/* Traffic Source */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Traffic Source <span className="text-red-500">*</span>
              </label>
              <select value={form.traffic_source}
                onChange={e => setForm(f => ({
                  ...f,
                  traffic_source: e.target.value,
                  wag_addition: "",
                  eiger_addition: "",
                  organic_addition: "",
                }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Pilih Traffic Source --</option>
                {trafficSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* WAG Addition (conditional) */}
            {form.traffic_source === "Whatsapp Group" && (
              <div className="mb-3 pl-3 border-l-2 border-blue-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Karena apa? <span className="text-red-500">*</span>
                </label>
                <select value={form.wag_addition} onChange={e => setForm(f => ({ ...f, wag_addition: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="">-- Pilih WAG --</option>
                  {wagAdditions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Eiger Addition (conditional) */}
            {form.traffic_source === "Dari Eiger" && (
              <div className="mb-3 pl-3 border-l-2 border-purple-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Karena Apa? <span className="text-red-500">*</span>
                </label>
                <select value={form.eiger_addition} onChange={e => setForm(f => ({ ...f, eiger_addition: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-purple-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400">
                  <option value="">-- Pilih Eiger --</option>
                  {eigerAdditions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Organic Addition (conditional) */}
            {form.traffic_source === "Traffic Organic/Walk In" && (
              <div className="mb-3 pl-3 border-l-2 border-green-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Karena Apa? <span className="text-red-500">*</span>
                </label>
                <select value={form.organic_addition} onChange={e => setForm(f => ({ ...f, organic_addition: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-green-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-400">
                  <option value="">-- Pilih Organic --</option>
                  {organicAdditions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Brand Competitor */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Pernah beli tas di Brand apa?
              </label>
              <select value={form.brand_competitor} onChange={e => setForm(f => ({ ...f, brand_competitor: e.target.value, brand_custom: "" }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Pilih Brand --</option>
                {brandCompetitors.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="Lainnya">Lainnya</option>
              </select>
              {form.brand_competitor === "Lainnya" && (
                <input
                  type="text"
                  value={form.brand_custom}
                  onChange={e => setForm(f => ({ ...f, brand_custom: e.target.value }))}
                  placeholder="Tulis nama brand..."
                  autoFocus
                  className="w-full mt-1.5 px-2 py-1.5 border border-amber-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50"
                />
              )}
            </div>

            {/* Intensi */}
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

            {/* Case */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Case <span className="text-red-500">*</span>
              </label>
              <select value={form.case} onChange={e => setForm(f => ({ ...f, case: e.target.value }))}
                disabled={!form.intention}
                className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary
                  ${!form.intention ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" : "bg-white border-gray-300"}`}>
                <option value="">
                  {!form.intention ? "Pilih Intensi terlebih dahulu" : "-- Pilih Case --"}
                </option>
                {casesForIntention.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Notes — wajib saat Tidak Beli */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes
                {form.customer_convert === "Tidak Beli" && <span className="text-red-500"> *</span>}
                {form.customer_convert === "Tidak Beli" && (
                  <span className="ml-1 text-[10px] text-red-400">(wajib diisi)</span>
                )}
              </label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder={form.customer_convert === "Tidak Beli" ? "Jelaskan alasan customer tidak membeli..." : "Catatan tambahan..."}
                className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 resize-none ${
                  form.customer_convert === "Tidak Beli"
                    ? "border-red-200 focus:ring-red-400 bg-red-50/30"
                    : "border-gray-300 focus:ring-primary"
                }`} />
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