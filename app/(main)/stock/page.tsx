"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import PrintBarcodeModal from "@/components/PrintBarcodeModal";
import {
  Upload,
  Download,
  RefreshCw,
  Printer,
  RotateCcw,
} from "lucide-react";

import { PageHeader } from "@/components/stock/PageHeader";
import { Button } from "@/components/shared/Button";
import { ViewTabs } from "@/components/stock/ViewTabs";
import { FilterDropdown } from "@/components/stock/FilterDropdown";
import { ChartPanel } from "@/components/stock/ChartPanel";
import { LegendDot } from "@/components/stock/LegendDot";
import { StockTable } from "@/components/stock/StockTable";
import { Pagination } from "@/components/stock/Pagination";
import { ImportModal } from "@/components/stock/ImportModal";
import { QRLabelPopup } from "@/components/stock/QRLabelPopup";
import { PriceRangeSlider } from "@/components/stock/PriceRangeSlider";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TableSkeletonRows } from "@/components/dashboard/LoadingSkeleton";
import { cn } from "@/lib/utils";
import {
  CustomXTick,
  CustomTooltip,
  PCATooltip,
  CategoryTooltip,
} from "@/components/stock/ChartHelpers";
import { chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

interface StockItem {
  link_url?: string;
  image_url?: string;
  warehouse?: string;
  sku: string;
  SKU?: string;
  stock: string;
  Stock?: string;
  item_name: string;
  Product_name?: string;
  category: string;
  Category?: string;
  grade: string;
  Grade?: string;
  tier_product: string;
  Tier_product?: string;
  hpp: string;
  HPP?: string;
  hpt: string;
  HPT?: string;
  hpj: string;
  HPJ?: string;
  discount?: string;
  Discount?: string;
  Artikel?: string;
  threshold?: string;
  Threshold?: string;
}

interface LastUpdate {
  type: string;
  last_update: string;
}

const WAREHOUSES = [
  { name: "Margonda",   key: "Torch Margonda - T" },
  { name: "Jogja",      key: "Torch Jogja - T" },
  { name: "Makassar",   key: "Torch Makassar - T" },
  { name: "Lampung",    key: "Torch Lampung - T" },
  { name: "Surabaya",   key: "Torch Surabaya - T" },
  { name: "Lembong",    key: "Torch Store Lembong - T" },
  { name: "Karawang",   key: "Torch Karawang - T" },
  { name: "Cirebon",    key: "Torch Store Cirebon - T" },
  { name: "Pekalongan", key: "Torch Pekalongan - T" },
  { name: "Purwokerto", key: "Torch Purwokerto - T" },
];

const WAREHOUSE_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#ca8a04", "#9333ea", "#e11d48", "#65a30d",
  "#0284c7", "#b45309", "#4f46e5", "#059669",
];

const PCA_CATEGORY_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#ca8a04", "#9333ea", "#e11d48", "#65a30d",
  "#0284c7", "#b45309", "#4f46e5", "#059669",
];

const PCA_GRADE_COLORS = [
  "#16a34a", "#0891b2", "#ca8a04", "#e11d48",
  "#7c3aed", "#ea580c", "#2563eb", "#db2777",
];

function parseHarga(val: string | undefined | null): number {
  if (!val) return 0;
  return parseInt(String(val).replace(/[^0-9]/g, "")) || 0;
}

function parseDiscount(val: string | undefined | null): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function formatRupiah(val: number): string {
  return "Rp " + val.toLocaleString("id-ID");
}

