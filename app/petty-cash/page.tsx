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

interface ReportData {
  store: string;
  pettyCash: number;
  listrik: number;
  total: number;
}

export default function PettyCashPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<PettyCash[]>([]);
  const [filteredData, setFilteredData] = useState<PettyCash[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PettyCash | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "report">("list");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [transferFilter, setTransferFilter] = useState<string>("all"); // NEW: Filter for list view
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
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dateFrom, dateTo, selectedCategories, selectedStores, transferFilter, data]); // UPDATED: Added transferFilter

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
        `/api/petty-cash?username=${username}&isAdmin=${isAdmin}`,
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

  const parseDate = (dateString: string) => {
    const months: { [key: string]: number } = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
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
      filtered = filtered.filter((item) =>
        selectedCategories.includes(item.category),
      );
    }

    if (selectedStores.length > 0) {
      filtered = filtered.filter((item) => selectedStores.includes(item.store));
    }

    // NEW: Transfer filter for list view
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
    setTransferFilter("all"); // NEW: Reset transfer filter
    setReportTransferFilter("false");
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const toggleStore = (store: string) => {
    setSelectedStores((prev) =>
      prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store],
    );
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

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

      if (formData.file) {
        form.append("file", formData.file);
      }

      const response = await fetch("/api/petty-cash", {
        method: "POST",
        body: form,
      });

      if (response.ok) {
        await logActivity(
          "POST",
          `Added petty cash: ${formData.category}`,
        );
        showMessage("Entry added successfully", "success");
        setShowAddModal(false);
        setFormData({
          description: "",
          category: "",
          value: "",
          ket: "",
          transfer: false,
          file: null,
        });
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

      if (formData.file) {
        form.append("file", formData.file);
      }

      const response = await fetch("/api/petty-cash", {
        method: "PUT",
        body: form,
      });

      if (response.ok) {
        await logActivity(
          "PUT",
          `Updated petty cash entry ID: ${selectedEntry.id}`,
        );
        showMessage("Entry updated successfully", "success");
        setShowEditModal(false);
        setSelectedEntry(null);
        setFormData({
          description: "",
          category: "",
          value: "",
          ket: "",
          transfer: false,
          file: null,
        });
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
      const response = await fetch(`/api/petty-cash?id=${id}`, {
        method: "DELETE",
      });

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

  const canEditDelete = (entry: PettyCash) => {
    return user.petty_cash_export || entry.update_by === user.user_name;
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      Date: item.date,
      Description: toTitleCase(item.description),
      Category: item.category,
      Value: parseInt(item.value || "0"), // CHANGED: Export as number
      Store: item.store,
      Ket: item.ket,
      Transfer: item.transfer === "TRUE" ? "Yes" : "No",
      Link: item.link_url || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash");
    XLSX.writeFile(wb, "petty_cash.xlsx");
    logActivity(
      "GET",
      `Exported petty cash to Excel: ${filteredData.length} entries`,
    );
  };

  const exportReportToExcel = () => {
    const reportData = generateReportData();
    
    const exportData = reportData.map((item) => ({
      Store: item.store,
      "Petty Cash": item.pettyCash,
      Listrik: item.listrik,
      Total: item.total,
    }));

    // Add Grand Total row
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
    const filename = `petty_cash_report_${transferStatus}_${new Date().toISOString().split("T")[0]}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    logActivity(
      "GET",
      `Exported petty cash report to Excel: ${reportData.length} stores`,
    );
  };

  const exportToDoc = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/petty-cash/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: filteredData,
          username: user.name,
          dateFrom,
          dateTo,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Petty_Cash_${user.user_name}_${new Date().toISOString().split("T")[0]}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        await logActivity(
          "GET",
          `Exported petty cash to DOC: ${filteredData.length} entries`,
        );
        showMessage("Document exported successfully", "success");
      } else {
        showMessage("Failed to export document", "error");
      }
    } catch (error) {
      showMessage("Failed to export document", "error");
    } finally {
      setExporting(false);
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
            <h1 className="text-2xl font-bold text-primary">Petty Cash</h1>
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
                className={`px-4 py-1.5 rounded text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-4 py-1.5 rounded text-xs transition-colors ${
                  viewMode === "report"
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Report View
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {viewMode === "list" ? (
                <>
                  <div className="relative" ref={categoryDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <button
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                    >
                      <span className="text-gray-500">
                        {selectedCategories.length === 0
                          ? "Select category..."
                          : `${selectedCategories.length} selected`}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    {showCategoryDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {categories.map((category) => (
                          <label
                            key={category}
                            className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category)}
                              onChange={() => toggleCategory(category)}
                              className="mr-2"
                            />
                            {category}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={storeDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Store
                    </label>
                    <button
                      onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                    >
                      <span className="text-gray-500">
                        {selectedStores.length === 0
                          ? "Select store..."
                          : `${selectedStores.length} selected`}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    {showStoreDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {stores.map((store) => (
                          <label
                            key={store}
                            className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStores.includes(store)}
                              onChange={() => toggleStore(store)}
                              className="mr-2"
                            />
                            {store}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* NEW: Transfer Filter for List View */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Transfer Status
                    </label>
                    <select
                      value={transferFilter}
                      onChange={(e) => setTransferFilter(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">All</option>
                      <option value="false">Belum Transfer</option>
                      <option value="true">Sudah Transfer</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Store
                    </label>
                    <button
                      onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                    >
                      <span className="text-gray-500">
                        {selectedStores.length === 0
                          ? "All stores..."
                          : `${selectedStores.length} selected`}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    {showStoreDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {stores.map((store) => (
                          <label
                            key={store}
                            className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStores.includes(store)}
                              onChange={() => toggleStore(store)}
                              className="mr-2"
                            />
                            {store}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Transfer Status
                    </label>
                    <select
                      value={reportTransferFilter}
                      onChange={(e) => setReportTransferFilter(e.target.value as "false" | "true")}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="false">Belum Transfer</option>
                      <option value="true">Sudah Transfer</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset
              </button>
              {user.petty_cash_export && (
                <>
                  {viewMode === "list" ? (
                    <>
                      <button
                        onClick={exportToExcel}
                        className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto"
                      >
                        Export XLSX
                      </button>
                      <button
                        onClick={exportToDoc}
                        disabled={exporting}
                        className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {exporting ? "Exporting..." : "Export DOC"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={exportReportToExcel}
                      className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto"
                    >
                      Export Report XLSX
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : viewMode === "report" ? (
              /* Report View */
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">
                          Store
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Petty Cash
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Listrik
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {generateReportData().map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{item.store}</td>
                          <td className="px-4 py-3 text-right">
                            {formatRupiah(item.pettyCash)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatRupiah(item.listrik)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">
                            {formatRupiah(item.total)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-4 py-3">Grand Total</td>
                        <td className="px-4 py-3 text-right">
                          {formatRupiah(
                            generateReportData().reduce(
                              (sum, item) => sum + item.pettyCash,
                              0
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatRupiah(
                            generateReportData().reduce(
                              (sum, item) => sum + item.listrik,
                              0
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {formatRupiah(
                            generateReportData().reduce(
                              (sum, item) => sum + item.total,
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {generateReportData().length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No data available
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* List View */
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">
                          Description
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">
                          Category
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">
                          Value
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">
                          Store
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">
                          Ket
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">
                          Transfer
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 w-16">
                          Link
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.date}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.category}</td>
                          <td className="px-3 py-2">
                            {formatRupiah(item.value)}
                          </td>
                          <td className="px-3 py-2">{item.store}</td>
                          <td className="px-3 py-2">{item.ket || "-"}</td>
                          <td className="px-3 py-2 text-center">
                            {item.transfer === "TRUE" ? "✓" : "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.link_url ? (
                              <a
                                href={item.link_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
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
                                  onClick={() => handleEdit(item)}
                                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
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
                        <td colSpan={3} className="px-3 py-2 text-right">
                          Total:
                        </td>
                        <td className="px-3 py-2">
                          {formatRupiah(totalValue)}
                        </td>
                        <td colSpan={5}></td>
                      </tr>
                    </tbody>
                  </table>
                  {filteredData.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No data available
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to{" "}
                      {Math.min(indexOfLastItem, filteredData.length)} of{" "}
                      {filteredData.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-xs border rounded ${
                                currentPage === page
                                  ? "bg-primary text-white"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span key={page} className="px-2">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">
              Add Petty Cash Entry
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description*
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category*
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value*
                  </label>
                  <input
                    type="text"
                    value={formData.value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFormData({
                        ...formData,
                        value: val ? formatRupiah(val) : "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Rp 0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store
                  </label>
                  <input
                    type="text"
                    value={user.user_name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keterangan
                  </label>
                  <textarea
                    value={formData.ket}
                    onChange={(e) =>
                      setFormData({ ...formData, ket: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.transfer}
                      onChange={(e) =>
                        setFormData({ ...formData, transfer: e.target.checked })
                      }
                      className="mr-2"
                    />
                    Transfer
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Receipt
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        file: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {formData.file && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formData.file.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      description: "",
                      category: "",
                      value: "",
                      ket: "",
                      transfer: false,
                      file: null,
                    });
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Add Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">
              Edit Petty Cash Entry
            </h2>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description*
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category*
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value*
                  </label>
                  <input
                    type="text"
                    value={formData.value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFormData({
                        ...formData,
                        value: val ? formatRupiah(val) : "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Rp 0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store
                  </label>
                  <input
                    type="text"
                    value={selectedEntry.store}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keterangan
                  </label>
                  <textarea
                    value={formData.ket}
                    onChange={(e) =>
                      setFormData({ ...formData, ket: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.transfer}
                      onChange={(e) =>
                        setFormData({ ...formData, transfer: e.target.checked })
                      }
                      className="mr-2"
                    />
                    Transfer
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Receipt (Optional - will replace existing)
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        file: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {formData.file && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected: {formData.file.name}
                    </p>
                  )}
                  {selectedEntry.link_url && !formData.file && (
                    <p className="text-xs text-blue-600 mt-1">
                      Current file:{" "}
                      <a
                        href={selectedEntry.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEntry(null);
                    setFormData({
                      description: "",
                      category: "",
                      value: "",
                      ket: "",
                      transfer: false,
                      file: null,
                    });
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Update Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Popup
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}