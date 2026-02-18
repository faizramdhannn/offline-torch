"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-40 flex items-center justify-center text-gray-700 font-bold text-lg leading-none"
        >
          −
        </button>
        <button
          onClick={handleReset}
          className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-40 flex items-center justify-center text-gray-700 font-bold text-lg leading-none"
        >
          +
        </button>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs"
        >
          Buka ↗
        </a>
      </div>

      {/* Image with zoom */}
      <div className="overflow-auto max-h-72 max-w-full rounded-lg border bg-gray-50 flex items-center justify-center">
        <img
          src={proxyUrl}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s ease" }}
          className="max-h-72 max-w-full w-auto h-auto object-contain rounded-lg cursor-zoom-in"
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
      form.append("description", entry.description);
      form.append("category", entry.category);
      form.append("value", entry.value.replace(/[^0-9]/g, ""));
      form.append("store", entry.store);
      form.append("ket", entry.ket);
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
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const parts = dateString.split(" ");
    return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((item) => parseDate(item.date) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
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
    str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  const formatRupiah = (value: string | number) => {
    const number =
      typeof value === "string"
        ? parseInt(value.replace(/[^0-9]/g, "") || "0")
        : value;
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
      description: entry.description,
      category: entry.category,
      value: formatRupiah(entry.value),
      ket: entry.ket,
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
      Value: parseInt(item.value || "0"),
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
        const desc = item.description.toLowerCase();
        return !desc.includes("listrik") && !desc.includes("token");
      });
      const pettyCashTotal = pettyCashData.reduce((sum, item) => {
        return sum + parseInt(item.value.replace(/[^0-9]/g, "") || "0");
      }, 0);
      const listrikData = storeData.filter((item) => {
        const desc = item.description.toLowerCase();
        return desc.includes("listrik") || desc.includes("token");
      });
      const listrikTotal = listrikData.reduce((sum, item) => {
        return sum + parseInt(item.value.replace(/[^0-9]/g, "") || "0");
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
    return sum + parseInt(item.value.replace(/[^0-9]/g, "") || "0");
  }, 0);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary">Petty Cash</h1>
              <button
                onClick={() => setShowInfoModal(true)}
                className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 text-xs font-bold"
                title="Category Information"
              >
                i
              </button>
            </div>
            <div className="flex gap-2">
              {user.petty_cash_add && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-primary/90"
                >
                  Add Petty Cash
                </button>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-1.5 rounded text-xs transition-colors ${viewMode === "list" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-4 py-1.5 rounded text-xs transition-colors ${viewMode === "report" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
              >
                Report View
              </button>
              {user.petty_cash_balance && (
                <button
                  onClick={() => setViewMode("balance")}
                  className={`px-4 py-1.5 rounded text-xs transition-colors ${viewMode === "balance" ? "bg-primary text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  Balance
                </button>
              )}
            </div>
          </div>

          {viewMode === "balance" && user.petty_cash_balance ? (
            <div>
              {/* Balance Date Filter */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                    <input type="date" value={balanceDateFrom} onChange={(e) => setBalanceDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                    <input type="date" value={balanceDateTo} onChange={(e) => setBalanceDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => { setBalanceDateFrom(""); setBalanceDateTo(""); }} className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">
                      Reset
                    </button>
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => setShowAddBalanceModal(true)} className="px-4 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90">
                      Add Balance
                    </button>
                  </div>
                </div>
              </div>

              {loadingBalance ? (
                <div className="p-8 text-center bg-white rounded-lg shadow">Loading...</div>
              ) : balanceData ? (
                <>
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">Balance</p>
                      <p className={`text-lg font-bold ${balanceData.balance >= 0 ? "text-green-600" : "text-red-600"}`}>{formatRupiah(Math.abs(balanceData.balance))}</p>
                      <p className="text-xs text-gray-400">{balanceData.balance >= 0 ? "Surplus" : "Deficit"}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">Credit</p>
                      <p className="text-lg font-bold text-green-600">{formatRupiah(calculateCreditDebit().credit)}</p>
                      <p className="text-xs text-gray-400">Total pemasukan</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">Debit</p>
                      <p className="text-lg font-bold text-red-600">{formatRupiah(calculateCreditDebit().debit)}</p>
                      <p className="text-xs text-gray-400">Total pengeluaran</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">Paid</p>
                      <p className="text-lg font-bold text-blue-600">{formatRupiah(balanceData.paid)}</p>
                      <p className="text-xs text-gray-400">Transfer sudah dilakukan</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                      <p className="text-xs text-gray-500 mb-1">Unpaid</p>
                      <p className="text-lg font-bold text-orange-500">{formatRupiah(balanceData.unpaid)}</p>
                      <p className="text-xs text-gray-400">Belum ditransfer</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-700">Balance History</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700">Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Update By</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceData.entries.map((entry, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2">
                                {entry.created_at ? new Date(entry.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(entry.type_balance || "").toLowerCase() === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {toTitleCase(entry.type_balance || "")}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={(entry.type_balance || "").toLowerCase() === "credit" ? "text-green-600" : "text-red-600"}>
                                  {(entry.type_balance || "").toLowerCase() === "credit" ? "+" : "-"}{formatRupiah(entry.value)}
                                </span>
                              </td>
                              <td className="px-3 py-2">{entry.notes || "-"}</td>
                              <td className="px-3 py-2">{entry.update_by || "-"}</td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1 justify-center">
                                  <button onClick={() => handleEditBalance(entry)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">Edit</button>
                                  <button onClick={() => handleDeleteBalance(entry.id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {balanceData.entries.length === 0 && (
                        <div className="p-8 text-center text-gray-500">No balance entries found</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-white rounded-lg shadow text-gray-500">No data available</div>
              )}
            </div>
          ) : viewMode === "balance" && !user.petty_cash_balance ? (
            <div className="p-8 text-center bg-white rounded-lg shadow">
              <p className="text-gray-500 text-sm">You don&apos;t have permission to access Balance.</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  {viewMode === "list" ? (
                    <>
                      <div className="relative" ref={categoryDropdownRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                        <button onClick={() => setShowCategoryDropdown(!showCategoryDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500">{selectedCategories.length === 0 ? "Select category..." : `${selectedCategories.length} selected`}</span>
                          <span className="text-gray-400">▼</span>
                        </button>
                        {showCategoryDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                            {categories.map((category) => (
                              <label key={category} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} className="mr-2" />
                                {category}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative" ref={storeDropdownRef}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                        <button onClick={() => setShowStoreDropdown(!showStoreDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500">{selectedStores.length === 0 ? "Select store..." : `${selectedStores.length} selected`}</span>
                          <span className="text-gray-400">▼</span>
                        </button>
                        {showStoreDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                            {stores.map((store) => (
                              <label key={store} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedStores.includes(store)} onChange={() => toggleStore(store)} className="mr-2" />
                                {store}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Status</label>
                        <select value={transferFilter} onChange={(e) => setTransferFilter(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="all">All</option>
                          <option value="false">Belum Transfer</option>
                          <option value="true">Sudah Transfer</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                        <button onClick={() => setShowStoreDropdown(!showStoreDropdown)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center">
                          <span className="text-gray-500">{selectedStores.length === 0 ? "All stores..." : `${selectedStores.length} selected`}</span>
                          <span className="text-gray-400">▼</span>
                        </button>
                        {showStoreDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                            {stores.map((store) => (
                              <label key={store} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                                <input type="checkbox" checked={selectedStores.includes(store)} onChange={() => toggleStore(store)} className="mr-2" />
                                {store}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Status</label>
                        <select value={reportTransferFilter} onChange={(e) => setReportTransferFilter(e.target.value as "false" | "true")} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="false">Belum Transfer</option>
                          <option value="true">Sudah Transfer</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={resetFilters} className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600">Reset</button>
                  {user.petty_cash_export && (
                    <>
                      {viewMode === "list" ? (
                        <>
                          <button onClick={exportToExcel} className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto">Export XLSX</button>
                          <button onClick={() => exportToDoc(1)} disabled={exporting} className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                            {exporting ? "Exporting..." : "Export DOC"}
                          </button>
                          <button onClick={() => exportToDoc(2)} disabled={exporting2} className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                            {exporting2 ? "Exporting..." : "Export DOC 2"}
                          </button>
                        </>
                      ) : (
                        <button onClick={exportReportToExcel} className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto">Export Report XLSX</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center">Loading...</div>
                ) : viewMode === "report" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Store</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Petty Cash</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Listrik</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateReportData().map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">{item.store}</td>
                            <td className="px-4 py-3 text-right">{formatRupiah(item.pettyCash)}</td>
                            <td className="px-4 py-3 text-right">{formatRupiah(item.listrik)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">{formatRupiah(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-4 py-3">Grand Total</td>
                          <td className="px-4 py-3 text-right">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.pettyCash, 0))}</td>
                          <td className="px-4 py-3 text-right">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.listrik, 0))}</td>
                          <td className="px-4 py-3 text-right text-green-600">{formatRupiah(generateReportData().reduce((sum, item) => sum + item.total, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                    {generateReportData().length === 0 && <div className="p-8 text-center text-gray-500">No data available</div>}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Date</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">Description</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Category</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Store</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Dana Talang</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">Transfer</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">Link</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700 w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentItems.map((item, index) => (
                            <tr
                              key={index}
                              className="border-b hover:bg-gray-50 cursor-pointer"
                              onClick={() => { setDetailEntry(item); setShowDetailPopup(true); }}
                            >
                              <td className="px-3 py-2">{item.date}</td>
                              <td className="px-3 py-2">{item.description}</td>
                              <td className="px-3 py-2">{item.category}</td>
                              <td className="px-3 py-2">{formatRupiah(item.value)}</td>
                              <td className="px-3 py-2">{item.store}</td>
                              <td className="px-3 py-2">{item.ket || "-"}</td>
                              <td className="px-3 py-2 text-center">
                                {user.petty_cash_export ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleQuickToggleTransfer(item); }}
                                    disabled={updatingTransfer === item.id}
                                    className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-colors mx-auto ${item.transfer === "TRUE" ? "bg-green-500 border-green-500" : "bg-white border-gray-300 hover:border-green-500"} ${updatingTransfer === item.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                                  >
                                    {item.transfer === "TRUE" && (
                                      <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M5 13l4 4L19 7"></path>
                                      </svg>
                                    )}
                                  </button>
                                ) : (
                                  <span>{item.transfer === "TRUE" ? "✓" : "-"}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {item.link_url ? (
                                  <a
                                    href={item.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {canEditDelete(item) && (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right">Total:</td>
                            <td className="px-3 py-2">{formatRupiah(totalValue)}</td>
                            <td colSpan={5}></td>
                          </tr>
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
                          <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Previous</button>
                          {[...Array(totalPages)].map((_, i) => {
                            const page = i + 1;
                            if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                              return (
                                <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}>
                                  {page}
                                </button>
                              );
                            } else if (page === currentPage - 2 || page === currentPage + 2) {
                              return <span key={page} className="px-2">...</span>;
                            }
                            return null;
                          })}
                          <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Next</button>
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

      {/* ─── Detail Popup ─────────────────────────────────────────────────────── */}
      {showDetailPopup && detailEntry && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setShowDetailPopup(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt Image */}
            {detailEntry.link_url && extractDriveFileId(detailEntry.link_url) ? (
              <div className="flex justify-center p-4 bg-gray-50 border-b">
                <DriveImage
                  href={detailEntry.link_url}
                  fileId={extractDriveFileId(detailEntry.link_url)!}
                  alt="Receipt"
                />
              </div>
            ) : detailEntry.link_url ? (
              <div className="flex justify-center p-4 bg-gray-50 border-b">
                <a
                  href={detailEntry.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Receipt
                </a>
              </div>
            ) : (
              <div className="h-14 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-b">
                No receipt
              </div>
            )}

            {/* Store */}
            <div className="px-5 pt-4 pb-1">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                {toTitleCase(detailEntry.store)}
              </p>
            </div>

            {/* Fields */}
            <div className="px-5 pb-4 pt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Date</p>
                <p className="font-semibold text-gray-800">{detailEntry.date || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Category</p>
                <p className="font-semibold text-gray-800">{detailEntry.category || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Description</p>
                <p className="font-semibold text-gray-800">{detailEntry.description || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Value</p>
                <p className="font-semibold text-green-700 text-base">{formatRupiah(detailEntry.value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Transfer</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${detailEntry.transfer === "TRUE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {detailEntry.transfer === "TRUE" ? "Sudah Transfer" : "Belum Transfer"}
                </span>
              </div>
              {detailEntry.ket && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Dana Talang</p>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm">{detailEntry.ket}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Update By</p>
                <p className="font-semibold text-gray-800">{detailEntry.update_by || "-"}</p>
              </div>
            </div>

            {/* Close */}
            <div className="px-5 pb-4 flex justify-end border-t pt-3">
              <button
                onClick={() => setShowDetailPopup(false)}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {/* Add Balance Modal */}
      {showAddBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">Add Balance Entry</h2>
            <form onSubmit={handleAddBalance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type*</label>
                <select value={balanceFormData.type_balance} onChange={(e) => setBalanceFormData({ ...balanceFormData, type_balance: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required>
                  <option value="credit">Credit (Pemasukan)</option>
                  <option value="debit">Debit (Pengeluaran)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value*</label>
                <input type="text" value={balanceFormData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setBalanceFormData({ ...balanceFormData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={balanceFormData.notes} onChange={(e) => setBalanceFormData({ ...balanceFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => { setShowAddBalanceModal(false); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }} disabled={submittingBalance} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submittingBalance} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">{submittingBalance ? "Submitting..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {showEditBalanceModal && selectedBalanceEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">Edit Balance Entry</h2>
            <form onSubmit={handleUpdateBalance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type*</label>
                <select value={balanceFormData.type_balance} onChange={(e) => setBalanceFormData({ ...balanceFormData, type_balance: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required>
                  <option value="credit">Credit (Pemasukan)</option>
                  <option value="debit">Debit (Pengeluaran)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value*</label>
                <input type="text" value={balanceFormData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setBalanceFormData({ ...balanceFormData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={balanceFormData.notes} onChange={(e) => setBalanceFormData({ ...balanceFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => { setShowEditBalanceModal(false); setSelectedBalanceEntry(null); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }} disabled={submittingBalance} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submittingBalance} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">{submittingBalance ? "Updating..." : "Update Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">Petty Cash Category Information</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryDetails.map((detail, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 border border-gray-300 font-medium">{detail.category}</td>
                      <td className="px-4 py-3 border border-gray-300">{detail.description}</td>
                      <td className="px-4 py-3 border border-gray-300 text-gray-600">{detail.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {categoryDetails.length === 0 && <div className="p-8 text-center text-gray-500">No category information available</div>}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setShowInfoModal(false)} className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">Add Petty Cash Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description*</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category*</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select Category</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value*</label>
                  <input type="text" value={formData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setFormData({ ...formData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <input type="text" value={user.user_name} disabled className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dana Talang</label>
                  <textarea value={formData.ket} onChange={(e) => setFormData({ ...formData, ket: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} />
                </div>
                <div>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.transfer} onChange={(e) => setFormData({ ...formData, transfer: e.target.checked })} className="mr-2" />
                    Transfer
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Receipt</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90" />
                  {formData.file && <p className="text-xs text-gray-500 mt-1">Selected: {formData.file.name}</p>}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }} disabled={submitting} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">{submitting ? "Submitting..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">Edit Petty Cash Entry</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description*</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category*</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select Category</option>
                    {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value*</label>
                  <input type="text" value={formData.value} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ""); setFormData({ ...formData, value: val ? formatRupiah(val) : "" }); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Rp 0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <input type="text" value={selectedEntry.store} disabled className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dana Talang</label>
                  <textarea value={formData.ket} onChange={(e) => setFormData({ ...formData, ket: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" rows={3} />
                </div>
                <div>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input type="checkbox" checked={formData.transfer} onChange={(e) => setFormData({ ...formData, transfer: e.target.checked })} className="mr-2" />
                    Transfer
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Receipt (Optional - will replace existing)</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90" />
                  {formData.file && <p className="text-xs text-gray-500 mt-1">Selected: {formData.file.name}</p>}
                  {selectedEntry.link_url && !formData.file && (
                    <p className="text-xs text-blue-600 mt-1">Current file: <a href={selectedEntry.link_url} target="_blank" rel="noopener noreferrer">View</a></p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedEntry(null); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }} disabled={submitting} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">{submitting ? "Updating..." : "Update Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}