export default function StockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<StockItem[]>([]);
  const [filteredData, setFilteredData] = useState<StockItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<LastUpdate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<"store" | "pca" | "master">("store");
  useSessionGuard();

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<string[]>([]);
  // Price range filter (HPJ) — [min, max] in Rupiah. null = not yet initialized from data.
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 0]);
  const [searchQuery, setSearchQuery] = useState("");

  // Sortable table headers — column key + direction. null direction = no manual sort.
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showTierDropdown, setShowTierDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [erpFile, setErpFile] = useState<File | null>(null);
  const [javelinFile, setJavelinFile] = useState<File | null>(null);
  const [thresholdFile, setThresholdFile] = useState<File | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const [chartMode, setChartMode] = useState<"store" | "category">("store");
  const [pcaChartMode, setPcaChartMode] = useState<"category" | "grade">("category");

  const [storeChartOpen, setStoreChartOpen] = useState(true);
  const [pcaChartOpen, setPcaChartOpen] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [qrItem, setQrItem] = useState<StockItem | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  // Map "sku::warehouse" -> stock kemarin, dari result_stock_yesterday /
  // pca_stock_yesterday (snapshot yang diisi otomatis oleh proses import,
  // lihat app/api/stock/import/route.ts). Kosong untuk view "master".
  const [yesterdayStockMap, setYesterdayStockMap] = useState<Record<string, string>>({});

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const gradeDropdownRef = useRef<HTMLDivElement>(null);
  const tierDropdownRef = useRef<HTMLDivElement>(null);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node))
        setShowCategoryDropdown(false);
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(event.target as Node))
        setShowGradeDropdown(false);
      if (tierDropdownRef.current && !tierDropdownRef.current.contains(event.target as Node))
        setShowTierDropdown(false);
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node))
        setShowWarehouseDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    if (parsedUser.stock_view_store) setSelectedView("store");
    else if (parsedUser.stock_view_pca) setSelectedView("pca");
    else if (parsedUser.stock_view_master) setSelectedView("master");
    fetchData();
    fetchLastUpdate();
  }, []);

  useEffect(() => { fetchData(); }, [selectedView]);
  useEffect(() => { applyFilters(); }, [categoryFilter, gradeFilter, tierFilter, warehouseFilter, priceRange, searchQuery, data, sortColumn, sortDirection]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let sheetName = "result_stock";
      if (selectedView === "pca") sheetName = "pca_stock";
      if (selectedView === "master") sheetName = "master_item";
      const response = await fetch(`/api/stock?type=${sheetName}`);
      const result = await response.json();
      if (!response.ok || !Array.isArray(result)) {
        // Backend gagal (misal: Google Sheets API sedang rate-limited/quota
        // exceeded) — result di sini berupa { error: "..." }, bukan array,
        // jadi jangan lanjut ke .map() supaya tidak crash dengan pesan generik.
        throw new Error(
          (result && typeof result === "object" && "error" in result
            ? result.error
            : null) || "Gagal memuat data stock. Coba lagi sebentar."
        );
      }
      const normalizedData = result.map((item: any) => ({
        ...item,
        sku: item.sku || item.SKU || "",
        stock: item.stock || item.Stock || "",
        item_name: item.item_name || item.Product_name || "",
        category: item.category || item.Category || "",
        grade: item.grade || item.Grade || "",
        tier_product: item.tier_product || item.Tier_product || item["Tier Product"] || item.tier || "",
        hpp: item.hpp || item.HPP || "",
        hpt: item.hpt || item.HPT || "",
        hpj: item.hpj || item.HPJ || "",
        discount: item.discount || item.Discount || "",
        threshold: item.threshold || item.Threshold || "",
      }));
      setData(normalizedData);
      setFilteredData(normalizedData);
      setCategories([...new Set(normalizedData.map((i: StockItem) => i.category))].filter(Boolean) as string[]);
      setGrades([...new Set(normalizedData.map((i: StockItem) => i.grade))].filter(Boolean) as string[]);
      setTiers([...new Set(normalizedData.map((i: StockItem) => i.tier_product))].filter(Boolean) as string[]);
      if (selectedView === "store")
        setWarehouses([...new Set(normalizedData.map((i: StockItem) => i.warehouse))].filter(Boolean) as string[]);

      const hpjValues = normalizedData
        .map((i: StockItem) => parseHarga(i.hpj))
        .filter((v: number) => v > 0);
      const minPrice = hpjValues.length ? Math.min(...hpjValues) : 0;
      const maxPrice = hpjValues.length ? Math.max(...hpjValues) : 0;
      setPriceBounds([minPrice, maxPrice]);
      setPriceRange([minPrice, maxPrice]);
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Gagal memuat data stock. Coba lagi sebentar.",
        "error"
      );
    } finally {
      setLoading(false);
    }
    fetchYesterdayData();
  };

  // Stock "kemarin" hanya relevan untuk view store/pca (view master tidak
  // punya kolom stock sama sekali). Gagal diam-diam kalau sheet *_yesterday
  // belum pernah ke-snapshot (misal belum ada import sejak fitur ini dibuat)
  // — detail panel akan menampilkan "-" untuk stock kemarin.
  const fetchYesterdayData = async () => {
    if (selectedView === "master") { setYesterdayStockMap({}); return; }
    try {
      const sheetName = selectedView === "pca" ? "pca_stock_yesterday" : "result_stock_yesterday";
      const response = await fetch(`/api/stock?type=${sheetName}`);
      const result = await response.json();
      if (!response.ok || !Array.isArray(result)) { setYesterdayStockMap({}); return; }
      const map: Record<string, string> = {};
      result.forEach((item: any) => {
        const sku = item.sku || item.SKU || "";
        const warehouse = item.warehouse || item.Warehouse || "";
        const stock = item.stock || item.Stock || "";
        if (sku) map[`${sku}::${warehouse}`] = stock;
      });
      setYesterdayStockMap(map);
    } catch {
      setYesterdayStockMap({});
    }
  };

    const fetchLastUpdate = async () => {
    try {
      const response = await fetch("/api/stock/last-update");
      const data = await response.json();
      // ✅ Hanya update state kalau data valid dan tidak kosong —
      // kalau gagal atau kosong, biarkan data lama tetap tampil di UI.
      if (response.ok && Array.isArray(data) && data.length > 0) {
        setLastUpdate(data);
      }
    } catch {
      // Diam-diam gagal — lastUpdate state tidak diubah, data lama tetap tampil
    }
  };
 

  const handleRefreshJavelin = async () => {
    if (!confirm("Refresh Javelin data? This may take a few minutes.")) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/stock/javelin-refresh", { method: "POST" });
      const result = await response.json();
      if (response.ok && result.success) {
        await logActivity("POST", `Refreshed Javelin inventory: ${result.rowsImported || 0} rows`);
        showMessage(`Javelin data refreshed successfully!\n${result.rowsImported || 0} rows imported`, "success");
        fetchData(); fetchLastUpdate();
      } else {
        showMessage(result.needsConfiguration
          ? `${result.error}\n\nPlease configure Javelin cookie in Settings first.`
          : `Failed to refresh\n\n${result.details || result.error}`, "error");
      }
    } catch {
      showMessage("Failed to refresh Javelin. Please try again.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const logActivity = async (method: string, activity: string) => {
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
      });
    } catch {}
  };

  const toProperCase = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  // Column accessor + comparison type, used by the sortable table headers.
  const SORTABLE_COLUMNS: Record<string, { get: (i: StockItem) => string | number; type: "text" | "number" }> = {
    sku: { get: (i) => i.sku || "", type: "text" },
    item_name: { get: (i) => toProperCase(i.item_name || ""), type: "text" },
    category: { get: (i) => toProperCase(i.category || ""), type: "text" },
    grade: { get: (i) => toProperCase(i.grade || ""), type: "text" },
    tier_product: { get: (i) => toProperCase(i.tier_product || ""), type: "text" },
    stock: { get: (i) => parseInt((i.stock || "0").toString().replace(/[^0-9-]/g, "")) || 0, type: "number" },
    threshold: { get: (i) => parseInt((i.threshold || "0").toString().replace(/[^0-9-]/g, "")) || 0, type: "number" },
    warehouse: { get: (i) => i.warehouse || "", type: "text" },
    hpp: { get: (i) => parseHarga(i.hpp), type: "number" },
    hpt: { get: (i) => parseHarga(i.hpt), type: "number" },
    hpj: { get: (i) => parseHarga(i.hpj), type: "number" },
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (categoryFilter.length > 0) filtered = filtered.filter((i) => categoryFilter.includes(i.category));
    if (gradeFilter.length > 0) filtered = filtered.filter((i) => gradeFilter.includes(i.grade));
    if (tierFilter.length > 0) filtered = filtered.filter((i) => tierFilter.includes(i.tier_product));
    if (selectedView === "store" && warehouseFilter.length > 0)
      filtered = filtered.filter((i) => i.warehouse && warehouseFilter.includes(i.warehouse));
    if (priceRange && (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1])) {
      const [lo, hi] = priceRange;
      filtered = filtered.filter((i) => {
        const hpjValue = parseHarga(i.hpj);
        if (hpjValue <= 0) return false;
        return hpjValue >= lo && hpjValue <= hi;
      });
    }
    if (searchQuery) {
      const words = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      filtered = filtered.filter((i) => {
        const haystack = `${i.sku} ${i.item_name}`.toLowerCase();
        const haystackWords = haystack.split(/[\s\-_/]+/);
        return words.every((word) =>
          haystackWords.some((hw) => hw.startsWith(word))
        );
      });
    }
    if (sortColumn && SORTABLE_COLUMNS[sortColumn]) {
      const { get, type } = SORTABLE_COLUMNS[sortColumn];
      const dir = sortDirection === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (type === "number") return ((va as number) - (vb as number)) * dir;
        return (va as string).localeCompare(vb as string) * dir;
      });
    } else if (selectedView === "pca") {
      filtered.sort((a, b) => {
        const sa = parseInt(a.stock?.replace(/[^0-9-]/g, "") || "0");
        const sb = parseInt(b.stock?.replace(/[^0-9-]/g, "") || "0");
        if (sb !== sa) return sb - sa;
        return (a.grade || "").localeCompare(b.grade || "");
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const resetFilters = () => {
    setCategoryFilter([]); setGradeFilter([]); setTierFilter([]); setWarehouseFilter([]);
    setPriceRange(priceBounds[1] > 0 ? [priceBounds[0], priceBounds[1]] : null);
    setSearchQuery(""); setSortColumn(null); setSortDirection("asc");
    setFilteredData(data); setCurrentPage(1);
  };

  const toggleCategory = (v: string) => setCategoryFilter((p) => p.includes(v) ? p.filter((c) => c !== v) : [...p, v]);
  const toggleGrade = (v: string) => setGradeFilter((p) => p.includes(v) ? p.filter((g) => g !== v) : [...p, v]);
  const toggleTier = (v: string) => setTierFilter((p) => p.includes(v) ? p.filter((t) => t !== v) : [...p, v]);
  const toggleWarehouse = (v: string) => setWarehouseFilter((p) => p.includes(v) ? p.filter((w) => w !== v) : [...p, v]);

  // ── Chart → filter shortcuts ────────────────────────────────────────────
  // Clicking a bar isolates that value as the active filter (replacing
  // whatever was selected before), e.g. clicking the "Lembong" bar shows
  // only Lembong's stock. Clicking the same already-active bar clears it.
  const handleWarehouseBarClick = (warehouseName: string) => {
    const wh = WAREHOUSES.find((w) => w.name === warehouseName);
    if (!wh) return;
    setWarehouseFilter((prev) =>
      prev.length === 1 && prev[0] === wh.key ? [] : [wh.key]
    );
  };

  const handleCategoryBarClick = (categoryName: string) => {
    setCategoryFilter((prev) =>
      prev.length === 1 && prev[0] === categoryName ? [] : [categoryName]
    );
  };

  const handleGradeBarClick = (gradeName: string) => {
    setGradeFilter((prev) =>
      prev.length === 1 && prev[0] === gradeName ? [] : [gradeName]
    );
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: (results) => {
            let d = results.data as any[];
            d = d.filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && c !== ""));
            resolve(d);
          },
          header: false, skipEmptyLines: true, error: reject,
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const wb = XLSX.read(e.target?.result, { type: "binary" });
            let d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
            d = d.filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && c !== ""));
            resolve(d);
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsBinaryString(file);
      } else {
        reject(new Error("Unsupported file format"));
      }
    });
  };

  const handleImport = async () => {
    if (!erpFile && !javelinFile && !thresholdFile) {
      showMessage("Please select at least one file to import", "error");
      return;
    }
    setImporting(true);
    const results: string[] = [], errors: string[] = [];
    try {
      for (const [file, sheetName, label] of [
        [erpFile, "erp_stock_balance", "ERP Stock"],
        [javelinFile, "javelin", "Javelin"],
        [thresholdFile, "powerbi_threshold", "Threshold"],
      ] as [File | null, string, string][]) {
        if (!file) continue;
        try {
          const parsedData = await parseFile(file);
          if (!parsedData.length) { errors.push(`${label}: No valid data found`); continue; }
          const res = await fetch("/api/stock/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheetName, data: parsedData }),
          });
          if (res.ok) { const r = await res.json(); results.push(`${label}: ${r.rowsImported} rows imported`); }
          else errors.push(`${label}: Import failed`);
        } catch (e) {
          errors.push(`${label}: ${e instanceof Error ? e.message : "Import failed"}`);
        }
      }
      let msg = "";
      if (results.length > 0) msg += "Success:\n" + results.join("\n");
      if (errors.length > 0) msg += (msg ? "\n\n" : "") + "Errors:\n" + errors.join("\n");
      await logActivity("POST", `Imported stock data: ${results.join(", ")}`);
      showMessage(msg || "Import completed", results.length > 0 && errors.length === 0 ? "success" : "error");
      if (results.length > 0) {
        setShowImportModal(false);
        setErpFile(null);
        setJavelinFile(null);
        setThresholdFile(null);
        fetchData();
        fetchLastUpdate();
      }
    } catch { showMessage("Failed to import data. Please try again.", "error"); }
    finally { setImporting(false); }
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => {
      const base: any = { SKU: item.sku, "Product Name": toProperCase(item.item_name), Category: toProperCase(item.category), Grade: toProperCase(item.grade) };
      if (selectedView !== "master") base["Stock"] = item.stock;
      if (selectedView === "store") base["Warehouse"] = item.warehouse;
      if (selectedView === "pca") base["Threshold"] = item.threshold || "";
      if (user?.stock_view_hpp) base["HPP"] = item.hpp;
      if (user?.stock_view_hpt) base["HPT"] = item.hpt;
      if (user?.stock_view_hpj) {
        base["HPJ"] = item.hpj;
        const discountPct = parseDiscount(item.discount);
        const hpjVal = parseHarga(item.hpj);
        base["Discount (%)"] = discountPct > 0 ? `${discountPct}%` : "";
        base["Harga Diskon"] = discountPct > 0 && hpjVal > 0
          ? Math.round(hpjVal * (1 - discountPct / 100))
          : "";
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `stock_${selectedView}_${new Date().toISOString().split("T")[0]}.xlsx`);
    logActivity("GET", `Exported stock data (${selectedView} view): ${filteredData.length} items`);
  };

  // ── Store chart data ──────────────────────────────────────────────────────
  const chartData = WAREHOUSES.map((wh) => {
    const whData = filteredData.filter((i) => (i.warehouse || "").toString().trim() === wh.key);
    return {
      name: wh.name,
      stock: whData.reduce((s, i) => s + (parseInt((i.stock || "0").toString().replace(/[^0-9-]/g, "")) || 0), 0),
      sku: whData.length,
    };
  });
  const maxStock = Math.max(...chartData.map((d) => d.stock), 1);

  const uniqueCategories = [...new Set(filteredData.map((i) => i.category).filter(Boolean))].sort() as string[];
  const categoryChartData = uniqueCategories.map((cat) => {
    const row: any = { name: cat };
    WAREHOUSES.forEach((wh) => {
      row[wh.name] = filteredData
        .filter((i) => (i.warehouse || "").toString().trim() === wh.key && i.category === cat)
        .reduce((s, i) => s + (parseInt((i.stock || "0").toString().replace(/[^0-9-]/g, "")) || 0), 0);
    });
    return row;
  });

  // ── PCA chart data ────────────────────────────────────────────────────────
  const parseStock = (val: string | number) =>
    parseInt((val || "0").toString().replace(/[^0-9-]/g, "")) || 0;

  const pcaCategoryChartData = [...new Set(filteredData.map((i) => i.category).filter(Boolean))]
    .sort()
    .map((cat) => ({
      name: cat,
      stock: filteredData.filter((i) => i.category === cat).reduce((s, i) => s + parseStock(i.stock), 0),
    }));

  const pcaGradeChartData = [...new Set(filteredData.map((i) => i.grade).filter(Boolean))]
    .sort()
    .map((grade) => ({
      name: grade,
      stock: filteredData.filter((i) => i.grade === grade).reduce((s, i) => s + parseStock(i.stock), 0),
    }));

  const pcaActiveData = pcaChartMode === "category" ? pcaCategoryChartData : pcaGradeChartData;
  const pcaActiveColors = pcaChartMode === "category" ? PCA_CATEGORY_COLORS : PCA_GRADE_COLORS;
  const pcaTotalStock = pcaActiveData.reduce((s, d) => s + d.stock, 0);

  // ── Pagination ────────────────────────────────────────────────────────────
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const canSeeAnyView = user?.stock_view_store || user?.stock_view_pca || user?.stock_view_master;

  if (!user) return null;

  if (!canSeeAnyView) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50/50">
        <div className="flex h-full items-center justify-center p-4 sm:p-6">
          <div className="text-center text-gray-500">
            <p className="mb-2 text-lg font-semibold">No View Access</p>
            <p className="text-sm">You don&apos;t have permission to view any stock data.</p>
          </div>
        </div>
      </div>
    );
  }

  const viewTabItems = [
    user.stock_view_store && { key: "store", label: "Store" },
    user.stock_view_pca && { key: "pca", label: "PCA" },
    user.stock_view_master && { key: "master", label: "Master" },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50">
      <div className="mx-auto max-w-7xl p-4">

        {/* ── Header + Toolbar ─────────────────────────────────────── */}
        <PageHeader
          title="Stock Management"
          actions={
            <>
              {user.stock_import && (
                <Button variant="outline" size="sm" icon={Upload} onClick={() => setShowImportModal(true)}>
                  Import Data
                </Button>
              )}
              {user.stock_export && (
                <Button variant="outline" size="sm" icon={Download} onClick={exportToExcel}>
                  Export Stock
                </Button>
              )}
              {user.stock_refresh_javelin && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={RefreshCw}
                  onClick={handleRefreshJavelin}
                  disabled={refreshing}
                  loading={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Javelin"}
                </Button>
              )}
              <Button variant="outline" size="sm" icon={Printer} onClick={() => setShowBarcodeModal(true)}>
                Print Barcode
              </Button>
            </>
          }
        />

        {/* ── Last Update strip ─────────────────────────────────────── */}
        {lastUpdate.length > 0 && (
          <div className="mb-4 flex flex-col gap-1 rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 text-xs text-gray-500 sm:flex-row sm:gap-4">
            {lastUpdate.map((lu) => (
              <div key={lu.type}>
                <span className="font-semibold text-gray-600">{lu.type}:</span> {lu.last_update}
              </div>
            ))}
          </div>
        )}

        {/* ── View Selection ─────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-4">
          <label className="mb-2 block text-xs font-medium text-gray-600">Select View</label>
          <ViewTabs items={viewTabItems} active={selectedView} onChange={(v) => setSelectedView(v as any)} />
        </div>

        {/* ── Chart ──────────────────────────────────────────────────── */}
        <div className="mb-4">
          {selectedView === "store" && (
            <ChartPanel
              title="Stock Summary"
              totalLabel="Total Stock"
              totalValue={chartData.reduce((s, d) => s + d.stock, 0).toLocaleString()}
              modes={[{ key: "store", label: "Store" }, { key: "category", label: "Category" }]}
              activeMode={chartMode}
              onModeChange={(v) => setChartMode(v as any)}
              open={storeChartOpen}
              onOpenChange={setStoreChartOpen}
              legend={
                chartMode === "category"
                  ? WAREHOUSES.map((wh, i) => (
                      <LegendDot key={wh.name} color={WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length]} label={wh.name} />
                    ))
                  : undefined
              }
            >
              {chartMode === "store" && (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: "320px" }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                        <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                        <YAxis tick={{ ...chartAxisTick, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={28} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                        <Bar
                          dataKey="stock"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={32}
                          cursor="pointer"
                          onClick={(entry: any) => handleWarehouseBarClick(entry.name)}
                          label={{ position: "top", fontSize: 8, fill: "#6b7280", formatter: (v: any) => Number(v) > 0 ? Number(v).toLocaleString() : "" }}
                        >
                          {chartData.map((entry, index) => {
                            const minStock = Math.min(...chartData.filter((d) => d.stock > 0).map((d) => d.stock));
                            const isActive = warehouseFilter.length === 1 &&
                              warehouseFilter[0] === WAREHOUSES.find((w) => w.name === entry.name)?.key;
                            const isDimmed = warehouseFilter.length === 1 && !isActive;
                            const color = entry.stock === maxStock ? "#3de400" : entry.stock === minStock && entry.stock > 0 ? "#e20000" : "#cbe2ff";
                            return <Cell key={index} fill={color} opacity={isDimmed ? 0.35 : 1} stroke={isActive ? "#0d334d" : undefined} strokeWidth={isActive ? 2 : 0} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-gray-400">
                    Klik salah satu bar untuk memfilter stock berdasarkan store tersebut
                  </p>
                </div>
              )}

              {chartMode === "category" && (
                <div className="overflow-x-auto">
                  <div style={{ width: Math.max(600, categoryChartData.length * 60), minWidth: "100%" }}>
                    <BarChart
                      width={Math.max(600, categoryChartData.length * 60)}
                      height={200}
                      data={categoryChartData}
                      margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                      barCategoryGap="20%"
                      barGap={1}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                      <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                      <YAxis tick={{ ...chartAxisTick, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={28} />
                      <Tooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                      {WAREHOUSES.map((wh, i) => (
                        <Bar
                          key={wh.name}
                          dataKey={wh.name}
                          fill={WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length]}
                          radius={[2, 2, 0, 0]}
                          maxBarSize={8}
                          cursor="pointer"
                          onClick={(entry: any) => handleCategoryBarClick(entry.name)}
                        />
                      ))}
                    </BarChart>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-gray-400">
                    Klik salah satu bar untuk memfilter stock berdasarkan category tersebut
                  </p>
                </div>
              )}
            </ChartPanel>
          )}

          {selectedView === "pca" && (
            <ChartPanel
              title="PCA Stock Summary"
              totalLabel="Total Stock"
              totalValue={pcaTotalStock.toLocaleString()}
              modes={[{ key: "category", label: "Category" }, { key: "grade", label: "Grade" }]}
              activeMode={pcaChartMode}
              onModeChange={(v) => setPcaChartMode(v as any)}
              open={pcaChartOpen}
              onOpenChange={setPcaChartOpen}
              legend={pcaActiveData.map((entry, i) => (
                <LegendDot key={entry.name} color={pcaActiveColors[i % pcaActiveColors.length]} label={entry.name} />
              ))}
            >
              <div className="overflow-x-auto">
                <div style={{ minWidth: "300px" }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={pcaActiveData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                      <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                      <YAxis tick={{ ...chartAxisTick, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={28} />
                      <Tooltip content={<PCATooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                      <Bar
                        dataKey="stock"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={36}
                        cursor="pointer"
                        onClick={(entry: any) =>
                          pcaChartMode === "category"
                            ? handleCategoryBarClick(entry.name)
                            : handleGradeBarClick(entry.name)
                        }
                        label={{ position: "top", fontSize: 8, fill: "#6b7280", formatter: (v: any) => Number(v) > 0 ? Number(v).toLocaleString() : "" }}
                      >
                        {pcaActiveData.map((entry, index) => {
                          const activeList = pcaChartMode === "category" ? categoryFilter : gradeFilter;
                          const isActive = activeList.length === 1 && activeList[0] === entry.name;
                          const isDimmed = activeList.length === 1 && !isActive;
                          return (
                            <Cell
                              key={index}
                              fill={pcaActiveColors[index % pcaActiveColors.length]}
                              opacity={isDimmed ? 0.35 : 1}
                              stroke={isActive ? "#0d334d" : undefined}
                              strokeWidth={isActive ? 2 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-gray-400">
                  Klik salah satu bar untuk filter berdasarkan {pcaChartMode === "category" ? "category" : "grade"} tersebut
                </p>
              </div>
            </ChartPanel>
          )}
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-4">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            <FilterDropdown
              label="Category"
              options={categories}
              selected={categoryFilter}
              onToggle={toggleCategory}
              open={showCategoryDropdown}
              onOpenChange={setShowCategoryDropdown}
              containerRef={categoryDropdownRef}
            />
            <FilterDropdown
              label="Grade"
              options={grades}
              selected={gradeFilter}
              onToggle={toggleGrade}
              open={showGradeDropdown}
              onOpenChange={setShowGradeDropdown}
              containerRef={gradeDropdownRef}
            />
            <FilterDropdown
              label="Tier Product"
              options={tiers}
              selected={tierFilter}
              onToggle={toggleTier}
              open={showTierDropdown}
              onOpenChange={setShowTierDropdown}
              containerRef={tierDropdownRef}
            />
            {selectedView === "store" && (
              <FilterDropdown
                label="Warehouse"
                options={warehouses}
                selected={warehouseFilter}
                onToggle={toggleWarehouse}
                open={showWarehouseDropdown}
                onOpenChange={setShowWarehouseDropdown}
                containerRef={warehouseDropdownRef}
              />
            )}
            <div className={cn("col-span-2 sm:col-span-3", selectedView === "store" ? "lg:col-span-2" : "lg:col-span-3")}>
              <label className="mb-1 block text-xs font-medium text-gray-600">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU atau nama produk..."
                className="min-h-[36px] w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10 sm:py-1.5"
              />
            </div>
          </div>

          {user.stock_view_hpj && priceRange && priceBounds[1] > 0 && (
            <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
              <PriceRangeSlider
                label="Range Harga (HPJ)"
                min={priceBounds[0]}
                max={priceBounds[1]}
                value={priceRange}
                onChange={setPriceRange}
              />
            </div>
          )}

          <Button variant="outline" size="sm" icon={RotateCcw} onClick={resetFilters}>
            Reset Filter
          </Button>
        </div>

        {/* ── Data Table ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
          {loading ? (
            <TableSkeletonRows count={8} />
          ) : filteredData.length === 0 ? (
            <EmptyState message="Tidak ada data stock yang cocok" />
          ) : (
            <>
              <StockTable
                items={currentItems}
                selectedView={selectedView}
                showHpp={!!user.stock_view_hpp}
                showHpt={!!user.stock_view_hpt}
                showHpj={!!user.stock_view_hpj}
                toProperCase={toProperCase}
                parseDiscount={parseDiscount}
                parseHarga={parseHarga}
                formatRupiah={formatRupiah}
                yesterdayStockMap={yesterdayStockMap}
                onBarcodeClick={setQrItem}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                rangeLabel={`${indexOfFirstItem + 1}–${Math.min(indexOfLastItem, filteredData.length)} dari ${filteredData.length}`}
              />
            </>
          )}
        </div>

        {/* ── Import Modal ─────────────────────────────────────────────── */}
        <ImportModal
          open={showImportModal}
          importing={importing}
          erpFile={erpFile}
          javelinFile={javelinFile}
          thresholdFile={thresholdFile}
          onErpFile={setErpFile}
          onJavelinFile={setJavelinFile}
          onThresholdFile={setThresholdFile}
          onClose={() => {
            setShowImportModal(false);
            setErpFile(null);
            setJavelinFile(null);
            setThresholdFile(null);
          }}
          onImport={handleImport}
        />

        {qrItem && (
          <QRLabelPopup
            item={qrItem}
            onClose={() => setQrItem(null)}
            toProperCase={toProperCase}
            parseDiscount={parseDiscount}
            parseHarga={parseHarga}
            formatRupiah={formatRupiah}
          />
        )}

        {showBarcodeModal && (
          <PrintBarcodeModal items={data} onClose={() => setShowBarcodeModal(false)} />
        )}

        <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
      </div>
    </div>
  );
}