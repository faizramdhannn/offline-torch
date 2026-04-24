"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { QRCodeSVG } from "qrcode.react";
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
  hpp: string;
  HPP?: string;
  hpt: string;
  HPT?: string;
  hpj: string;
  HPJ?: string;
  Artikel?: string;
}

interface LastUpdate {
  type: string;
  last_update: string;
}

const WAREHOUSES = [
  { name: "Margonda",   key: "Torch Margonda - T" },
  { name: "Karawaci",   key: "Torch Karawaci - T" },
  { name: "Jogja",      key: "Torch Jogja - T" },
  { name: "Medan",      key: "Torch Store Medan - T" },
  { name: "Makassar",   key: "Torch Makassar - T" },
  { name: "Tambun",     key: "Torch Tambun - T" },
  { name: "Malang",     key: "Torch Malang - T" },
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

// ── Drag & Drop Upload Zone ───────────────────────────────────────────────
function DropZone({
  file,
  onFile,
  label,
  disabled = false,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile, disabled]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);
  const handleClick = () => { if (!disabled) inputRef.current?.click(); };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null);
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      {file ? (
        <div className="flex items-center gap-2 p-2 rounded border border-green-300 bg-green-50">
          <div className="w-9 h-9 rounded border border-green-200 bg-green-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-800 truncate">{file.name}</p>
            <p className="text-[10px] text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1 rounded hover:bg-green-200 text-green-700 shrink-0"
            title="Hapus file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`cursor-pointer rounded border-2 border-dashed transition-all select-none
            flex flex-col items-center justify-center gap-1 py-5 px-3
            ${dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            }`}
        >
          <svg
            className={`w-7 h-7 transition-colors ${dragging ? "text-blue-500" : "text-gray-400"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className={`text-xs font-medium transition-colors ${dragging ? "text-blue-600" : "text-gray-600"}`}>
            {dragging ? "Lepaskan file di sini" : "Drag & drop atau klik untuk pilih"}
          </p>
          <p className="text-[10px] text-gray-400">CSV, XLSX, atau XLS</p>
        </div>
      )}
    </div>
  );
}

