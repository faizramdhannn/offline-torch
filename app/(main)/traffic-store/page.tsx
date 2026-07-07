"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, Legend,
} from "recharts";
import { MapPin, Plus, FileDown, Target, Users } from "lucide-react";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeletonRows } from "@/components/shared/LoadingSkeleton";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { StatCard } from "@/components/shared/StatCard";

import { FilterBar } from "@/components/traffic-store/FilterBar";
import { ViewTabs, type TrafficTab } from "@/components/traffic-store/ViewTabs";
import { ChartViewToggle } from "@/components/traffic-store/ChartViewToggle";
import { EntryTable } from "@/components/traffic-store/EntryTable";
import { ChartCard } from "@/components/traffic-store/ChartCard";
import { DarkTooltip, PieSliceTooltip, PieLegend } from "@/components/traffic-store/ChartHelpers";
import { SalesByTable } from "@/components/traffic-store/SalesByTable";
import { SummaryTable } from "@/components/traffic-store/SummaryTable";
import { MatrixTable } from "@/components/traffic-store/MatrixTable";
import { EntryFormModal, type TrafficFormData } from "@/components/traffic-store/EntryFormModal";

interface TrafficEntry {
  id: string;
  date: string;
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
  // ── Revisi Survey (kolom S–Y) ──
  customer_segment?: string;
  product_category?: string;
  product_detail?: string;
  reason_not_buy?: string;
  budget_range?: string;
  alt_purchase_channel?: string;
  reason_buy?: string;
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
  // ── Revisi Survey — master lists untuk dropdown ──
  customer_segment?: string;
  product_category?: string;
  reason_not_buy?: string;
  budget_range?: string;
  alt_purchase_channel?: string;
  reason_buy?: string;
}

const COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981",
  "#06b6d4","#ef4444","#84cc16","#f97316","#6366f1",
  "#14b8a6","#e11d48","#a855f7","#22c55e","#fb923c",
  "#0ea5e9","#d946ef","#facc15","#4ade80","#fb7185",
];

