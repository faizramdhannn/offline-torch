"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import {
  Wallet,
  Plus,
  Info,
  TrendingUp,
  TrendingDown,
  Landmark,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeletonRows } from "@/components/shared/LoadingSkeleton";
import { Pagination } from "@/components/shared/Pagination";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";

import { ViewTabs, type ViewMode } from "@/components/petty-cash/ViewTabs";
import { StatCard } from "@/components/petty-cash/StatCard";
import { FilterBar } from "@/components/petty-cash/FilterBar";
import { EntryTable } from "@/components/petty-cash/EntryTable";
import { ReportTable } from "@/components/petty-cash/ReportTable";
import { BalanceTable } from "@/components/petty-cash/BalanceTable";
import { HistoryTable } from "@/components/petty-cash/HistoryTable";
import { DetailPopup } from "@/components/petty-cash/DetailPopup";
import { SnapshotModal } from "@/components/petty-cash/SnapshotModal";
import { EntryFormModal, type PettyCashFormData } from "@/components/petty-cash/EntryFormModal";
import { BalanceFormModal, type BalanceFormData } from "@/components/petty-cash/BalanceFormModal";
import { InfoModal } from "@/components/petty-cash/InfoModal";

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

interface HistoryEntry {
  history_id: string;
  petty_cash_id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
  action_by: string;
  action_at: string;
  snapshot: string; // JSON string
  notes: string;
}

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

  // View mode — added "history"
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Balance state
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [balanceDateFrom, setBalanceDateFrom] = useState("");
  const [balanceDateTo, setBalanceDateTo] = useState("");
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Balance form state
  const [balanceFormData, setBalanceFormData] = useState<BalanceFormData>({ type_balance: "credit", value: "", notes: "" });
  const [submittingBalance, setSubmittingBalance] = useState(false);

  // ─── History state ───────────────────────────────────────────────────────────
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyActionFilter, setHistoryActionFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotEntry, setSnapshotEntry] = useState<HistoryEntry | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 25;
  // ────────────────────────────────────────────────────────────────────────────

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

  const [formData, setFormData] = useState<PettyCashFormData>({
    description: "",
    category: "",
    value: "",
    ket: "",
    transfer: false,
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);

  // ── UI-only addition: modern confirm dialogs replacing window.confirm() ──
  // Same delete/restore logic below — only the confirmation trigger changed.
  const [deleteTarget, setDeleteTarget] = useState<PettyCash | null>(null);
  const [deleteBalanceTarget, setDeleteBalanceTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) setShowCategoryDropdown(false);
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) setShowStoreDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.petty_cash) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser.user_name, parsedUser.petty_cash_export);
    fetchCategories();
    fetchCategoryDetails();
  }, []);

  useEffect(() => { applyFilters(); }, [dateFrom, dateTo, selectedCategories, selectedStores, transferFilter, data]);

  useEffect(() => {
    if (viewMode === "balance" && user && user.petty_cash_balance) fetchBalance();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "balance" && user && user.petty_cash_balance) fetchBalance();
  }, [balanceDateFrom, balanceDateTo]);

  useEffect(() => {
    if (viewMode === "history" && user) fetchHistory();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "history" && user) fetchHistory();
  }, [historyDateFrom, historyDateTo, historyActionFilter]);

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
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
      });
    } catch (error) { console.error("Failed to log activity:", error); }
  };

  const fetchData = async (username: string, isAdmin: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/petty-cash?username=${username}&isAdmin=${isAdmin}`);
      const result = await response.json();
      setData(result);
      setFilteredData(result);
      const uniqueStores = [...new Set(result.map((item: PettyCash) => item.store))].filter(Boolean);
      setStores(uniqueStores as string[]);
    } catch (error) { showMessage("Failed to fetch data", "error"); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      const result = await response.json();
      setCategories(result);
    } catch (error) { showMessage("Failed to fetch categories", "error"); }
  };

  const fetchCategoryDetails = async () => {
    try {
      const response = await fetch("/api/categories?withDetails=true");
      const result = await response.json();
      setCategoryDetails(result);
    } catch (error) { console.error("Failed to fetch category details:", error); }
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
    } catch (error) { showMessage("Failed to fetch balance data", "error"); }
    finally { setLoadingBalance(false); }
  };

  // ─── History fetch ────────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const params = new URLSearchParams();
      if (historyDateFrom) params.set("dateFrom", historyDateFrom);
      if (historyDateTo) params.set("dateTo", historyDateTo);
      if (historyActionFilter !== "all") params.set("action", historyActionFilter);
      const response = await fetch(`/api/petty-cash/history?${params}`);
      if (!response.ok) throw new Error("Failed to fetch history");
      const result = await response.json();
      setHistoryData(result);
      setHistoryPage(1);
    } catch (error) { showMessage("Failed to fetch history", "error"); }
    finally { setLoadingHistory(false); }
  };

  // Restore flow — same fetch/logic, now triggered via confirm dialog (restoreTarget)
  // instead of window.confirm().
  const requestRestore = (entry: HistoryEntry) => {
    if (!user.petty_cash_export) { showMessage("You don't have permission to restore entries", "error"); return; }
    setRestoreTarget(entry);
  };

  const handleRestore = async () => {
    const entry = restoreTarget;
    if (!entry) return;
    setRestoringId(entry.history_id);
    try {
      const response = await fetch("/api/petty-cash/history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history_id: entry.history_id, restore_by: user.user_name }),
      });
      if (response.ok) {
        await logActivity("PUT", `Restored petty cash entry ${entry.petty_cash_id} from history ${entry.history_id}`);
        showMessage("Entry restored successfully", "success");
        fetchHistory();
        fetchData(user.user_name, user.petty_cash_export);
      } else {
        const err = await response.json();
        showMessage(err.error || "Failed to restore entry", "error");
      }
    } catch (error) { showMessage("Failed to restore entry", "error"); }
    finally { setRestoringId(null); setRestoreTarget(null); }
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBalance(true);
    try {
      const response = await fetch("/api/petty-cash/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_balance: balanceFormData.type_balance, value: balanceFormData.value.replace(/[^0-9]/g, ""), notes: balanceFormData.notes, update_by: user.user_name }),
      });
      if (response.ok) {
        await logActivity("POST", `Added balance entry: ${balanceFormData.type_balance} - ${balanceFormData.value}`);
        showMessage("Balance entry added successfully", "success");
        setShowAddBalanceModal(false);
        setBalanceFormData({ type_balance: "credit", value: "", notes: "" });
        fetchBalance();
      } else { showMessage("Failed to add balance entry", "error"); }
    } catch (error) { showMessage("Failed to add balance entry", "error"); }
    finally { setSubmittingBalance(false); }
  };

  const handleEditBalance = (entry: BalanceEntry) => {
    setSelectedBalanceEntry(entry);
    setBalanceFormData({ type_balance: entry.type_balance, value: formatRupiah(entry.value), notes: entry.notes || "" });
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
        body: JSON.stringify({ id: selectedBalanceEntry.id, type_balance: balanceFormData.type_balance, value: balanceFormData.value.replace(/[^0-9]/g, ""), notes: balanceFormData.notes, update_by: user.user_name }),
      });
      if (response.ok) {
        await logActivity("PUT", `Updated balance entry ID: ${selectedBalanceEntry.id}`);
        showMessage("Balance entry updated successfully", "success");
        setShowEditBalanceModal(false);
        setSelectedBalanceEntry(null);
        setBalanceFormData({ type_balance: "credit", value: "", notes: "" });
        fetchBalance();
      } else { showMessage("Failed to update balance entry", "error"); }
    } catch (error) { showMessage("Failed to update balance entry", "error"); }
    finally { setSubmittingBalance(false); }
  };

  // Delete balance — same fetch/logic, routed through confirm dialog.
  const requestDeleteBalance = (id: string) => setDeleteBalanceTarget(id);

  const handleDeleteBalance = async () => {
    const id = deleteBalanceTarget;
    if (!id) return;
    try {
      const response = await fetch(`/api/petty-cash/balance?id=${id}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted balance entry ID: ${id}`);
        showMessage("Balance entry deleted successfully", "success");
        fetchBalance();
      } else { showMessage("Failed to delete balance entry", "error"); }
    } catch (error) { showMessage("Failed to delete balance entry", "error"); }
    finally { setDeleteBalanceTarget(null); }
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
      } else { showMessage("Failed to update transfer status", "error"); }
    } catch (error) { showMessage("Failed to update transfer status", "error"); }
    finally { setUpdatingTransfer(null); }
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return new Date(0);
    const months: { [key: string]: number } = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const parts = dateString.split(" ");
    if (parts.length === 3) return new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
    return new Date(dateString);
  };

  const parseDateInput = (dateInput: string, endOfDay = false) => {
    const [y, m, d] = dateInput.split("-").map(Number);
    if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (dateFrom) { const fromDate = parseDateInput(dateFrom); filtered = filtered.filter((item) => parseDate(item.date) >= fromDate); }
    if (dateTo) { const toDate = parseDateInput(dateTo, true); filtered = filtered.filter((item) => parseDate(item.date) <= toDate); }
    if (selectedCategories.length > 0) filtered = filtered.filter((item) => selectedCategories.includes(item.category));
    if (selectedStores.length > 0) filtered = filtered.filter((item) => selectedStores.includes(item.store));
    if (transferFilter === "true") filtered = filtered.filter((item) => item.transfer === "TRUE");
    else if (transferFilter === "false") filtered = filtered.filter((item) => item.transfer === "FALSE");
    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setDateFrom(""); setDateTo(""); setSelectedCategories([]); setSelectedStores([]);
    setTransferFilter("all"); setReportTransferFilter("false"); setFilteredData(data); setCurrentPage(1);
  };

  const toggleCategory = (category: string) => setSelectedCategories((prev) => prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]);
  const toggleStore = (store: string) => setSelectedStores((prev) => prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store]);
  const toTitleCase = (str: string) => (str || "").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  const formatRupiah = (value: string | number) => {
    const number = typeof value === "string" ? parseInt((value || "0").replace(/[^0-9]/g, "") || "0") : value || 0;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
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
      } else { showMessage("Failed to add entry", "error"); }
    } catch (error) { showMessage("Failed to add entry", "error"); }
    finally { setSubmitting(false); }
  };

  const handleEdit = (entry: PettyCash) => {
    setSelectedEntry(entry);
    setFormData({ description: entry.description || "", category: entry.category || "", value: formatRupiah(entry.value), ket: entry.ket || "", transfer: entry.transfer === "TRUE", file: null });
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
      } else { showMessage("Failed to update entry", "error"); }
    } catch (error) { showMessage("Failed to update entry", "error"); }
    finally { setSubmitting(false); }
  };

  // Delete entry — same fetch/logic, routed through confirm dialog instead of window.confirm().
  const requestDelete = (id: string) => {
    const item = data.find((d) => d.id === id) || null;
    setDeleteTarget(item);
  };

  const handleDelete = async () => {
    const item = deleteTarget;
    if (!item) return;
    try {
      const response = await fetch(`/api/petty-cash?id=${item.id}&deletedBy=${user.user_name}`, { method: "DELETE" });
      if (response.ok) {
        await logActivity("DELETE", `Deleted petty cash entry ID: ${item.id}`);
        showMessage("Entry deleted successfully", "success");
        fetchData(user.user_name, user.petty_cash_export);
      } else { showMessage("Failed to delete entry", "error"); }
    } catch (error) { showMessage("Failed to delete entry", "error"); }
    finally { setDeleteTarget(null); }
  };

  const canEditDelete = (entry: PettyCash) => user.petty_cash_export || entry.update_by === user.user_name;

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      Date: item.date, Description: toTitleCase(item.description), Category: item.category,
      Value: parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0"),
      Store: item.store, Ket: item.ket, Transfer: item.transfer === "TRUE" ? "Yes" : "No", Link: item.link_url || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash");
    XLSX.writeFile(wb, "petty_cash.xlsx");
    logActivity("GET", `Exported petty cash to Excel: ${filteredData.length} entries`);
  };

  const exportReportToExcel = () => {
    const reportData = generateReportData();
    const exportData = reportData.map((item) => ({ Store: item.store, "Petty Cash": item.pettyCash, Listrik: item.listrik, Total: item.total }));
    const grandTotal = { Store: "Grand Total", "Petty Cash": reportData.reduce((sum, item) => sum + item.pettyCash, 0), Listrik: reportData.reduce((sum, item) => sum + item.listrik, 0), Total: reportData.reduce((sum, item) => sum + item.total, 0) };
    exportData.push(grandTotal);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash Report");
    const transferStatus = reportTransferFilter === "false" ? "Belum_Transfer" : "Sudah_Transfer";
    XLSX.writeFile(wb, `petty_cash_report_${transferStatus}_${new Date().toISOString().split("T")[0]}.xlsx`);
    logActivity("GET", `Exported petty cash report to Excel: ${reportData.length} stores`);
  };

  const exportToDoc = async (type: 1 | 2) => {
    if (type === 1) setExporting(true); else setExporting2(true);
    try {
      const response = await fetch("/api/petty-cash/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: filteredData, username: user.name, dateFrom, dateTo, exportType: type }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const suffix = type === 2 ? "_Summary" : "";
        a.download = `Petty_Cash${suffix}_${user.user_name}_${new Date().toISOString().split("T")[0]}.docx`;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url); document.body.removeChild(a);
        await logActivity("GET", `Exported petty cash DOC type ${type}: ${filteredData.length} entries`);
        showMessage("Document exported successfully", "success");
      } else { showMessage("Failed to export document", "error"); }
    } catch (error) { showMessage("Failed to export document", "error"); }
    finally { if (type === 1) setExporting(false); else setExporting2(false); }
  };

  const generateReportData = (): ReportData[] => {
    let reportFilteredData = filteredData;
    if (reportTransferFilter === "false") reportFilteredData = filteredData.filter((item) => item.transfer === "FALSE");
    else if (reportTransferFilter === "true") reportFilteredData = filteredData.filter((item) => item.transfer === "TRUE");
    const uniqueStores = [...new Set(reportFilteredData.map((item) => item.store))];
    return uniqueStores.map((store) => {
      const storeData = reportFilteredData.filter((item) => item.store === store);
      const pettyCashData = storeData.filter((item) => { const desc = (item.description || "").toLowerCase(); return !desc.includes("listrik") && !desc.includes("token"); });
      const pettyCashTotal = pettyCashData.reduce((sum, item) => sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0"), 0);
      const listrikData = storeData.filter((item) => { const desc = (item.description || "").toLowerCase(); return desc.includes("listrik") || desc.includes("token"); });
      const listrikTotal = listrikData.reduce((sum, item) => sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0"), 0);
      return { store: toTitleCase(store), pettyCash: pettyCashTotal, listrik: listrikTotal, total: pettyCashTotal + listrikTotal };
    }).sort((a, b) => a.store.localeCompare(b.store));
  };

  const calculateCreditDebit = () => {
    if (!balanceData) return { credit: 0, debit: 0 };
    const credit = balanceData.entries.filter((e) => (e.type_balance || "").toLowerCase() === "credit").reduce((sum, e) => sum + (parseInt((e.value || "0").replace(/[^0-9]/g, "")) || 0), 0);
    const debit = balanceData.entries.filter((e) => (e.type_balance || "").toLowerCase() === "debit").reduce((sum, e) => sum + (parseInt((e.value || "0").replace(/[^0-9]/g, "")) || 0), 0);
    return { credit, debit };
  };

  // ─── History filtered + paginated ────────────────────────────────────────────
  const filteredHistory = historyData.filter((item) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      item.petty_cash_id.toLowerCase().includes(q) ||
      item.action_by.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q)
    );
  });
  const totalHistoryPages = Math.ceil(filteredHistory.length / historyItemsPerPage);
  const historyItems = filteredHistory.slice((historyPage - 1) * historyItemsPerPage, historyPage * historyItemsPerPage);
  // ────────────────────────────────────────────────────────────────────────────

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const totalValue = filteredData.reduce((sum, item) => sum + parseInt((item.value || "0").replace(/[^0-9]/g, "") || "0"), 0);

  if (!user) return null;

  const { credit, debit } = calculateCreditDebit();

  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-[1400px] p-4">
        {/* ── Section header ──────────────────────────────────────────── */}
        <SectionHeader
          icon={Wallet}
          title="Petty Cash"
          actions={
            <>
              <Button variant="outline" size="icon" onClick={() => setShowInfoModal(true)} title="Category Information">
                <Info className="h-4 w-4" />
              </Button>
              {user.petty_cash_add && (
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                  Add Petty Cash
                </Button>
              )}
            </>
          }
        />

        {/* ── View tabs ────────────────────────────────────────────────── */}
        <div className="mt-5">
          <ViewTabs
            active={viewMode}
            onChange={setViewMode}
            showBalance={!!user.petty_cash_balance}
            showHistory={!!user.petty_cash_export}
          />
        </div>

        <div className="mt-4 space-y-4">
          {/* ── HISTORY VIEW ── */}
          {viewMode === "history" && (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Date From</label>
                    <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Date To</label>
                    <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Action</label>
                    <select value={historyActionFilter} onChange={(e) => setHistoryActionFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10">
                      <option value="all">All Actions</option>
                      <option value="CREATE">Create</option>
                      <option value="UPDATE">Update</option>
                      <option value="DELETE">Delete</option>
                      <option value="RESTORE">Restore</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Search</label>
                    <input type="text" placeholder="ID, user, notes..." value={historySearch}
                      onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <Button variant="outline" size="sm" onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); setHistoryActionFilter("all"); setHistorySearch(""); fetchHistory(); }}>
                    Reset
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchHistory}>
                    Refresh
                  </Button>
                  <span className="ml-auto text-[11px] text-gray-400">
                    {filteredHistory.length} record{filteredHistory.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["CREATE", "UPDATE", "DELETE", "RESTORE"] as const).map((action) => {
                  const count = historyData.filter((h) => h.action === action).length;
                  const icon = action === "CREATE" ? CheckCircle2 : action === "DELETE" ? Circle : TrendingUp;
                  const tone = action === "CREATE" ? "positive" : action === "DELETE" ? "negative" : action === "RESTORE" ? "info" : "default";
                  return <StatCard key={action} icon={icon} label={action} value={String(count)} tone={tone as any} />;
                })}
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {loadingHistory ? (
                  <TableSkeletonRows />
                ) : historyItems.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="Tidak ada riwayat" description="Belum ada aktivitas yang tercatat untuk filter ini." />
                ) : (
                  <>
                    <HistoryTable
                      items={historyItems}
                      canRestore={!!user.petty_cash_export}
                      restoringId={restoringId}
                      onViewSnapshot={(entry) => { setSnapshotEntry(entry); setShowSnapshotModal(true); }}
                      onRestore={requestRestore}
                      formatDateTime={formatDateTime}
                      toTitleCase={toTitleCase}
                    />
                    <Pagination
                      currentPage={historyPage}
                      totalPages={totalHistoryPages}
                      onPageChange={setHistoryPage}
                      rangeLabel={`${(historyPage - 1) * historyItemsPerPage + 1}–${Math.min(historyPage * historyItemsPerPage, filteredHistory.length)} dari ${filteredHistory.length} record`}
                    />
                  </>
                )}
              </motion.div>
            </>
          )}

          {/* ── BALANCE VIEW ── */}
          {viewMode === "balance" && user.petty_cash_balance && (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Date From</label>
                    <input type="date" value={balanceDateFrom} onChange={(e) => setBalanceDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Date To</label>
                    <input type="date" value={balanceDateTo} onChange={(e) => setBalanceDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="sm" onClick={() => { setBalanceDateFrom(""); setBalanceDateTo(""); }}>
                      Reset
                    </Button>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button icon={Plus} size="sm" onClick={() => setShowAddBalanceModal(true)}>
                      Add Balance
                    </Button>
                  </div>
                </div>
              </div>

              {loadingBalance ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <TableSkeletonRows count={4} />
                </div>
              ) : balanceData ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard
                      icon={Landmark}
                      label="Balance"
                      value={formatRupiah(Math.abs(balanceData.balance))}
                      sublabel={balanceData.balance >= 0 ? "Surplus" : "Deficit"}
                      tone={balanceData.balance >= 0 ? "positive" : "negative"}
                    />
                    <StatCard icon={TrendingUp} label="Credit" value={formatRupiah(credit)} sublabel="Total pemasukan" tone="positive" />
                    <StatCard icon={TrendingDown} label="Debit" value={formatRupiah(debit)} sublabel="Total pengeluaran" tone="negative" />
                    <StatCard icon={CheckCircle2} label="Paid" value={formatRupiah(balanceData.paid)} sublabel="Sudah ditransfer" tone="info" />
                    <StatCard icon={Circle} label="Unpaid" value={formatRupiah(balanceData.unpaid)} sublabel="Belum ditransfer" tone="warning" />
                  </div>

                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-4 py-3">
                      <h3 className="text-xs font-semibold text-gray-700">Balance History</h3>
                    </div>
                    {balanceData.entries.length === 0 ? (
                      <EmptyState icon={Landmark} title="Belum ada riwayat balance" description="Tambahkan entry credit atau debit pertama." />
                    ) : (
                      <BalanceTable
                        entries={balanceData.entries}
                        onEdit={handleEditBalance}
                        onDelete={requestDeleteBalance}
                        formatRupiah={formatRupiah}
                        toTitleCase={toTitleCase}
                      />
                    )}
                  </motion.div>
                </>
              ) : (
                <EmptyState icon={Landmark} title="Tidak ada data" />
              )}
            </>
          )}

          {viewMode === "balance" && !user.petty_cash_balance && (
            <EmptyState icon={Wallet} title="Akses ditolak" description="Anda tidak memiliki izin untuk mengakses Balance." />
          )}

          {/* ── LIST / REPORT VIEW ── */}
          {(viewMode === "list" || viewMode === "report") && (
            <>
              <FilterBar
                viewMode={viewMode}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                categories={categories}
                selectedCategories={selectedCategories}
                onToggleCategory={toggleCategory}
                onSelectAllCategories={() => setSelectedCategories((p) => p.length === categories.length ? [] : [...categories])}
                showCategoryDropdown={showCategoryDropdown}
                onCategoryDropdownChange={setShowCategoryDropdown}
                categoryDropdownRef={categoryDropdownRef}
                stores={stores}
                selectedStores={selectedStores}
                onToggleStore={toggleStore}
                onSelectAllStores={() => setSelectedStores((p) => p.length === stores.length ? [] : [...stores])}
                showStoreDropdown={showStoreDropdown}
                onStoreDropdownChange={setShowStoreDropdown}
                storeDropdownRef={storeDropdownRef}
                transferFilter={transferFilter}
                onTransferFilterChange={setTransferFilter}
                reportTransferFilter={reportTransferFilter}
                onReportTransferFilterChange={setReportTransferFilter}
                onReset={resetFilters}
                canExport={!!user.petty_cash_export}
                onExportExcel={viewMode === "list" ? exportToExcel : exportReportToExcel}
                onExportDoc={viewMode === "list" ? () => exportToDoc(1) : undefined}
                exportingDoc={exporting}
                onExportDoc2={viewMode === "list" ? () => exportToDoc(2) : undefined}
                exportingDoc2={exporting2}
              />

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {loading ? (
                  <TableSkeletonRows />
                ) : viewMode === "report" ? (
                  generateReportData().length === 0 ? (
                    <EmptyState icon={TrendingUp} title="Tidak ada data" description="Tidak ada transaksi yang cocok dengan filter ini." />
                  ) : (
                    <ReportTable data={generateReportData()} formatRupiah={formatRupiah} />
                  )
                ) : filteredData.length === 0 ? (
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada petty cash"
                    description="Mulai dengan menambahkan entry petty cash pertama."
                    action={user.petty_cash_add ? <Button icon={Plus} size="sm" onClick={() => setShowAddModal(true)}>Add Petty Cash</Button> : undefined}
                  />
                ) : (
                  <>
                    <EntryTable
                      items={currentItems}
                      canExport={!!user.petty_cash_export}
                      updatingTransfer={updatingTransfer}
                      onRowClick={(item) => { setDetailEntry(item); setShowDetailPopup(true); }}
                      onToggleTransfer={handleQuickToggleTransfer}
                      onEdit={handleEdit}
                      onDelete={requestDelete}
                      canEditDelete={canEditDelete}
                      formatRupiah={formatRupiah}
                      totalValue={totalValue}
                    />
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      rangeLabel={`${indexOfFirstItem + 1}–${Math.min(indexOfLastItem, filteredData.length)} dari ${filteredData.length} entri`}
                    />
                  </>
                )}
              </motion.div>
            </>
          )}
        </div>

        {/* ── Snapshot Detail Modal ── */}
        {showSnapshotModal && snapshotEntry && (
          <SnapshotModal
            entry={snapshotEntry}
            onClose={() => setShowSnapshotModal(false)}
            canRestore={!!user.petty_cash_export}
            restoring={restoringId === snapshotEntry.history_id}
            onRestore={() => { setShowSnapshotModal(false); requestRestore(snapshotEntry); }}
            formatRupiah={formatRupiah}
            formatDateTime={formatDateTime}
          />
        )}

        {/* ── Detail Popup ── */}
        {showDetailPopup && detailEntry && (
          <DetailPopup
            entry={detailEntry}
            onClose={() => setShowDetailPopup(false)}
            formatRupiah={formatRupiah}
            toTitleCase={toTitleCase}
          />
        )}

        {/* Add Balance Modal */}
        <BalanceFormModal
          mode="add"
          open={showAddBalanceModal}
          onClose={() => { setShowAddBalanceModal(false); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }}
          formData={balanceFormData}
          onChange={setBalanceFormData}
          submitting={submittingBalance}
          onSubmit={handleAddBalance}
          formatRupiah={formatRupiah}
        />

        {/* Edit Balance Modal */}
        {selectedBalanceEntry && (
          <BalanceFormModal
            mode="edit"
            open={showEditBalanceModal}
            onClose={() => { setShowEditBalanceModal(false); setSelectedBalanceEntry(null); setBalanceFormData({ type_balance: "credit", value: "", notes: "" }); }}
            formData={balanceFormData}
            onChange={setBalanceFormData}
            submitting={submittingBalance}
            onSubmit={handleUpdateBalance}
            formatRupiah={formatRupiah}
          />
        )}

        {/* Category Info Modal */}
        <InfoModal open={showInfoModal} onClose={() => setShowInfoModal(false)} categoryDetails={categoryDetails} />

        {/* Add Modal */}
        <EntryFormModal
          mode="add"
          open={showAddModal}
          onClose={() => { setShowAddModal(false); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }}
          formData={formData}
          onChange={setFormData}
          categories={categories}
          storeLabel={user.user_name}
          submitting={submitting}
          onSubmit={handleSubmit}
        />

        {/* Edit Modal */}
        {selectedEntry && (
          <EntryFormModal
            mode="edit"
            open={showEditModal}
            onClose={() => { setShowEditModal(false); setSelectedEntry(null); setFormData({ description: "", category: "", value: "", ket: "", transfer: false, file: null }); }}
            formData={formData}
            onChange={setFormData}
            categories={categories}
            storeLabel={selectedEntry.store}
            existingLinkUrl={selectedEntry.link_url}
            submitting={submitting}
            onSubmit={handleUpdate}
          />
        )}

        {/* Delete entry confirmation */}
        <ConfirmationDialog
          open={!!deleteTarget}
          title="Hapus entry ini?"
          description={deleteTarget ? `Entry "${deleteTarget.description}" senilai ${formatRupiah(deleteTarget.value)} akan dihapus.` : undefined}
          confirmLabel="Hapus"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Delete balance confirmation */}
        <ConfirmationDialog
          open={!!deleteBalanceTarget}
          title="Hapus balance entry ini?"
          description="Entry balance ini akan dihapus permanen."
          confirmLabel="Hapus"
          onConfirm={handleDeleteBalance}
          onCancel={() => setDeleteBalanceTarget(null)}
        />

        {/* Restore confirmation */}
        <ConfirmationDialog
          open={!!restoreTarget}
          title="Restore entry ini?"
          description={restoreTarget ? `Entry "${restoreTarget.petty_cash_id}" akan dikembalikan dari snapshot ${restoreTarget.action} pada ${formatDateTime(restoreTarget.action_at)}.` : undefined}
          confirmLabel="Restore"
          danger={false}
          loading={!!restoreTarget && restoringId === restoreTarget.history_id}
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
        />

        <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
      </div>
    </div>
  );
}
