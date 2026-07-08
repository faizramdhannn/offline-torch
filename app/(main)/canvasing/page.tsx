"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { Canvasing } from "@/types";
import * as XLSX from "xlsx";
import {
  MapPin, Plus, RefreshCw, List, BarChart2,
  CheckCircle2, TrendingUp, AlertCircle,
} from "lucide-react";

// ── Canvasing components ────────────────────────────────────────────────────
import { SectionHeader } from "@/components/canvasing/SectionHeader";
import { KpiCards } from "@/components/canvasing/KpiCards";
import { Toolbar } from "@/components/canvasing/Toolbar";
import { CanvasingTable } from "@/components/canvasing/CanvasingTable";
import { Pagination } from "@/components/canvasing/Pagination";
import { DetailPopup } from "@/components/canvasing/DetailPopup";
import { EntryModal, EntryFormData } from "@/components/canvasing/EntryModal";
import { ReportView, buildReportData } from "@/components/canvasing/ReportView";
import { EmptyState } from "@/components/canvasing/EmptyState";
import { TableSkeletonRows } from "@/components/canvasing/LoadingSkeleton";
import { Button } from "@/components/shared/Button";

// ── Utilities ───────────────────────────────────────────────────────────────

function toTitleCase(str: string) {
  return str
    ? str
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "—";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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

function getDriveImageUrls(url: string): string[] {
  const fileId = extractDriveFileId(url);
  return fileId ? [`/api/drive-image?id=${fileId}`] : [url];
}

const EMPTY_FORM: EntryFormData = {
  name: "",
  contact_person: "",
  category: "",
  sub_category: "",
  canvasser: "",
  visit_at: "",
  result_status: "",
  notes: "",
  files: [],
  keepExistingImages: true,
};

const ITEMS_PER_PAGE = 20;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CanvasingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // Data
  const [data, setData] = useState<Canvasing[]>([]);
  const [filteredData, setFilteredData] = useState<Canvasing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [stores, setStores] = useState<string[]>([]);

  // UI state
  const [viewMode, setViewMode] = useState<"list" | "report">("list");
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  // Modal / popup state
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Canvasing | null>(null);
  const [formData, setFormData] = useState<EntryFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Canvasing | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  useSessionGuard();

  // ── Click-outside for store dropdown ──────────────────────────────────────
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        storeDropdownRef.current &&
        !storeDropdownRef.current.contains(e.target as Node)
      )
        setShowStoreDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.canvasing) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, []);

  // ── Re-filter whenever inputs change ────────────────────────────────────────
  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, storeFilter, dateFrom, dateTo, data]);

  // ── Business logic ────────────────────────────────────────────────────────

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

  const fetchData = async (username: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/canvasing?username=${username}`);
      const result = await response.json();
      setIsOwner(result.isOwner);
      setStoreName(result.storeName || "");
      const sorted = [...(result.data || [])].sort((a: Canvasing, b: Canvasing) => {
        const dateA = new Date((a as any).created_at || 0).getTime();
        const dateB = new Date((b as any).created_at || 0).getTime();
        return dateB - dateA;
      });
      setData(sorted);
      setFilteredData(sorted);
      if (result.isOwner) {
        setStoreFilter([result.storeName]);
      } else {
        const uniqueStores = [
          ...new Set(sorted.map((item: Canvasing) => item.store)),
        ].filter(Boolean);
        setStores(uniqueStores as string[]);
      }
    } catch {
      showMessage("Failed to fetch canvasing data", "error");
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const applyFilters = () => {
    let filtered = [...data];
    if (statusFilter.length > 0)
      filtered = filtered.filter((item) =>
        statusFilter.includes(item.result_status)
      );
    if (storeFilter.length > 0)
      filtered = filtered.filter((item) => storeFilter.includes(item.store));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.store?.toLowerCase().includes(q) ||
          item.canvasser?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q) ||
          item.sub_category?.toLowerCase().includes(q) ||
          item.contact_person?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((item) => {
        const d = parseDate(item.visit_at);
        return d ? d >= from : false;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => {
        const d = parseDate(item.visit_at);
        return d ? d <= to : false;
      });
    }
    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter([]);
    setDateFrom("");
    setDateTo("");
    if (!isOwner) setStoreFilter([]);
    setFilteredData(data);
    setCurrentPage(1);
  };

  const handleRowClick = (entry: Canvasing) => {
    setSelectedEntry(entry);
    setShowDetailPopup(true);
  };

  const handleOpenModal = (entry?: Canvasing) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        name: entry.name || "",
        contact_person: entry.contact_person || "",
        category: entry.category || "",
        sub_category: entry.sub_category || "",
        canvasser: entry.canvasser || "",
        visit_at: entry.visit_at || "",
        result_status: entry.result_status || "",
        notes: entry.notes || "",
        files: [],
        keepExistingImages: true,
      });
    } else {
      setEditingEntry(null);
      setFormData(EMPTY_FORM);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      if (editingEntry) {
        form.append("id", editingEntry.id);
        form.append(
          "keepExistingImages",
          formData.keepExistingImages.toString()
        );
      } else {
        form.append("store", isOwner ? storeName : user.user_name);
      }
      form.append("name", formData.name);
      form.append("contact_person", formData.contact_person);
      form.append("category", formData.category);
      form.append("sub_category", formData.sub_category);
      form.append("canvasser", formData.canvasser);
      form.append("visit_at", formData.visit_at);
      form.append("result_status", formData.result_status);
      form.append("notes", formData.notes);
      form.append("username", user.user_name);
      formData.files.forEach((file, index) =>
        form.append(`file_${index}`, file)
      );
      const method = editingEntry ? "PUT" : "POST";
      const response = await fetch("/api/canvasing", { method, body: form });
      if (response.ok) {
        const action = editingEntry ? "Updated" : "Created";
        await logActivity(
          method,
          `${action} canvasing entry: ${formData.name}`
        );
        showMessage(
          editingEntry ? "Entry updated successfully" : "Entry created successfully",
          "success"
        );
        handleCloseModal();
        fetchData(user.user_name);
      } else {
        showMessage("Failed to save entry", "error");
      }
    } catch {
      showMessage("Failed to save entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const response = await fetch(`/api/canvasing?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await logActivity("DELETE", `Deleted canvasing entry ID: ${id}`);
        showMessage("Entry deleted successfully", "success");
        fetchData(user.user_name);
      } else {
        showMessage("Failed to delete entry", "error");
      }
    } catch {
      showMessage("Failed to delete entry", "error");
    }
  };

  const canEdit = (entry: Canvasing) => {
    if (isOwner)
      return entry.store.toLowerCase() === storeName.toLowerCase();
    return true;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(user.user_name);
    setRefreshing(false);
  };

  const exportToDoc = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/canvasing/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filteredData,
          storeName: isOwner ? storeName : "All_Stores",
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Canvasing_${isOwner ? storeName : "All"}_${todayISO()}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        await logActivity(
          "GET",
          `Exported canvasing to DOC: ${filteredData.length} entries`
        );
        showMessage("Document exported successfully", "success");
      } else {
        showMessage("Failed to export document", "error");
      }
    } catch {
      showMessage("Failed to export document", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportReportToExcel = () => {
    const reportData = buildReportData(filteredData, toTitleCase);
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Canvasing Report");
    XLSX.writeFile(wb, `canvasing_report_${todayISO()}.xlsx`);
    logActivity("GET", "Exported canvasing report to Excel");
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const activeFilterCount = [
    statusFilter.length > 0,
    !isOwner && storeFilter.length > 0,
    !!dateFrom,
    !!dateTo,
    !!searchQuery,
  ].filter(Boolean).length;

  const kpiCards = [
    {
      label: "Total Visits",
      value: filteredData.length,
      icon: MapPin,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Deal",
      value: filteredData.filter((d) => d.result_status === "Deal").length,
      icon: CheckCircle2,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Interested",
      value: filteredData.filter((d) => d.result_status === "Interested").length,
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Reject / Cancel",
      value: filteredData.filter(
        (d) => d.result_status === "Reject" || d.result_status === "Cancel"
      ).length,
      icon: AlertCircle,
      color: "bg-red-50 text-red-500",
    },
  ];

  const indexOfFirst = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredData.slice(
    indexOfFirst,
    indexOfFirst + ITEMS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  if (!user) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50">
      <div className="mx-auto max-w-7xl space-y-6 p-4">

        {/* Header */}
        <SectionHeader
          icon={MapPin}
          title={
            isOwner
              ? `${toTitleCase(storeName)} — Canvasing`
              : "Canvasing Management"
          }
          description={`${filteredData.length} entri${
            activeFilterCount > 0 ? ` · ${activeFilterCount} filter aktif` : ""
          }`}
          actions={
            <>
              {/* View toggle */}
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <List className="h-3.5 w-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode("report")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "report"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" /> Report
                </button>
              </div>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                icon={Plus}
                onClick={() => handleOpenModal()}
              >
                Add Entry
              </Button>
            </>
          }
        />

        {/* KPI Cards */}
        <KpiCards cards={kpiCards} />

        {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
        {viewMode === "list" && (
          <>
            <Toolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              isOwner={isOwner}
              storeName={storeName}
              stores={stores}
              storeFilter={storeFilter}
              onToggleStore={(store) =>
                setStoreFilter((prev) =>
                  prev.includes(store)
                    ? prev.filter((s) => s !== store)
                    : [...prev, store]
                )
              }
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              activeFilterCount={activeFilterCount}
              onReset={resetFilters}
              canExportDoc={!!user.canvasing_export}
              exporting={exporting}
              onExportDoc={exportToDoc}
              showStoreDropdown={showStoreDropdown}
              onToggleStoreDropdown={() =>
                setShowStoreDropdown((prev) => !prev)
              }
              onCloseStoreDropdown={() => setShowStoreDropdown(false)}
              toTitleCase={toTitleCase}
            />

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <TableSkeletonRows count={8} />
              ) : filteredData.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="Tidak ada data"
                  description="Coba ubah filter atau tambah entri baru"
                  action={
                    <Button
                      icon={Plus}
                      onClick={() => handleOpenModal()}
                    >
                      Add Entry
                    </Button>
                  }
                />
              ) : (
                <>
                  <CanvasingTable
                    items={currentItems}
                    onRowClick={handleRowClick}
                    onEdit={handleOpenModal}
                    onDelete={handleDelete}
                    canEdit={canEdit}
                    isOwner={isOwner}
                    toTitleCase={toTitleCase}
                  />
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    rangeLabel={`${indexOfFirst + 1}–${Math.min(
                      indexOfFirst + ITEMS_PER_PAGE,
                      filteredData.length
                    )} dari ${filteredData.length} entri`}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* ── REPORT VIEW ────────────────────────────────────────────────────── */}
        {viewMode === "report" && (
          <ReportView
            filteredData={filteredData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onExportXlsx={exportReportToExcel}
            toTitleCase={toTitleCase}
          />
        )}
      </div>

      {/* ── Detail Popup ──────────────────────────────────────────────────── */}
      {showDetailPopup && selectedEntry && (
        <DetailPopup
          entry={selectedEntry}
          onClose={() => setShowDetailPopup(false)}
          onEdit={handleOpenModal}
          canEdit={canEdit(selectedEntry)}
          getDriveImageUrls={getDriveImageUrls}
          toTitleCase={toTitleCase}
        />
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <EntryModal
        open={showModal}
        isEditing={!!editingEntry}
        hasExistingImages={!!(editingEntry?.image_url)}
        formData={formData}
        submitting={submitting}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onChange={setFormData}
      />

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <Popup
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}