const CustomXTick = ({ x, y, payload }: any) => {
  const name: string = payload.value || "";
  const maxLen = 11;
  const label = name.length > maxLen ? name.slice(0, maxLen) + "…" : name;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={8.5}>
        {label}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", padding: "10px 14px", minWidth: "140px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Stock</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>{payload[0].value.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>SKU</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{payload[0].payload.sku}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const PCATooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", padding: "10px 14px", minWidth: "140px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Stock</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>{payload[0].value.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CategoryTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const half = Math.ceil(payload.length / 2);
    const col1 = payload.slice(0, half);
    const col2 = payload.slice(half);
    return (
      <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", padding: "10px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", gap: 20 }}>
          {[col1, col2].filter((col) => col.length > 0).map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {col.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color, flexShrink: 0, opacity: Number(p.value) === 0 ? 0.25 : 1 }} />
                  <span style={{ fontSize: 11, width: 72, color: Number(p.value) === 0 ? "#475569" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.dataKey}:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 28, textAlign: "right", color: Number(p.value) === 0 ? "#334155" : "#e2e8f0" }}>{Number(p.value).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const QRLabelPopup = ({ item, onClose }: { item: StockItem; onClose: () => void }) => {
  const toProperCase = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "500px", height: "200px", background: "#fff", border: "1px solid #d1d5db", borderRadius: "8px", display: "flex", alignItems: "stretch", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ flex: 1, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px", borderRight: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", letterSpacing: "0.04em" }}>{item.sku}</div>
          <div style={{ fontSize: "11px", color: "#374151", fontWeight: 500, lineHeight: 1.4, wordBreak: "break-word" }}>{toProperCase(item.item_name)}</div>
          {item.hpj && <div style={{ fontSize: "12px", color: "#000000", fontWeight: 700, marginTop: "4px" }}>{item.hpj}</div>}
        </div>
        <div style={{ width: "200px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", padding: "12px" }}>
          <QRCodeSVG value={item.sku} size={160} level="H" includeMargin={false} />
        </div>
      </div>
    </div>
  );
};

export default function StockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<StockItem[]>([]);
  const [filteredData, setFilteredData] = useState<StockItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<LastUpdate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<"store" | "pca" | "master">("store");

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<string[]>([]);
  const [hpjFilter, setHpjFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [erpFile, setErpFile] = useState<File | null>(null);
  const [javelinFile, setJavelinFile] = useState<File | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  const [chartMode, setChartMode] = useState<"store" | "category">("store");
  const [pcaChartMode, setPcaChartMode] = useState<"category" | "grade">("category");

  // collapse state — both open by default
  const [storeChartOpen, setStoreChartOpen] = useState(true);
  const [pcaChartOpen, setPcaChartOpen] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [qrItem, setQrItem] = useState<StockItem | null>(null);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const gradeDropdownRef = useRef<HTMLDivElement>(null);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node))
        setShowCategoryDropdown(false);
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(event.target as Node))
        setShowGradeDropdown(false);
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
  useEffect(() => { applyFilters(); }, [categoryFilter, gradeFilter, warehouseFilter, hpjFilter, searchQuery, data]);

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
      const normalizedData = result.map((item: any) => ({
        ...item,
        sku: item.sku || item.SKU || "",
        stock: item.stock || item.Stock || "",
        item_name: item.item_name || item.Product_name || "",
        category: item.category || item.Category || "",
        grade: item.grade || item.Grade || "",
        hpp: item.hpp || item.HPP || "",
        hpt: item.hpt || item.HPT || "",
        hpj: item.hpj || item.HPJ || "",
      }));
      setData(normalizedData);
      setFilteredData(normalizedData);
      setCategories([...new Set(normalizedData.map((i: StockItem) => i.category))].filter(Boolean) as string[]);
      setGrades([...new Set(normalizedData.map((i: StockItem) => i.grade))].filter(Boolean) as string[]);
      if (selectedView === "store")
        setWarehouses([...new Set(normalizedData.map((i: StockItem) => i.warehouse))].filter(Boolean) as string[]);
    } catch (error) {
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLastUpdate = async () => {
    try {
      const response = await fetch("/api/stock/last-update");
      setLastUpdate(await response.json());
    } catch {}
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

  const applyFilters = () => {
    let filtered = [...data];
    if (categoryFilter.length > 0) filtered = filtered.filter((i) => categoryFilter.includes(i.category));
    if (gradeFilter.length > 0) filtered = filtered.filter((i) => gradeFilter.includes(i.grade));
    if (selectedView === "store" && warehouseFilter.length > 0)
      filtered = filtered.filter((i) => i.warehouse && warehouseFilter.includes(i.warehouse));
    if (hpjFilter) {
      const hpjValue = parseInt(hpjFilter.replace(/[^0-9]/g, ""));
      filtered = filtered.filter((i) => parseInt(i.hpj?.replace(/[^0-9]/g, "") || "0") <= hpjValue);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) =>
        (i.sku && i.sku.toLowerCase().includes(q)) || (i.item_name && i.item_name.toLowerCase().includes(q))
      );
    }
    if (selectedView === "pca") {
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

  const resetFilters = () => {
    setCategoryFilter([]); setGradeFilter([]); setWarehouseFilter([]);
    setHpjFilter(""); setSearchQuery(""); setFilteredData(data); setCurrentPage(1);
  };

  const toggleCategory = (v: string) => setCategoryFilter((p) => p.includes(v) ? p.filter((c) => c !== v) : [...p, v]);
  const toggleGrade = (v: string) => setGradeFilter((p) => p.includes(v) ? p.filter((g) => g !== v) : [...p, v]);
  const toggleWarehouse = (v: string) => setWarehouseFilter((p) => p.includes(v) ? p.filter((w) => w !== v) : [...p, v]);

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
    if (!erpFile && !javelinFile) { showMessage("Please select at least one file to import", "error"); return; }
    setImporting(true);
    const results: string[] = [], errors: string[] = [];
    try {
      for (const [file, sheetName, label] of [
        [erpFile, "erp_stock_balance", "ERP Stock"],
        [javelinFile, "javelin", "Javelin"],
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
      if (user?.stock_view_hpp) base["HPP"] = item.hpp;
      if (user?.stock_view_hpt) base["HPT"] = item.hpt;
      if (user?.stock_view_hpj) base["HPJ"] = item.hpj;
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
      <div className="flex h-screen bg-gray-50">
        <Sidebar userName={user.name} permissions={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-semibold mb-2">No View Access</p>
            <p className="text-sm">You don't have permission to view any stock data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Stock Management</h1>

          {/* Import/Export & Last Update */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {user.stock_import && (
                  <button onClick={() => setShowImportModal(true)} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black">
                    Import Data
                  </button>
                )}
                {user.stock_export && (
                  <button onClick={exportToExcel} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black">
                    Export Stock
                  </button>
                )}
                {user.stock_refresh_javelin && (
                  <button onClick={handleRefreshJavelin} disabled={refreshing} className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed">
                    {refreshing ? "Refreshing..." : "Refresh Javelin"}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-600">
                {lastUpdate.map((lu) => (
                  <div key={lu.type}><span className="font-semibold">{lu.type}:</span> {lu.last_update}</div>
                ))}
              </div>
            </div>
          </div>

          {/* View Selection */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">Select View</label>
            <div className="flex gap-2">
              {user.stock_view_store && (
                <button onClick={() => setSelectedView("store")} className={`px-4 py-1.5 rounded text-xs transition-colors ${selectedView === "store" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Store</button>
              )}
              {user.stock_view_pca && (
                <button onClick={() => setSelectedView("pca")} className={`px-4 py-1.5 rounded text-xs transition-colors ${selectedView === "pca" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>PCA</button>
              )}
              {user.stock_view_master && (
                <button onClick={() => setSelectedView("master")} className={`px-4 py-1.5 rounded text-xs transition-colors ${selectedView === "master" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>Master</button>
              )}
            </div>
          </div>

          {/* Chart + Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">

            {/* ── STORE CHART ── */}
            {selectedView === "store" && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Stock Summary</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Total Stock:{" "}
                      <span className="font-bold text-gray-800">
                        {chartData.reduce((s, d) => s + d.stock, 0).toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {storeChartOpen && (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                        <button
                          onClick={() => setChartMode("store")}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartMode === "store" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Store
                        </button>
                        <button
                          onClick={() => setChartMode("category")}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${chartMode === "category" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Category
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setStoreChartOpen((v) => !v)}
                      className="flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                      title={storeChartOpen ? "Hide chart" : "Show chart"}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 transition-transform duration-200"
                        style={{ transform: storeChartOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                      >
                        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {storeChartOpen && (
                  <>
                    {chartMode === "store" && (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={32} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                          <Bar dataKey="stock" radius={[3, 3, 0, 0]} maxBarSize={32} label={{ position: "top", fontSize: 8, fill: "#6b7280", formatter: (v: any) => Number(v) > 0 ? Number(v).toLocaleString() : "" }}>
                            {chartData.map((entry, index) => {
                              const minStock = Math.min(...chartData.filter((d) => d.stock > 0).map((d) => d.stock));
                              const color = entry.stock === maxStock ? "#3de400" : entry.stock === minStock && entry.stock > 0 ? "#e20000" : "#cbe2ff";
                              return <Cell key={index} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {chartMode === "category" && (
                      <>
                        <div className="overflow-x-auto">
                          <div style={{ width: Math.max(900, categoryChartData.length * 60), minWidth: "100%" }}>
                            <BarChart
                              width={Math.max(900, categoryChartData.length * 60)}
                              height={220}
                              data={categoryChartData}
                              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                              barCategoryGap="20%"
                              barGap={1}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={32} />
                              <Tooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                              {WAREHOUSES.map((wh, i) => (
                                <Bar key={wh.name} dataKey={wh.name} fill={WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length]} radius={[2, 2, 0, 0]} maxBarSize={8} />
                              ))}
                            </BarChart>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                          {WAREHOUSES.map((wh, i) => (
                            <div key={wh.name} className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length] }} />
                              <span className="text-[10px] text-gray-500">{wh.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="border-t border-gray-100 mt-3 mb-4" />
              </div>
            )}

            {/* ── PCA CHART ── */}
            {selectedView === "pca" && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">PCA Stock Summary</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Total Stock:{" "}
                      <span className="font-bold text-gray-800">
                        {pcaTotalStock.toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pcaChartOpen && (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                        <button
                          onClick={() => setPcaChartMode("category")}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${pcaChartMode === "category" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Category
                        </button>
                        <button
                          onClick={() => setPcaChartMode("grade")}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${pcaChartMode === "grade" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Grade
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setPcaChartOpen((v) => !v)}
                      className="flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                      title={pcaChartOpen ? "Hide chart" : "Show chart"}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 transition-transform duration-200"
                        style={{ transform: pcaChartOpen ? "rotate(0deg)" : "rotate(180deg)" }}
                      >
                        <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                {pcaChartOpen && (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={pcaActiveData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={<CustomXTick />} axisLine={false} tickLine={false} interval={0} height={24} />
                        <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={32} />
                        <Tooltip content={<PCATooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                        <Bar dataKey="stock" radius={[3, 3, 0, 0]} maxBarSize={36} label={{ position: "top", fontSize: 8, fill: "#6b7280", formatter: (v: any) => Number(v) > 0 ? Number(v).toLocaleString() : "" }}>
                          {pcaActiveData.map((_, index) => (
                            <Cell key={index} fill={pcaActiveColors[index % pcaActiveColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {pcaActiveData.map((entry, i) => (
                        <div key={entry.name} className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: pcaActiveColors[i % pcaActiveColors.length] }} />
                          <span className="text-[10px] text-gray-500">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="border-t border-gray-100 mt-3 mb-4" />
              </div>
            )}

            {/* Filters */}
            <div>
              <div className="grid grid-cols-6 gap-3 mb-3">
                <div className="relative" ref={categoryDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <button onClick={() => setShowCategoryDropdown(!showCategoryDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                    <span className="text-gray-500">{categoryFilter.length === 0 ? "All" : `${categoryFilter.length} selected`}</span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      {categories.map((c) => (
                        <label key={c} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={categoryFilter.includes(c)} onChange={() => toggleCategory(c)} className="mr-2" />{c}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative" ref={gradeDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Grade</label>
                  <button onClick={() => setShowGradeDropdown(!showGradeDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                    <span className="text-gray-500">{gradeFilter.length === 0 ? "All" : `${gradeFilter.length} selected`}</span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  {showGradeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      {grades.map((g) => (
                        <label key={g} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={gradeFilter.includes(g)} onChange={() => toggleGrade(g)} className="mr-2" />{g}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {selectedView === "store" && (
                  <div className="relative" ref={warehouseDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Warehouse</label>
                    <button onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                      <span className="text-gray-500">{warehouseFilter.length === 0 ? "All" : `${warehouseFilter.length} selected`}</span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    {showWarehouseDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {warehouses.map((w) => (
                          <label key={w} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                            <input type="checkbox" checked={warehouseFilter.includes(w)} onChange={() => toggleWarehouse(w)} className="mr-2" />{w}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {user.stock_view_hpj && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max HPJ</label>
                    <input type="text" value={hpjFilter} onChange={(e) => setHpjFilter(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Filter by max HPJ" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                )}

                <div className={selectedView === "store" ? "col-span-2" : "col-span-3"}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by SKU or Product Name..." className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <button onClick={resetFilters} className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">Reset Filters</button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Image</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">SKU</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Product Name</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Category</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Grade</th>
                        {selectedView !== "master" && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Stock</th>}
                        {selectedView === "store" && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Warehouse</th>}
                        {user.stock_view_hpp && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">HPP</th>}
                        {user.stock_view_hpt && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">HPT</th>}
                        {user.stock_view_hpj && <th className="px-2 py-1.5 text-left font-semibold text-gray-700">HPJ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setQrItem(item)}>
                          <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                            {item.link_url || item.image_url ? (
                              <img
                                src={item.link_url || item.image_url}
                                alt={item.sku}
                                className="w-7 h-7 object-cover rounded"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="28" height="28"%3E%3Crect fill="%23ddd" width="28" height="28"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="9"%3ENo Img%3C/text%3E%3C/svg%3E'; }}
                              />
                            ) : (
                              <div className="w-7 h-7 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-[7px]">No Img</div>
                            )}
                          </td>
                          <td className="px-2 py-1">{item.sku}</td>
                          <td className="px-2 py-1">{toProperCase(item.item_name)}</td>
                          <td className="px-2 py-1">{toProperCase(item.category)}</td>
                          <td className="px-2 py-1">{toProperCase(item.grade)}</td>
                          {selectedView !== "master" && <td className="px-2 py-1">{item.stock}</td>}
                          {selectedView === "store" && <td className="px-2 py-1">{item.warehouse}</td>}
                          {user.stock_view_hpp && <td className="px-2 py-1">{item.hpp}</td>}
                          {user.stock_view_hpt && <td className="px-2 py-1">{item.hpt}</td>}
                          {user.stock_view_hpj && <td className="px-2 py-1">{item.hpj}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredData.length === 0 && <div className="p-8 text-center text-gray-500">No data available</div>}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Previous</button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                          return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-1">Import Stock Data</h2>
            <p className="text-xs text-gray-500 mb-5">Upload file untuk ERP Stock Balance dan/atau Javelin. Format: CSV, XLSX, atau XLS.</p>

            <div className="space-y-4">
              <DropZone
                label="ERP Stock Balance"
                file={erpFile}
                onFile={setErpFile}
                disabled={importing}
              />
              <DropZone
                label="Javelin"
                file={javelinFile}
                onFile={setJavelinFile}
                disabled={importing}
              />
              {importing && (
                <div className="text-sm text-gray-600 text-center py-3">
                  <div className="animate-pulse">Importing files... Please wait.</div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setShowImportModal(false); setErpFile(null); setJavelinFile(null); }}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (!erpFile && !javelinFile)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import Selected Files"}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrItem && <QRLabelPopup item={qrItem} onClose={() => setQrItem(null)} />}
      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}