// formatDate now formats a date value that may be either:
//  - a plain date string "YYYY-MM-DD" (the new `date` field, no time component), or
//  - a full ISO datetime string (legacy created_at fallback)
// It renders date-only values without a time portion.
function formatDate(value: string) {
  if (!value) return "-";
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const hasTime = value.includes("T");
  if (hasTime) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // date-only "YYYY-MM-DD" — parse manually to avoid timezone shifting the day
  const [y, m, day] = value.split("-").map(Number);
  if (!y || !m || !day) return "-";
  return `${pad(day)} ${months[m - 1]} ${y}`;
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

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

const EMPTY_FORM: TrafficFormData = {
  date: "",
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
  customer_segment: "",
  product_category: "",
  product_detail: "",
  reason_not_buy: "",
  budget_range: "",
  alt_purchase_channel: "",
  reason_buy: "",
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

  // Sheet 7: Daily Trend (based on the user-selected `date` field)
  const dailyMap: Record<string, Record<string, number>> = {};
  filteredData.forEach(r => {
    const date = r.date?.split("T")[0];
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
    formatDate(r.date),
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
  const [form, setForm] = useState<TrafficFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useSessionGuard();

  // Filters
  const [filterStore, setFilterStore] = useState("all");
  const [filterTraffic, setFilterTraffic] = useState("all");
  const [filterConvert, setFilterConvert] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterReasonNotBuy, setFilterReasonNotBuy] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Report view toggle
  const [chartView, setChartView] = useState<"all" | "daily">("all");
  const [activeTab, setActiveTab] = useState<TrafficTab>("list");

  // ── UI-only addition: modern confirm dialog replacing window.confirm() ──
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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

  const customerSegments = useMemo(
    () => [...new Set(master.map(m => m.customer_segment).filter(Boolean))] as string[],
    [master]
  );

  const productCategories = useMemo(
    () => [...new Set(master.map(m => m.product_category).filter(Boolean))] as string[],
    [master]
  );

  const reasonsNotBuy = useMemo(
    () => [...new Set(master.map(m => m.reason_not_buy).filter(Boolean))] as string[],
    [master]
  );

  const budgetRanges = useMemo(
    () => [...new Set(master.map(m => m.budget_range).filter(Boolean))] as string[],
    [master]
  );

  const altPurchaseChannels = useMemo(
    () => [...new Set(master.map(m => m.alt_purchase_channel).filter(Boolean))] as string[],
    [master]
  );

  const reasonsBuy = useMemo(
    () => [...new Set(master.map(m => m.reason_buy).filter(Boolean))] as string[],
    [master]
  );

  const allStores = useMemo(
    () => [...new Set(master.map(m => m.store_location).filter(Boolean))].sort(),
    [master]
  );

  const dataProductCategories = useMemo(
    () => [...new Set(data.map(r => r.product_category).filter(Boolean))].sort() as string[],
    [data]
  );

  const dataReasonsNotBuy = useMemo(
    () => [...new Set(data.map(r => r.reason_not_buy).filter(Boolean))].sort() as string[],
    [data]
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
    if (filterCategory !== "all") rows = rows.filter(r => r.product_category === filterCategory);
    if (filterReasonNotBuy !== "all") rows = rows.filter(r => r.reason_not_buy === filterReasonNotBuy);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      rows = rows.filter(r =>
        r.taft_name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.product_detail?.toLowerCase().includes(q) ||
        r.product_category?.toLowerCase().includes(q)
      );
    }
    if (filterDateFrom) rows = rows.filter(r => (r.date || "") >= filterDateFrom);
    if (filterDateTo) rows = rows.filter(r => (r.date || "") <= filterDateTo);
    return rows;
  }, [data, filterStore, filterTraffic, filterConvert, filterCategory, filterReasonNotBuy, filterSearch, filterDateFrom, filterDateTo, isStoreUser, userStore]);

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

  // ─── Kategori Produk (revisi survey) ─────────────────────────────────────────
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.forEach(r => {
      const cat = r.product_category?.trim();
      if (!cat) return;
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fd]);

  // ─── Alasan Tidak Beli (revisi survey) ───────────────────────────────────────
  const reasonNotBuyChartData = useMemo(() => {
    const map: Record<string, number> = {};
    fd.filter(r => r.customer_convert === "Tidak Beli").forEach(r => {
      const reason = r.reason_not_buy?.trim();
      if (!reason) return;
      map[reason] = (map[reason] || 0) + 1;
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

  // ─── Sales per Traffic Source ────────────────────────────────────────────────
  const salesByTrafficData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    fd.forEach(r => {
      const src = r.traffic_source?.trim();
      if (!src || r.customer_convert !== "Beli") return;
      if (!map[src]) map[src] = { count: 0, value: 0 };
      map[src].count += 1;
      map[src].value += parseValue(r.value_order);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, value: d.value }))
      .sort((a, b) => b.value - a.value);
  }, [fd]);

  // ─── Sales per WAG Addition ──────────────────────────────────────────────────
  const salesByWagData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    fd.forEach(r => {
      if (!r.wag_addition || r.customer_convert !== "Beli") return;
      if (!map[r.wag_addition]) map[r.wag_addition] = { count: 0, value: 0 };
      map[r.wag_addition].count += 1;
      map[r.wag_addition].value += parseValue(r.value_order);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, value: d.value }))
      .sort((a, b) => b.value - a.value);
  }, [fd]);

  // ─── Sales per Eiger Addition ────────────────────────────────────────────────
  const salesByEigerData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    fd.forEach(r => {
      if (!r.eiger_addition || r.customer_convert !== "Beli") return;
      if (!map[r.eiger_addition]) map[r.eiger_addition] = { count: 0, value: 0 };
      map[r.eiger_addition].count += 1;
      map[r.eiger_addition].value += parseValue(r.value_order);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, value: d.value }))
      .sort((a, b) => b.value - a.value);
  }, [fd]);

  // ─── Sales per Organic Addition ──────────────────────────────────────────────
  const salesByOrganicData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    fd.forEach(r => {
      if (!r.organic_addition || r.customer_convert !== "Beli") return;
      if (!map[r.organic_addition]) map[r.organic_addition] = { count: 0, value: 0 };
      map[r.organic_addition].count += 1;
      map[r.organic_addition].value += parseValue(r.value_order);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, value: d.value }))
      .sort((a, b) => b.value - a.value);
  }, [fd]);

  const dailyTrafficChartData = useMemo(() => {
    const top6 = trafficChartData.slice(0, 6).map(d => d.name);
    const map: Record<string, Record<string, number>> = {};
    fd.forEach(r => {
      const date = r.date?.split("T")[0];
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
      const date = r.date?.split("T")[0];
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
      const date = r.date?.split("T")[0];
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

  // ─── Previous-period comparison (for BI-style trend deltas) ─────────────────
  // Only computed when a concrete date range is active (today/7d/30d/custom).
  const previousPeriodData = useMemo(() => {
    if (!filterDateFrom || !filterDateTo) return null;
    const from = new Date(filterDateFrom);
    const to = new Date(filterDateTo);
    const lengthDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (lengthDays - 1));
    const fmt = (d: Date) => { const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const pf = fmt(prevFrom), pt = fmt(prevTo);

    let rows = data.filter(r => r.id);
    if (isStoreUser && userStore) rows = rows.filter(r => r.store_location?.toLowerCase().trim() === userStore.toLowerCase().trim());
    if (filterStore !== "all" && !isStoreUser) rows = rows.filter(r => r.store_location?.toLowerCase() === filterStore.toLowerCase());
    if (filterTraffic !== "all") rows = rows.filter(r => r.traffic_source === filterTraffic);
    if (filterConvert !== "all") rows = rows.filter(r => r.customer_convert === filterConvert);
    if (filterCategory !== "all") rows = rows.filter(r => r.product_category === filterCategory);
    if (filterReasonNotBuy !== "all") rows = rows.filter(r => r.reason_not_buy === filterReasonNotBuy);
    rows = rows.filter(r => (r.date || "") >= pf && (r.date || "") <= pt);
    return rows;
  }, [data, filterStore, filterTraffic, filterConvert, filterCategory, filterReasonNotBuy, filterDateFrom, filterDateTo, isStoreUser, userStore]);

  const pctDelta = (curr: number, prev: number): number | undefined => {
    if (previousPeriodData === null) return undefined;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // Summary stats
  const totalEntries = fd.length;
  const totalStores = new Set(fd.map(r => r.store_location).filter(Boolean)).size;
  const topTraffic = trafficChartData[0]?.name || "-";
  const totalBeli = fd.filter(r => r.customer_convert === "Beli").length;
  const convRate = totalEntries ? `${((totalBeli / totalEntries) * 100).toFixed(1)}%` : "0%";

  const prevTotalEntries = previousPeriodData?.length ?? 0;
  const prevTotalBeli = previousPeriodData?.filter(r => r.customer_convert === "Beli").length ?? 0;
  const prevConvRateNum = prevTotalEntries ? (prevTotalBeli / prevTotalEntries) * 100 : 0;
  const currConvRateNum = totalEntries ? (totalBeli / totalEntries) * 100 : 0;
  const prevTotalValue = previousPeriodData
    ? previousPeriodData.filter(r => r.customer_convert === "Beli").reduce((s, r) => s + parseValue(r.value_order), 0)
    : 0;

  const deltaEntries = pctDelta(totalEntries, prevTotalEntries);
  const deltaBeli = pctDelta(totalBeli, prevTotalBeli);
  const deltaConvRate = previousPeriodData === null ? undefined : currConvRateNum - prevConvRateNum;
  const deltaValue = pctDelta(valueOrderStats.totalValue, prevTotalValue);
  const deltaLabel = previousPeriodData ? `vs ${previousPeriodData.length} data periode sebelumnya` : undefined;

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
    setForm({ ...EMPTY_FORM, date: todayStr() });
    setShowForm(true);
  };

  const openEdit = (entry: TrafficEntry) => {
    setEditEntry(entry);
    const isCustomBrand = entry.brand_competitor && !brandCompetitors.includes(entry.brand_competitor) && entry.brand_competitor !== "Lainnya";
    setForm({
      date: entry.date ? entry.date.split("T")[0] : todayStr(),
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
      customer_segment: entry.customer_segment || "",
      product_category: entry.product_category || "",
      product_detail: entry.product_detail || "",
      reason_not_buy: entry.reason_not_buy || "",
      budget_range: entry.budget_range || "",
      alt_purchase_channel: entry.alt_purchase_channel || "",
      reason_buy: entry.reason_buy || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const needsWag = form.traffic_source === "WAG" && !form.wag_addition;
    const needsEiger = form.traffic_source === "Eiger Referral" && !form.eiger_addition;
    const needsOrganic = form.traffic_source === "Walk-in" && !form.organic_addition;
    const needsSalesOrder = form.customer_convert === "Beli" && !form.sales_order?.trim();
    const invalidSalesOrder =
      form.customer_convert === "Beli" &&
      !!form.sales_order?.trim() &&
      !/^#\d+$/.test(form.sales_order.trim());
    const needsReasonNotBuy = form.customer_convert === "Tidak Beli" && !form.reason_not_buy;
    const needsBudgetRange =
      form.customer_convert === "Tidak Beli" &&
      ["Harga Di Atas Budget", "Harga Lebih Murah Online", "Menunggu Promo Lebih Besar"].includes(form.reason_not_buy) &&
      !form.budget_range;
    const needsReasonBuy = form.customer_convert === "Beli" && !form.reason_buy;

    if (!form.date) {
      showMessage("Tanggal wajib diisi", "error"); return;
    }
    if (!form.taft_name || !form.traffic_source || !form.intention || !form.case || !form.customer_convert) {
      showMessage("Taft, Status Beli, Traffic Source, Intensi, dan Case wajib diisi", "error"); return;
    }
    if (!form.customer_segment || !form.product_category) {
      showMessage("Segment Customer dan Kategori Produk wajib diisi", "error"); return;
    }
    if (needsWag) { showMessage("Pilih WAG Addition terlebih dahulu", "error"); return; }
    if (needsEiger) { showMessage("Pilih Eiger Addition terlebih dahulu", "error"); return; }
    if (needsOrganic) { showMessage("Pilih Organic Addition terlebih dahulu", "error"); return; }
    if (needsSalesOrder) { showMessage("Sales Order wajib diisi ketika customer membeli", "error"); return; }
    if (invalidSalesOrder) {
      showMessage("Format Sales Order tidak valid. Gunakan format #angka, contoh: #4098769", "error"); return;
    }
    if (needsReasonNotBuy) { showMessage("Alasan Tidak Beli wajib diisi", "error"); return; }
    if (needsBudgetRange) { showMessage("Budget Range wajib diisi ketika alasan tidak beli terkait harga", "error"); return; }
    if (needsReasonBuy) { showMessage("Alasan Beli wajib diisi ketika customer membeli", "error"); return; }

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

  // Delete flow: same fetch/logic as before, now routed through a confirm
  // dialog (deleteTargetId state) instead of window.confirm().
  const requestDelete = (id: string) => setDeleteTargetId(id);

  const handleDelete = async () => {
    const id = deleteTargetId;
    if (!id) return;
    try {
      const res = await fetch(`/api/traffic-store?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { showMessage("Data dihapus", "success"); fetchAll(); }
      else showMessage(result.error || "Gagal hapus", "error");
    } catch { showMessage("Terjadi kesalahan", "error"); }
    finally { setDeleteTargetId(null); }
  };

  const exportList = () => {
    const headers = ["ID", "Tanggal", "Store", "Taft", "Beli?", "Sales Order", "Traffic Source", "WAG Addition", "Eiger Addition", "Organic Addition", "Brand Competitor", "Intensi", "Case", "Notes", "Value Order", "Discount Code"];
    const rows = fd.map(r => [
      r.id, formatDate(r.date), r.store_location, r.taft_name, r.customer_convert,
      r.sales_order || "",
      r.traffic_source, r.wag_addition, r.eiger_addition, r.organic_addition,
      r.brand_competitor, r.intention, r.case, r.notes,
      r.value_order || "", r.discount_code || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `Traffic_Store_List_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilterStore("all"); setFilterTraffic("all"); setFilterConvert("all");
    setFilterCategory("all"); setFilterReasonNotBuy("all"); setFilterSearch("");
    setFilterDateFrom(""); setFilterDateTo(""); setPage(1);
  };

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
        {/* ── Section header ──────────────────────────────────────────── */}
        <SectionHeader
          icon={MapPin}
          title="Traffic Store"
          description={
            userStore
              ? `Survey traffic dan konversi customer — Store: ${toTitleCase(userStore)}`
              : "Survey traffic toko dan analisis konversi customer."
          }
          actions={
            <>
              {activeTab === "list" && (
                <Button variant="outline" icon={FileDown} onClick={exportList}>
                  Export CSV
                </Button>
              )}
              {user?.traffic_store && (
                <Button icon={Plus} onClick={openAdd}>
                  Tambah Traffic
                </Button>
              )}
            </>
          }
        />

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        {user?.report_store && (
          <div className="mt-5">
            <ViewTabs active={activeTab} onChange={setActiveTab} />
          </div>
        )}

        <div className="mt-4 space-y-4">
          {/* ── Shared filter bar ── */}
          <FilterBar
            isStoreUser={isStoreUser}
            allStores={allStores}
            trafficSources={trafficSources}
            productCategories={dataProductCategories}
            reasonsNotBuy={dataReasonsNotBuy}
            filterStore={filterStore}
            onFilterStoreChange={(v) => { setFilterStore(v); setPage(1); }}
            filterTraffic={filterTraffic}
            onFilterTrafficChange={(v) => { setFilterTraffic(v); setPage(1); }}
            filterConvert={filterConvert}
            onFilterConvertChange={(v) => { setFilterConvert(v); setPage(1); }}
            filterCategory={filterCategory}
            onFilterCategoryChange={(v) => { setFilterCategory(v); setPage(1); }}
            filterReasonNotBuy={filterReasonNotBuy}
            onFilterReasonNotBuyChange={(v) => { setFilterReasonNotBuy(v); setPage(1); }}
            filterSearch={filterSearch}
            onFilterSearchChange={(v) => { setFilterSearch(v); setPage(1); }}
            filterDateFrom={filterDateFrom}
            onFilterDateFromChange={(v) => { setFilterDateFrom(v); setPage(1); }}
            filterDateTo={filterDateTo}
            onFilterDateToChange={(v) => { setFilterDateTo(v); setPage(1); }}
            onReset={resetFilters}
            resultCount={fd.length}
            toTitleCase={toTitleCase}
          />

          {/* ── LIST TAB ── */}
          {activeTab === "list" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <TableSkeletonRows />
              ) : fd.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="Belum ada data traffic"
                  description="Mulai dengan menambahkan data survey traffic pertama."
                  action={user?.traffic_store ? <Button icon={Plus} size="sm" onClick={openAdd}>Tambah Traffic</Button> : undefined}
                />
              ) : (
                <>
                  <EntryTable
                    items={paginated}
                    isStoreUser={isStoreUser}
                    canEdit={!!user?.traffic_store}
                    onEdit={openEdit}
                    onDelete={requestDelete}
                    formatDate={formatDate}
                    toTitleCase={toTitleCase}
                  />
                  <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(fd.length / PAGE_SIZE)}
                    onPageChange={setPage}
                    rangeLabel={`${Math.min((page - 1) * PAGE_SIZE + 1, fd.length)}–${Math.min(page * PAGE_SIZE, fd.length)} dari ${fd.length}`}
                  />
                </>
              )}
            </motion.div>
          )}

          {/* ── REPORT TAB ── */}
          {activeTab === "report" && user?.report_store && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard icon={Users} label="Total Data" value={totalEntries.toLocaleString()} tone="info"
                  delta={deltaEntries} deltaLabel={deltaLabel} />
                <StatCard icon={MapPin} label="Jumlah Store" value={totalStores.toLocaleString()} tone="default" />
                <StatCard icon={Target} label="Total Beli" value={totalBeli.toLocaleString()} tone="positive"
                  delta={deltaBeli} deltaLabel={deltaLabel} />
                <StatCard icon={Target} label="Conv. Rate" value={convRate} tone="warning"
                  delta={deltaConvRate} deltaLabel={deltaLabel ? `poin ${deltaLabel}` : undefined} />
                <StatCard icon={Target} label="Total Value Beli" value={formatRupiah(valueOrderStats.totalValue)} tone="positive"
                  delta={deltaValue} deltaLabel={deltaLabel} />
              </div>

              {/* Chart Card */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-gray-700">Analitik Survey Store</h2>
                  <div className="flex items-center gap-3">
                    {!loading && fd.length > 0 && (
                      <>
                        <ChartViewToggle view={chartView} onChange={setChartView} />
                        <Button variant="primary" size="sm" icon={FileDown} onClick={handleExportXLSX} className="bg-green-600 border-green-600 hover:bg-green-700">
                          Export XLSX
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  {loading ? (
                    <TableSkeletonRows count={6} />
                  ) : fd.length === 0 ? (
                    <EmptyState icon={Target} title="Belum ada data" description="Tambah data traffic untuk melihat laporan." />
                  ) : (
                    <div className="space-y-10">
                      {/* ── ALL VIEW ── */}
                      {chartView === "all" && (
                        <>
                          {/* Pie + Bar: Traffic Source */}
                          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                            <ChartCard title="Distribusi Survey Source" span="half">
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
                                  <Tooltip content={(props) => (
                                    <PieSliceTooltip {...props} total={trafficChartData.reduce((s, d) => s + d.value, 0)} />
                                  )} />
                                </PieChart>
                              </ResponsiveContainer>
                              <PieLegend data={trafficChartData.map((d, i) => ({ name: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} />
                            </ChartCard>
                            <ChartCard title="Jumlah per Survey Source" span="half">
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={trafficChartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-35} textAnchor="end" interval={0} height={60} />
                                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                  <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                    {trafficChartData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartCard>
                          </div>

                          {/* Pie + Bar: Conversion */}
                          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                            <ChartCard title="Konversi Pembelian" span="half">
                              <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                  <Pie data={conversionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95}
                                    label={(props) => `${((props.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                                    {conversionData.map((d, i) => (
                                      <Cell key={i} fill={d.name === "Beli" ? "#10b981" : "#ef4444"} />
                                    ))}
                                  </Pie>
                                  <Tooltip content={(props) => (
                                    <PieSliceTooltip {...props} total={conversionData.reduce((s, d) => s + d.value, 0)} />
                                  )} />
                                </PieChart>
                              </ResponsiveContainer>
                              <PieLegend data={conversionData.map((d) => ({ name: d.name, value: d.value, color: d.name === "Beli" ? "#10b981" : "#ef4444" }))} />
                            </ChartCard>
                            <ChartCard title="Konversi per Survey Source" span="half">
                              <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={conversionByTraffic} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-35} textAnchor="end" interval={0} height={60} />
                                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                  <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                  <Legend wrapperStyle={{ fontSize: 11 }} />
                                  <Bar dataKey="beli" name="Beli" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                  <Bar dataKey="tidakBeli" name="Tidak Beli" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartCard>
                          </div>

                          {/* Kategori Produk & Alasan Tidak Beli (revisi survey) */}
                          {(categoryChartData.length > 0 || reasonNotBuyChartData.length > 0) && (
                            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                              {categoryChartData.length > 0 && (
                                <ChartCard title="Kategori Produk yang Dicari" span="half">
                                  <ResponsiveContainer width="100%" height={Math.max(220, categoryChartData.length * 32)}>
                                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                      <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={110} axisLine={false} tickLine={false} />
                                      <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                        {categoryChartData.map((_, i) => (
                                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </ChartCard>
                              )}
                              {reasonNotBuyChartData.length > 0 && (
                                <ChartCard title="Alasan Tidak Beli" span="half">
                                  <ResponsiveContainer width="100%" height={Math.max(220, reasonNotBuyChartData.length * 32)}>
                                    <BarChart data={reasonNotBuyChartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                      <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={150} axisLine={false} tickLine={false} />
                                      <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={22} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </ChartCard>
                              )}
                            </div>
                          )}

                          {/* Total Survey per Store */}
                          <ChartCard title="Total Survey per Store">
                            <ResponsiveContainer width="100%" height={Math.max(260, storeTrafficMatrix.barData.length * 36)}>
                              <BarChart data={storeTrafficMatrix.barData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={100} axisLine={false} tickLine={false} />
                                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                  {storeTrafficMatrix.barData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          {/* Discount Code */}
                          {discountChartData.length > 0 && (
                            <ChartCard title="Discount Code — Pemakai & Value">
                              <ResponsiveContainer width="100%" height={Math.max(240, discountChartData.length * 34)}>
                                <BarChart data={discountChartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={110} axisLine={false} tickLine={false} />
                                  <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                  <Bar dataKey="count" name="Jumlah Pemakai" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                    {discountChartData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartCard>
                          )}

                          {/* Brand Competitor */}
                          {brandChartData.length > 0 && (
                            <ChartCard title="Brand Competitor (Pernah Beli Di)">
                              <ResponsiveContainer width="100%" height={Math.max(240, brandChartData.length * 34)}>
                                <BarChart data={brandChartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={110} axisLine={false} tickLine={false} />
                                  <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                    {brandChartData.map((_, i) => (
                                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </ChartCard>
                          )}

                          {/* WAG / Eiger / Organic detail + sales tables */}
                          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                            {wagChartData.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">Detail WAG</h3>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={wagChartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-35} textAnchor="end" interval={0} height={60} />
                                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                  </BarChart>
                                </ResponsiveContainer>
                                <SalesByTable title="Sales per WAG Addition" data={salesByWagData} formatRupiah={formatRupiah} />
                              </div>
                            )}
                            {eigerChartData.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">Detail Eiger Referral</h3>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={eigerChartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-35} textAnchor="end" interval={0} height={60} />
                                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                  </BarChart>
                                </ResponsiveContainer>
                                <SalesByTable title="Sales per Eiger Addition" data={salesByEigerData} colorOffset={2} formatRupiah={formatRupiah} />
                              </div>
                            )}
                            {organicChartData.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">Detail Walk-in</h3>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={organicChartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-35} textAnchor="end" interval={0} height={60} />
                                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                  </BarChart>
                                </ResponsiveContainer>
                                <SalesByTable title="Sales per Organic Addition" data={salesByOrganicData} colorOffset={4} formatRupiah={formatRupiah} />
                              </div>
                            )}
                          </div>

                          <SalesByTable title="Sales per Survey Source" data={salesByTrafficData} formatRupiah={formatRupiah} />

                          {/* Intention */}
                          <ChartCard title="Distribusi Intensi Kunjungan">
                            <ResponsiveContainer width="100%" height={Math.max(220, intentionData.length * 40)}>
                              <BarChart data={intentionData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} width={130} axisLine={false} tickLine={false} />
                                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
                                  {intentionData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          {/* Store x Traffic matrix */}
                          <MatrixTable matrix={storeTrafficMatrix} fd={fd} totalBeli={totalBeli} totalEntries={totalEntries} toTitleCase={toTitleCase} />
                        </>
                      )}

                      {/* ── DAILY VIEW ── */}
                      {chartView === "daily" && (
                        <>
                          {/* Daily Conversion trend */}
                          <div>
                            <h3 className="mb-1 text-sm font-semibold text-gray-700">Tren Konversi Harian</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={dailyConversionData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line type="monotone" dataKey="Beli" stroke="#10b981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Tidak Beli" stroke="#ef4444" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Daily Traffic Source trend */}
                          <div>
                            <h3 className="mb-1 text-sm font-semibold text-gray-700">Tren Survey Source Harian (Top 6)</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={dailyTrafficChartData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                {dailyTrafficChartData.top6.map((t, i) => (
                                  <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Daily per Store trend */}
                          <div>
                            <h3 className="mb-1 text-sm font-semibold text-gray-700">Tren Survey Harian per Store</h3>
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={dailyStoreChartData.chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                                <Tooltip content={<DarkTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                {dailyStoreChartData.storeNames.map((s, i) => (
                                  <Line key={s} type="monotone" dataKey={s} stroke={COLORS[(i + 5) % COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Summary table */}
                          <SummaryTable trafficChartData={trafficChartData} fd={fd} parseValue={parseValue} formatRupiah={formatRupiah} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* ── Form Modal ── */}
        <EntryFormModal
          mode={editEntry ? "edit" : "add"}
          open={showForm}
          onClose={() => setShowForm(false)}
          form={form}
          onChange={setForm}
          storeLabel={userStore || undefined}
          taftsForStore={taftsForStore}
          trafficSources={trafficSources}
          wagAdditions={wagAdditions}
          eigerAdditions={eigerAdditions}
          organicAdditions={organicAdditions}
          brandCompetitors={brandCompetitors}
          intentions={intentions}
          casesForIntention={casesForIntention}
          customerSegments={customerSegments}
          productCategories={productCategories}
          reasonsNotBuy={reasonsNotBuy}
          budgetRanges={budgetRanges}
          altPurchaseChannels={altPurchaseChannels}
          reasonsBuy={reasonsBuy}
          saving={saving}
          onSubmit={handleSave}
          toTitleCase={toTitleCase}
        />

        {/* Delete confirmation */}
        <ConfirmationDialog
          open={!!deleteTargetId}
          title="Hapus data ini?"
          description="Data traffic ini akan dihapus permanen."
          confirmLabel="Hapus"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
        />

        <Popup show={showPopup} message={popupMsg} type={popupType} onClose={() => setShowPopup(false)} />
      </div>
    </div>
  );
}