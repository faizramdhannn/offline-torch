"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";

interface PettyCash {
  id: string;
  date: string;
  description: string;
  category: string;
  value: string;
  store: string;
  ket: string;
  transfer: string;
  link_url: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface BalanceEntry {
  id: string;
  type_balance: string;
  value: string;
  notes: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface BalanceData {
  balance: number;
  paid: number;
  unpaid: number;
  entries: BalanceEntry[];
}

interface ReportData {
  store: string;
  pettyCash: number;
  listrik: number;
  total: number;
}

interface CategoryDetail {
  category: string;
  description: string;
  example: string;
}

// ─── Drive Image Proxy Component ───────────────────────────────────────────────
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function DriveImage({ href, fileId, alt }: { href: string; fileId: string; alt: string }) {
  const proxyUrl = `/api/drive-image?id=${fileId}`;
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.min(z + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.max(z - 0.25, 0.5));
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom(1);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-40 flex items-center justify-center text-gray-700 font-bold text-sm leading-none"
        >
          −
        </button>
        <button
          onClick={handleReset}
          className="px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-[10px]"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-40 flex items-center justify-center text-gray-700 font-bold text-sm leading-none"
        >
          +
        </button>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px]"
        >
          Buka ↗
        </a>
      </div>
      <div className="overflow-auto max-h-60 max-w-full rounded-lg border bg-gray-50 flex items-center justify-center">
        <img
          src={proxyUrl}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s ease" }}
          className="max-h-60 max-w-full w-auto h-auto object-contain rounded-lg cursor-zoom-in"
          onClick={handleZoomIn}
        />
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────────

export default function PettyCashPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<PettyCash[]>([]);
  const [filteredData, setFilteredData] = useState<PettyCash[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PettyCash | null>(null);
  const [selectedBalanceEntry, setSelectedBalanceEntry] = useState<BalanceEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exporting2, setExporting2] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [updatingTransfer, setUpdatingTransfer] = useState<string | null>(null);
  useSessionGuard();

  // Detail popup
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [detailEntry, setDetailEntry] = useState<PettyCash | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "report" | "balance">("list");

  // Balance state
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [balanceDateFrom, setBalanceDateFrom] = useState("");
  const [balanceDateTo, setBalanceDateTo] = useState("");
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Balance form state
  const [balanceFormData, setBalanceFormData] = useState({
    type_balance: "credit",
    value: "",
    notes: "",
  });
  const [submittingBalance, setSubmittingBalance] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [transferFilter, setTransferFilter] = useState<string>("all");
  const [reportTransferFilter, setReportTransferFilter] = useState<"false" | "true">("false");

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const storeDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    description: "",
    category: "",
    value: "",
    ket: "",
    transfer: false,
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.petty_cash) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser.user_name, parsedUser.petty_cash_export);
    fetchCategories();
    fetchCategoryDetails();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dateFrom, dateTo, selectedCategories, selectedStores, transferFilter, data]);

  useEffect(() => {
    if (viewMode === "balance" && user && user.petty_cash_balance) {
      fetchBalance();
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "balance" && user && user.petty_cash_balance) {
      fetchBalance();
    }
  }, [balanceDateFrom, balanceDateTo]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string) => {
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: user.user_name,
          method,
          activity_log: activity,
        }),
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  const fetchData = async (username: string, isAdmin: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/petty-cash?username=${username}&isAdmin=${isAdmin}`
      );
      const result = await response.json();
      setData(result);
      setFilteredData(result);
      const uniqueStores = [
        ...new Set(result.map((item: PettyCash) => item.store)),
      ].filter(Boolean);
      setStores(uniqueStores as string[]);
    } catch (error) {
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      const result = await response.json();
      setCategories(result);
    } catch (error) {
      showMessage("Failed to fetch categories", "error");
    }
  };

  const fetchCategoryDetails = async () => {
    try {
      const response = await fetch("/api/categories?withDetails=true");
      const result = await response.json();
      setCategoryDetails(result);
    } catch (error) {
      console.error("Failed to fetch category details:", error);
    }
  };

  const fetchBalance = async () => {
    try {
      setLoadingBalance(true);
      const params = new URLSearchParams();
      if (balanceDateFrom) params.set("dateFrom", balanceDateFrom);
      if (balanceDateTo) params.set("dateTo", balanceDateTo);
      const response = await fetch(`/api/petty-cash/balance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch balance");
      const result = await response.json();
      setBalanceData(result);
    } catch (error) {
      showMessage("Failed to fetch balance data", "error");
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBalance(true);
    try {
      const response = await fetch("/api/petty-cash/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_balance: balanceFormData.type_balance,
          value: balanceFormData.value.replace(/[^0-9]/g, ""),
          notes: balanceFormData.notes,
          update_by: user.user_name,
        }),
      });
      if (response.ok) {
        await logActivity("POST", `Added balance entry: ${balanceFormData.type_balance} - ${balanceFormData.value}`);
        showMessage("Balance entry added successfully", "success");
        setShowAddBalanceModal(false);
        setBalanceFormData({ type_balance: "credit", value: "", notes: "" });
        fetchBalance();
      } else {
        showMessage("Failed to add balance entry", "error");
      }
    } catch (error) {
      showMessage("Failed to add balance entry", "error");
    } finally {
      setSubmittingBalance(false);
    }
  };

  const handleEditBalance = (entry: BalanceEntry) => {
    setSelectedBalanceEntry(entry);
    setBalanceFormData({
      type_balance: entry.type_balance,
      value: formatRupiah(entry.value),
      notes: entry.notes || "",
    });
    setShowEditBalanceModal(true);
  };

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBalanceEntry) return;
    setSubmittingBalance(true);
    try {
      const response = await fetch("/api/petty-cash/balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedBalanceEntry.id,
          type_balance: balanceFormData.type_balance,
          value: balanceFormData.value.replace(/[^0-9]/g, ""),
          notes: balanceFormData.notes,
          update_by: user.user_name,
        }),
      });
      if (response.ok) {
        await logActivity("PUT", `Updated balance entry ID: ${selectedBalanceEntry.id}`);
        showMessage("Balance entry updated successfully", "success");
        setShowEditBalanceModal(false);
        setSelectedBalanceEntry(null);
        setBalanceFormData({ type_balance: "credit", value: "", notes: "" });
        fetchBalance();
      } else {
        showMessage("Failed to update balance entry", "error");
      }
    } catch (error) {
      showMessage("Failed to update balance entry", "error");
    } finally {
      setSubmittingBalance(false);
    }
  };

  const handleDeleteBalance = async (id: string) => {
    if (!confirm("Are you sure you want to delete this balance entry?")) return;
    try {
      const response = await fetch(`/api/petty-cash/balance?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted balance entry ID: ${id}`);
        showMessage("Balance entry deleted successfully", "success");
        fetchBalance();
      } else {
        showMessage("Failed to delete balance entry", "error");
      }
    } catch (error) {
      showMessage("Failed to delete balance entry", "error");
    }
  };

  const handleQuickToggleTransfer = async (entry: PettyCash) => {
    if (!user.petty_cash_export) return;
    setUpdatingTransfer(entry.id);
    try {
      const form = new FormData();
      form.append("id", entry.id);
      form.append("description", entry.description || "");
      form.append("category", entry.category || "");
      form.append("value", (entry.value || "0").replace(/[^0-9]/g, ""));
      form.append("store", entry.store || "");
      form.append("ket", entry.ket || "");
      form.append("transfer", (entry.transfer !== "TRUE").toString());
      form.append("username", user.user_name);
      const response = await fetch("/api/petty-cash", { method: "PUT", body: form });
      if (response.ok) {
        await logActivity("PUT", `Quick toggled transfer status for entry ID: ${entry.id}`);
        fetchData(user.user_name, user.petty_cash_export);
      } else {
        showMessage("Failed to update transfer status", "error");
      }
    } catch (error) {
      showMessage("Failed to update transfer status", "error");
    } finally {
      setUpdatingTransfer(null);
    }
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return new Date(0);
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const parts = dateString.split(" ");
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
    }
    return new Date(dateString);
  };

  const parseDateInput = (dateInput: string, endOfDay = false) => {
    const [y, m, d] = dateInput.split("-").map(Number);
    if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (dateFrom) {
      const fromDate = parseDateInput(dateFrom);
      filtered = filtered.filter((item) => parseDate(item.date) >= fromDate);
    }
    if (dateTo) {
      const toDate = parseDateInput(dateTo, true);
      filtered = filtered.filter((item) => parseDate(item.date) <= toDate);
    }
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((item) => selectedCategories.includes(item.category));
    }
    if (selectedStores.length > 0) {
      filtered = filtered.filter((item) => selectedStores.includes(item.store));
    }
    if (transferFilter === "true") {
      filtered = filtered.filter((item) => item.transfer === "TRUE");
    } else if (transferFilter === "false") {
      filtered = filtered.filter((item) => item.transfer === "FALSE");
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedCategories([]);
    setSelectedStores([]);
    setTransferFilter("all");
    setReportTransferFilter("false");
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleStore = (store: string) => {
    setSelectedStores((prev) =>
      prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store]
    );
  };

  const toTitleCase = (str: string) =>
    (str || "").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  const formatRupiah = (value: string | number) => {
    const number =
      typeof value === "string"
        ? parseInt((value || "0").replace(/[^0-9]/g, "") || "0")
        : value || 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("description", formData.description);
      form.append("category", formData.category);
      form.append("value", formData.value.replace(/[^0-9]/g, ""));
      form.append("store", user.user_name);
      form.append("ket", formData.ket);
      form.append("transfer", formData.transfer.toString());
      form.append("username", user.user_name);
      if (formData.file) form.append("file", formData.file);
      const response = await fetch("/api/petty-cash", { method: "POST", body: form });
      if (response.ok) {
        await logActivity("POST", `Added petty cash: ${formData.category}`);
        showMessage("Entry added successfully", "success");
        setShowAddModal(false);
        setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null });
        fetchData(user.user_name, user.petty_cash_export);
      } else {
        showMessage("Failed to add entry", "error");
      }
    } catch (error) {
      showMessage("Failed to add entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: PettyCash) => {
    setSelectedEntry(entry);
    setFormData({
      description: entry.description || "",
      category: entry.category || "",
      value: formatRupiah(entry.value),
      ket: entry.ket || "",
      transfer: entry.transfer === "TRUE",
      file: null,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("id", selectedEntry.id);
      form.append("description", formData.description);
      form.append("category", formData.category);
      form.append("value", formData.value.replace(/[^0-9]/g, ""));
      form.append("store", selectedEntry.store);
      form.append("ket", formData.ket);
      form.append("transfer", formData.transfer.toString());
      form.append("username", user.user_name);
      if (formData.file) form.append("file", formData.file);
      const response = await fetch("/api/petty-cash", { method: "PUT", body: form });
      if (response.ok) {
        await logActivity("PUT", `Updated petty cash entry ID: ${selectedEntry.id}`);
        showMessage("Entry updated successfully", "success");
        setShowEditModal(false);
        setSelectedEntry(null);
        setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null });
        fetchData(user.user_name, user.petty_cash_export);
      } else {
        showMessage("Failed to update entry", "error");
      }
    } catch (error) {
      showMessage("Failed to update entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const response = await fetch(`/api/petty-cash?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted petty cash entry ID: ${id}`);
        showMessage("Entry deleted successfully", "success");
        fetchData(user.user_name, user.petty_cash_export);
      } else {
        showMessage("Failed to delete entry", "error");
      }
    } catch (error) {
      showMessage("Failed to delete entry", "error");
    }
  };

  const canEditDelete = (entry: PettyCash) =>
    user.petty_cash_export || entry.update_by === user.user_name;

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      Date: item.date,
      Description: toTitleCase(item.description),
      Category: item.category,
      Value: parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0"),
      Store: item.store,
      Ket: item.ket,
      Transfer: item.transfer === "TRUE" ? "Yes" : "No",
      Link: item.link_url || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash");
    XLSX.writeFile(wb, "petty_cash.xlsx");
    logActivity("GET", `Exported petty cash to Excel: ${filteredData.length} entries`);
  };

  const exportReportToExcel = () => {
    const reportData = generateReportData();
    const exportData = reportData.map((item) => ({
      Store: item.store,
      "Petty Cash": item.pettyCash,
      Listrik: item.listrik,
      Total: item.total,
    }));
    const grandTotal = {
      Store: "Grand Total",
      "Petty Cash": reportData.reduce((sum, item) => sum + item.pettyCash, 0),
      Listrik: reportData.reduce((sum, item) => sum + item.listrik, 0),
      Total: reportData.reduce((sum, item) => sum + item.total, 0),
    };
    exportData.push(grandTotal);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash Report");
    const transferStatus = reportTransferFilter === "false" ? "Belum_Transfer" : "Sudah_Transfer";
    XLSX.writeFile(wb, `petty_cash_report_${transferStatus}_${new Date().toISOString().split("T")[0]}.xlsx`);
    logActivity("GET", `Exported petty cash report to Excel: ${reportData.length} stores`);
  };

  const exportToDoc = async (type: 1 | 2) => {
    if (type === 1) setExporting(true);
    else setExporting2(true);
    try {
      const response = await fetch("/api/petty-cash/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filteredData,
          username: user.name,
          dateFrom,
          dateTo,
          exportType: type,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const suffix = type === 2 ? "_Summary" : "";
        a.download = `Petty_Cash${suffix}_${user.user_name}_${new Date().toISOString().split("T")[0]}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        await logActivity("GET", `Exported petty cash DOC type ${type}: ${filteredData.length} entries`);
        showMessage("Document exported successfully", "success");
      } else {
        showMessage("Failed to export document", "error");
      }
    } catch (error) {
      showMessage("Failed to export document", "error");
    } finally {
      if (type === 1) setExporting(false);
      else setExporting2(false);
    }
  };

  const generateReportData = (): ReportData[] => {
    let reportFilteredData = filteredData;
    if (reportTransferFilter === "false") {
      reportFilteredData = filteredData.filter((item) => item.transfer === "FALSE");
    } else if (reportTransferFilter === "true") {
      reportFilteredData = filteredData.filter((item) => item.transfer === "TRUE");
    }
    const uniqueStores = [...new Set(reportFilteredData.map((item) => item.store))];
    const reportData = uniqueStores.map((store) => {
      const storeData = reportFilteredData.filter((item) => item.store === store);
      const pettyCashData = storeData.filter((item) => {
        const desc = (item.description || "").toLowerCase();
        return !desc.includes("listrik") && !desc.includes("token");
      });
      const pettyCashTotal = pettyCashData.reduce((sum, item) => {
        return sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0");
      }, 0);
      const listrikData = storeData.filter((item) => {
        const desc = (item.description || "").toLowerCase();
        return desc.includes("listrik") || desc.includes("token");
      });
      const listrikTotal = listrikData.reduce((sum, item) => {
        return sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0");
      }, 0);
      return {
        store: toTitleCase(store),
        pettyCash: pettyCashTotal,
        listrik: listrikTotal,
        total: pettyCashTotal + listrikTotal,
      };
    });
    return reportData.sort((a, b) => a.store.localeCompare(b.store));
  };

  const calculateCreditDebit = () => {
    if (!balanceData) return { credit: 0, debit: 0 };
    const credit = balanceData.entries
      .filter((entry) => (entry.type_balance || "").toLowerCase() === "credit")
      .reduce((sum, entry) => sum + (parseInt((entry.value || "0").replace(/[^0-9]/g, "")) || 0), 0);
    const debit = balanceData.entries
      .filter((entry) => (entry.type_balance || "").toLowerCase() === "debit")
      .reduce((sum, entry) => sum + (parseInt((entry.value || "0").replace(/[^0-9]/g, "")) || 0), 0);
    return { credit, debit };
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const totalValue = filteredData.reduce((sum, item) => {
    return sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0");
  }, 0);

  if (!user) return null;

return (
  <div className="flex-1 overflow-auto">
    <div className="p-6">


      <div className="flex-1 overflow-auto">
        {/* ── Header: lebih compact ── */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-primary">Petty Cash</h1>
              <button
                onClick={() => setShowInfoModal(true)}
                className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 text-[10px] font-bold"
                title="Category Information"
              >
                i
              </button>
            </div>
            <div className="flex gap-1.5">
              {user.petty_cash_add && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 bg-gray-500 text-white rounded text-[11px] hover:bg-primary/90"
                >
                  + Add Petty Cash
                </button>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="bg-white rounded-lg shadow px-3 py-2 mb-3">
            <div className="flex gap-1.5">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded text-[11px] transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-3 py-1 rounded text-[11px] transition-colors ${viewMode === "report" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                Report View
              </button>
              {user.petty_cash_balance && (
                <button
                  onClick={() => setViewMode("balance")}
                  className={`px-3 py-1 rounded text-[11px] transition-colors ${viewMode === "balance" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  Balance
                </button>
              )}
            </div>
          </div>

          {/* ── BALANCE VIEW ── */}
          {viewMode === "balance" && user.petty_cash_balance ? (
            <div>
              <div className="bg-white rounded-lg shadow px-3 py-2 mb-3">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Date From</label>
                    <input type="date" value={balanceDateFrom} onChange={(e) => setBalanceDateFrom(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Date To</label>
                    <input type="date" value={balanceDateTo} onChange={(e) => setBalanceDateTo(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setBalanceDateFrom(""); setBalanceDateTo(""); }} className="px-3 py-1 bg-gray-500 text-white rounded text-[11px] hover:bg-gray-600">
                      Reset
                    </button>
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => setShowAddBalanceModal(true)} className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90">
                      + Add Balance
                    </button>
                  </div>
                </div>
              </div>

              {loadingBalance ? (
                <div className="p-6 text-center bg-white rounded-lg shadow text-sm">Loading...</div>
              ) : balanceData ? (
                <>
                  {/* Summary cards — compact */}
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    {[
                      { label: "Balance", value: Math.abs(balanceData.balance), color: balanceData.balance >= 0 ? "text-green-600" : "text-red-600", sub: balanceData.balance >= 0 ? "Surplus" : "Deficit" },
                      { label: "Credit", value: calculateCreditDebit().credit, color: "text-green-600", sub: "Total pemasukan" },
                      { label: "Debit", value: calculateCreditDebit().debit, color: "text-red-600", sub: "Total pengeluaran" },
                      { label: "Paid", value: balanceData.paid, color: "text-blue-600", sub: "Sudah ditransfer" },
                      { label: "Unpaid", value: balanceData.unpaid, color: "text-orange-500", sub: "Belum ditransfer" },
                    ].map((card) => (
                      <div key={card.label} className="bg-white rounded-lg shadow px-3 py-2.5">
                        <p className="text-[10px] text-gray-500 mb-0.5">{card.label}</p>
                        <p className={`text-sm font-bold ${card.color}`}>{formatRupiah(card.value)}</p>
                        <p className="text-[10px] text-gray-400">{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-3 py-2 border-b bg-gray-50">
                      <h3 className="text-[11px] font-semibold text-gray-700">Balance History</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            {["Date", "Type", "Value", "Notes", "Update By", "Actions"].map((h) => (
                              <th key={h} className="px-3 py-1.5 text-left font-semibold text-gray-700">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {balanceData.entries.map((entry, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                {entry.created_at ? new Date(entry.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${(entry.type_balance || "").toLowerCase() === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {toTitleCase(entry.type_balance || "")}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={(entry.type_balance || "").toLowerCase() === "credit" ? "text-green-600" : "text-red-600"}>
                                  {(entry.type_balance || "").toLowerCase() === "credit" ? "+" : "-"}{formatRupiah(entry.value)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">{entry.notes || "-"}</td>
                              <td className="px-3 py-1.5">{entry.update_by || "-"}</td>
                              <td className="px-3 py-1.5">
                                <div className="flex gap-1">
                                  <button onClick={() => handleEditBalance(entry)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600">Edit</button>
                                  <button onClick={() => handleDeleteBalance(entry.id)} className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-600">Del</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {balanceData.entries.length === 0 && (
                        <div className="p-6 text-center text-gray-500 text-xs">No balance entries found</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center bg-white rounded-lg shadow text-gray-500 text-xs">No data available</div>
              )}
            </div>
          ) : viewMode === "balance" && !user.petty_cash_balance ? (
            <div className="p-6 text-center bg-white rounded-lg shadow">
              <p className="text-gray-500 text-xs">You don&apos;t have permission to access Balance.</p>
            </div>
          ) : (
            <>
              {/* ── Filters: compact ── */}
              <div className="bg-white rounded-lg shadow px-3 py-2.5 mb-3">
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  {viewMode === "list" ? (
                    <>
                      {/* Category Dropdown */}
                      <div className="relative" ref={categoryDropdownRef}>
                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Category</label>
                        <button onClick={() => setShowCategoryDropdown(!showCategoryDropdown)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500 truncate">{selectedCategories.length === 0 ? "Select..." : `${selectedCategories.length} selected`}</span>
                          <span className="text-gray-400 text-[9px]">▼</span>
                        </button>
                        {showCategoryDropdown && (
                          <div className="absolute z-10 w-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-44 overflow-y-auto">
                            <label className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50 border-b border-gray-200 font-medium bg-gray-50">
                              <input type="checkbox" checked={selectedCategories.length === categories.length && categories.length > 0} onChange={() => { selectedCategories.length === categories.length ? setSelectedCategories([]) : setSelectedCategories([...categories]); }} className="mr-1.5 w-3 h-3" />
                              Select All
                            </label>
                            {categories.map((category) => (
                              <label key={category} className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} className="mr-1.5 w-3 h-3" />
                                {category}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Store Dropdown */}
                      <div className="relative" ref={storeDropdownRef}>
                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Store</label>
                        <button onClick={() => setShowStoreDropdown(!showStoreDropdown)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500 truncate">{selectedStores.length === 0 ? "Select..." : `${selectedStores.length} selected`}</span>
                          <span className="text-gray-400 text-[9px]">▼</span>
                        </button>
                        {showStoreDropdown && (
                          <div className="absolute z-10 w-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-44 overflow-y-auto">
                            <label className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50 border-b border-gray-200 font-medium bg-gray-50">
                              <input type="checkbox" checked={selectedStores.length === stores.length && stores.length > 0} onChange={() => { selectedStores.length === stores.length ? setSelectedStores([]) : setSelectedStores([...stores]); }} className="mr-1.5 w-3 h-3" />
                              Select All
                            </label>
                            {stores.map((store) => (
                              <label key={store} className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedStores.includes(store)} onChange={() => toggleStore(store)} className="mr-1.5 w-3 h-3" />
                                {store}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Transfer</label>
                        <select value={transferFilter} onChange={(e) => setTransferFilter(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="all">All</option>
                          <option value="false">Belum</option>
                          <option value="true">Sudah</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative" ref={storeDropdownRef}>
                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Store</label>
                        <button onClick={() => setShowStoreDropdown(!showStoreDropdown)} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500 truncate">{selectedStores.length === 0 ? "All stores..." : `${selectedStores.length} selected`}</span>
                          <span className="text-gray-400 text-[9px]">▼</span>
                        </button>
                        {showStoreDropdown && (
                          <div className="absolute z-10 w-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-44 overflow-y-auto">
                            <label className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50 border-b border-gray-200 font-medium bg-gray-50">
                              <input type="checkbox" checked={selectedStores.length === stores.length && stores.length > 0} onChange={() => { selectedStores.length === stores.length ? setSelectedStores([]) : setSelectedStores([...stores]); }} className="mr-1.5 w-3 h-3" />
                              Select All
                            </label>
                            {stores.map((store) => (
                              <label key={store} className="flex items-center text-[11px] px-2.5 py-1.5 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedStores.includes(store)} onChange={() => toggleStore(store)} className="mr-1.5 w-3 h-3" />
                                {store}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Transfer Status</label>
                        <select value={reportTransferFilter} onChange={(e) => setReportTransferFilter(e.target.value as "false" | "true")} className="w-full px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="false">Belum Transfer</option>
                          <option value="true">Sudah Transfer</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={resetFilters} className="px-2.5 py-1 bg-gray-500 text-white rounded text-[11px] hover:bg-gray-600">Reset</button>
                  {user.petty_cash_export && (
                    <>
                      {viewMode === "list" ? (
                        <>
                          <button onClick={exportToExcel} className="px-2.5 py-1 bg-gray-400 text-white rounded text-[11px] hover:bg-secondary/90 ml-auto">Export XLSX</button>
                          <button onClick={() => exportToDoc(1)} disabled={exporting} className="px-2.5 py-1 bg-gray-400 text-white rounded text-[11px] hover:bg-blue-700 disabled:opacity-50">
                            {exporting ? "..." : "Export DOC"}
                          </button>
                          <button onClick={() => exportToDoc(2)} disabled={exporting2} className="px-2.5 py-1 bg-gray-400 text-white rounded text-[11px] hover:bg-blue-700 disabled:opacity-50">
                            {exporting2 ? "..." : "Export DOC 2"}
                          </button>
                        </>
                      ) : (
                        <button onClick={exportReportToExcel} className="px-2.5 py-1 bg-gray-400 text-white rounded text-[11px] hover:bg-secondary/90 ml-auto">Export Report XLSX</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── Table ── */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                  <div className="p-6 text-center text-sm">Loading...</div>
                ) : viewMode === "report" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-semibold text-gray-700">Store</th>
                          <th className="px-3 py-1.5 text-right font-semibold text-gray-700">Petty Cash</th>
                          <th className="px-3 py-1.5 text-right font-semibold text-gray-700">Listrik</th>
                          <th className="px-3 py-1.5 text-right font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateReportData().map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-1.5">{item.store}</td>
                            <td className="px-3 py-1.5 text-right">{formatRupiah(item.pettyCash)}</td>
                            <td className="px-3 py-1.5 text-right">{formatRupiah(item.listrik)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-green-600">{formatRupiah(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-3 py-1.5">Grand Total</td>
                          <td className="px-3 py-1.5 text-right">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.pettyCash, 0))}</td>
                          <td className="px-3 py-1.5 text-right">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.listrik, 0))}</td>
                          <td className="px-3 py-1.5 text-right text-green-600">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.total, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                    {generateReportData().length === 0 && <div className="p-6 text-center text-gray-500 text-xs">No data available</div>}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-16">Date</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-28">Description</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-20">Category</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-24">Value</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-16">Store</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-24">Dana Talang</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-14">Transfer</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-12">Link</th>
                            <th className="px-2 py-1.5 text-center font-semibold text-gray-700 w-20">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentItems.map((item, index) => (
                            <tr
                              key={index}
                              className="border-b hover:bg-gray-50 cursor-pointer"
                              onClick={() => { setDetailEntry(item); setShowDetailPopup(true); }}
                            >
                              <td className="px-2 py-1 text-gray-600">{item.date}</td>
                              <td className="px-2 py-1 truncate max-w-[112px]">{item.description}</td>
                              <td className="px-2 py-1">{item.category}</td>
                              <td className="px-2 py-1">{formatRupiah(item.value)}</td>
                              <td className="px-2 py-1 truncate">{item.store}</td>
                              <td className="px-2 py-1 truncate">{item.ket || "-"}</td>
                              <td className="px-2 py-1 text-center">
                                {user.petty_cash_export ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickToggleTransfer(item); }}
                                    disabled={updatingTransfer === item.id}
                                    className={`w-4 h-4 flex items-center justify-center rounded border-2 transition-colors mx-auto ${item.transfer === "TRUE" ? "bg-green-500 border-green-500" : "bg-white border-gray-300 hover:border-green-500"} ${updatingTransfer === item.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                                  >
                                    {item.transfer === "TRUE" && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    )}
                                  </button>
                                ) : (
                                  <span>{item.transfer === "TRUE" ? "✓" : "-"}</span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {item.link_url ? (
                                  <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                    View
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                {canEditDelete(item) && (
                                  <div className="flex gap-0.5 justify-center">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                      className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                      className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] hover:bg-red-600"
                                    >
                                      Del
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={3} className="px-2 py-1.5 text-right text-[11px]">Total:</td>
                            <td className="px-2 py-1.5 text-[11px]">{formatRupiah(totalValue)}</td>
                            <td colSpan={5}></td>
                          </tr>
                        </tbody>
                      </table>
                      {filteredData.length === 0 && <div className="p-6 text-center text-gray-500 text-xs">No data available</div>}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex justify-between items-center px-3 py-2 border-t">
                        <div className="text-[10px] text-gray-600">
                          {indexOfFirstItem + 1}–{Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length}
                        </div>
                        <div className="flex gap-0.5">
                          <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-2 py-0.5 text-[10px] border rounded disabled:opacity-50 hover:bg-gray-50">Prev</button>
                          {[...Array(totalPages)].map((_, i) => {
                            const page = i + 1;
                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                              return (
                                <button key={page} onClick={() => setCurrentPage(page)} className={`px-2 py-0.5 text-[10px] border rounded ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}>
                                  {page}
                                </button>
                              );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                              return <span key={page} className="px-1 text-[10px] self-center">...</span>;
                            }
                            return null;
                          })}
                          <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-2 py-0.5 text-[10px] border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Detail Popup ── */}
      {showDetailPopup && detailEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setShowDetailPopup(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {detailEntry.link_url && extractDriveFileId(detailEntry.link_url) ? (
              <div className="flex justify-center p-3 bg-gray-50 border-b">
                <DriveImage href={detailEntry.link_url} fileId={extractDriveFileId(detailEntry.link_url)!} alt="Receipt" />
              </div>
            ) : detailEntry.link_url ? (
              <div className="flex justify-center p-3 bg-gray-50 border-b">
                <a href={detailEntry.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Receipt</a>
              </div>
            ) : (
              <div className="h-10 bg-gray-100 flex items-center justify-center text-gray-400 text-xs border-b">No receipt</div>
            )}

            <div className="px-4 pt-3 pb-0.5">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{toTitleCase(detailEntry.store)}</p>
            </div>

            <div className="px-4 pb-3 pt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Date</p>
                <p className="font-semibold text-gray-800">{detailEntry.date || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Category</p>
                <p className="font-semibold text-gray-800">{detailEntry.category || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Description</p>
                <p className="font-semibold text-gray-800">{detailEntry.description || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Value</p>
                <p className="font-semibold text-green-700">{formatRupiah(detailEntry.value)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Transfer</p>
                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${detailEntry.transfer === "TRUE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {detailEntry.transfer === "TRUE" ? "Sudah" : "Belum"}
                </span>
              </div>
              {detailEntry.ket && (
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400 font-medium mb-0.5">Dana Talang</p>
                  <p className="text-gray-800 whitespace-pre-wrap text-xs">{detailEntry.ket}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-400 font-medium mb-0.5">Update By</p>
                <p className="font-semibold text-gray-800">{detailEntry.update_by || "-"}</p>
              </div>
            </div>

            <div className="px-4 pb-3 flex justify-end border-t pt-2">
              <button onClick={() => setShowDetailPopup(false)} className="px-3 py-1 bg-gray-500 text-white rounded text-[11px] hover:bg-gray-600">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Balance Modal */}
      {showAddBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full mx-4">
            <h2 className="text-sm font-bold text-primary mb-3">Add Balance Entry</h2>
            <form onSubmit={handleAddBalance} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Type*</label>
                <select value={balanceFormData.type_balance} onChange={(e) => setBalanceFormData({ ...balanceFormData, type_balance: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required>
                  <option value="credit">Credit (Pemasukan)</option>
                  <option value="debit">Debit (Pengeluaran)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Value*</label>
                <input type="text" value={balanceFormData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setBalanceFormData({ ...balanceFormData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Notes</label>
                <textarea value={balanceFormData.notes} onChange={(e) => setBalanceFormData({ ...balanceFormData, notes: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" rows={2} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowAddBalanceModal(false); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }} disabled={submittingBalance} className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submittingBalance} className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 disabled:opacity-50">{submittingBalance ? "Submitting..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {showEditBalanceModal && selectedBalanceEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full mx-4">
            <h2 className="text-sm font-bold text-primary mb-3">Edit Balance Entry</h2>
            <form onSubmit={handleUpdateBalance} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Type*</label>
                <select value={balanceFormData.type_balance} onChange={(e) => setBalanceFormData({ ...balanceFormData, type_balance: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required>
                  <option value="credit">Credit (Pemasukan)</option>
                  <option value="debit">Debit (Pengeluaran)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Value*</label>
                <input type="text" value={balanceFormData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setBalanceFormData({ ...balanceFormData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Notes</label>
                <textarea value={balanceFormData.notes} onChange={(e) => setBalanceFormData({ ...balanceFormData, notes: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" rows={2} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowEditBalanceModal(false); setSelectedBalanceEntry(null); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }} disabled={submittingBalance} className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submittingBalance} className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 disabled:opacity-50">{submittingBalance ? "Updating..." : "Update Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white rounded-lg p-5 max-w-4xl w-full mx-4 my-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-primary mb-3">Petty Cash Category Information</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-300">Category</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-300">Description</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 border border-gray-300">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryDetails.map((detail, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-300 font-medium">{detail.category}</td>
                      <td className="px-3 py-1.5 border border-gray-300">{detail.description}</td>
                      <td className="px-3 py-1.5 border border-gray-300 text-gray-600">{detail.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categoryDetails.length === 0 && <div className="p-6 text-center text-gray-500 text-xs">No category information available</div>}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowInfoModal(false)} className="px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 max-w-xl w-full mx-4 my-6">
            <h2 className="text-sm font-bold text-primary mb-3">Add Petty Cash Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Description*</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Category*</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select Category</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Value*</label>
                  <input type="text" value={formData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setFormData({ ...formData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Store</label>
                  <input type="text" value={user.user_name} disabled className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Dana Talang</label>
                  <textarea value={formData.ket} onChange={(e) => setFormData({ ...formData, ket: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
                </div>
                <div>
                  <label className="flex items-center text-xs cursor-pointer gap-1.5">
                    <input type="checkbox" checked={formData.transfer} onChange={(e) => setFormData({ ...formData, transfer: e.target.checked })} className="w-3 h-3" />
                    Transfer
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Upload Receipt</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90" />
                  {formData.file && <p className="text-[10px] text-gray-500 mt-0.5">Selected: {formData.file.name}</p>}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }} disabled={submitting} className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 disabled:opacity-50">{submitting ? "Submitting..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 max-w-xl w-full mx-4 my-6">
            <h2 className="text-sm font-bold text-primary mb-3">Edit Petty Cash Entry</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Description*</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Category*</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select Category</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Value*</label>
                  <input type="text" value={formData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setFormData({ ...formData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Store</label>
                  <input type="text" value={selectedEntry.store} disabled className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Dana Talang</label>
                  <textarea value={formData.ket} onChange={(e) => setFormData({ ...formData, ket: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary" rows={2} />
                </div>
                <div>
                  <label className="flex items-center text-xs cursor-pointer gap-1.5">
                    <input type="checkbox" checked={formData.transfer} onChange={(e) => setFormData({ ...formData, transfer: e.target.checked })} className="w-3 h-3" />
                    Transfer
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Upload Receipt (Optional - will replace existing)</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90" />
                  {formData.file && <p className="text-[10px] text-gray-500 mt-0.5">Selected: {formData.file.name}</p>}
                  {selectedEntry.link_url && !formData.file && (
                    <p className="text-[10px] text-blue-600 mt-0.5">Current file: <a href={selectedEntry.link_url} target="_blank" rel="noopener noreferrer">View</a></p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedEntry(null); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }} disabled={submitting} className="flex-1 px-3 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 disabled:opacity-50">{submitting ? "Updating..." : "Update Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  </div>
  );
}