"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import { Canvasing } from "@/types";
import * as XLSX from "xlsx";

const RESULT_STATUS_OPTIONS = [
  "Interested",
  "Document Submitted",
  "Waiting Approval",
  "Follow Up",
  "Deal",
  "Reject",
  "Cancel",
];

// Component using server-side proxy to bypass CORS
function DriveImage({ href, urls, alt }: { href: string; urls: string[]; alt: string }) {
  // Extract fileId from first URL and use proxy
  const proxyUrl = urls[0]; // Already set to /api/drive-image?id=...

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
      <img
        src={proxyUrl}
        alt={alt}
        className="h-64 w-64 object-cover rounded-lg border hover:opacity-75 transition-opacity cursor-pointer"
      />
    </a>
  );
}

export default function CanvasingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<Canvasing[]>([]);
  const [filteredData, setFilteredData] = useState<Canvasing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "report">("list");
  const [exporting, setExporting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Canvasing | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);

  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Canvasing | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const storeDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    category: "",
    sub_category: "",
    canvasser: "",
    visit_at: "",
    result_status: "",
    notes: "",
    files: [] as File[],
    keepExistingImages: true,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        storeDropdownRef.current &&
        !storeDropdownRef.current.contains(event.target as Node)
      ) {
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
    if (!parsedUser.canvasing) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, storeFilter, data]);

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
      setData(result.data);
      setFilteredData(result.data);

      if (result.isOwner) {
        setStoreFilter([result.storeName]);
      } else {
        const uniqueStores = [
          ...new Set(result.data.map((item: Canvasing) => item.store)),
        ].filter(Boolean);
        setStores(uniqueStores as string[]);
      }
    } catch (error) {
      showMessage("Failed to fetch canvasing data", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data];

    if (statusFilter.length > 0) {
      filtered = filtered.filter((item) =>
        statusFilter.includes(item.result_status)
      );
    }

    if (storeFilter.length > 0) {
      filtered = filtered.filter((item) => storeFilter.includes(item.store));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.sub_category.toLowerCase().includes(query) ||
          (item.contact_person &&
            item.contact_person.toLowerCase().includes(query))
      );
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter([]);
    if (!isOwner) {
      setStoreFilter([]);
    }
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleStore = (store: string) => {
    setStoreFilter((prev) =>
      prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store]
    );
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
      setFormData({
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
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntry(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({ ...formData, files: Array.from(e.target.files) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const form = new FormData();

      if (editingEntry) {
        form.append("id", editingEntry.id);
        form.append("keepExistingImages", formData.keepExistingImages.toString());
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

      formData.files.forEach((file, index) => {
        form.append(`file_${index}`, file);
      });

      const url = editingEntry ? "/api/canvasing" : "/api/canvasing";
      const method = editingEntry ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: form,
      });

      if (response.ok) {
        const action = editingEntry ? "Updated" : "Created";
        await logActivity(
          editingEntry ? "PUT" : "POST",
          `${action} canvasing entry: ${formData.name}`
        );
        showMessage(
          editingEntry
            ? "Entry updated successfully"
            : "Entry created successfully",
          "success"
        );
        handleCloseModal();
        fetchData(user.user_name);
      } else {
        showMessage("Failed to save entry", "error");
      }
    } catch (error) {
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
    } catch (error) {
      showMessage("Failed to delete entry", "error");
    }
  };

  const canEdit = (entry: Canvasing) => {
    if (isOwner) {
      return entry.store.toLowerCase() === storeName.toLowerCase();
    }
    return true;
  };

  const toTitleCase = (str: string) =>
    str
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const extractDriveFileId = (url: string): string | null => {
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
  };

  const getDriveImageUrls = (url: string): string[] => {
    const fileId = extractDriveFileId(url);
    if (!fileId) return [url];
    // Use server-side proxy to bypass CORS
    return [`/api/drive-image?id=${fileId}`];
  };

  const generateReportData = () => {
    const storesInData = [...new Set(filteredData.map((item) => item.store))];
    const statuses = RESULT_STATUS_OPTIONS;

    const reportData = storesInData.map((store) => {
      const storeData = filteredData.filter((item) => item.store === store);
      const row: any = { store };

      statuses.forEach((status) => {
        row[status] = storeData.filter(
          (item) => item.result_status === status
        ).length;
      });

      row.total = storeData.length;

      return row;
    });

    return reportData;
  };

  const exportReportToExcel = () => {
    const reportData = generateReportData();
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Canvasing Report");
    XLSX.writeFile(
      wb,
      `canvasing_report_${new Date().toISOString().split("T")[0]}.xlsx`
    );
    logActivity("GET", "Exported canvasing report to Excel");
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
        a.download = `Canvasing_${isOwner ? storeName : "All"}_${
          new Date().toISOString().split("T")[0]
        }.docx`;
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
    } catch (error) {
      showMessage("Failed to export document", "error");
    } finally {
      setExporting(false);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary">
              {isOwner ? `${storeName} - Canvasing` : "Canvasing Management"}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  viewMode === "report"
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Report
              </button>
            </div>
          </div>

          {/* Filters */}
          {viewMode === "list" && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter[0] || ""}
                    onChange={(e) =>
                      setStatusFilter(e.target.value ? [e.target.value] : [])
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Status</option>
                    {RESULT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Store Filter */}
                <div className="relative" ref={storeDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Store {isOwner && <span className="text-red-500">🔒</span>}
                  </label>
                  {isOwner ? (
                    <input
                      type="text"
                      value={storeName}
                      disabled
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-100 cursor-not-allowed"
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                      >
                        <span className="text-gray-500">
                          {storeFilter.length === 0
                            ? "All stores..."
                            : `${storeFilter.length} selected`}
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
                                checked={storeFilter.includes(store)}
                                onChange={() => toggleStore(store)}
                                className="mr-2"
                              />
                              {store}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, category, or CP..."
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={resetFilters}
                  className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                >
                  Reset Filters
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-4 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90 ml-auto"
                >
                  Add Entry
                </button>
                {user.canvasing_export && (
                  <button
                    onClick={exportToDoc}
                    disabled={exporting}
                    className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {exporting ? "Exporting..." : "Export DOC"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Report Export */}
          {viewMode === "report" && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="flex justify-end">
                <button
                  onClick={exportReportToExcel}
                  className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90"
                >
                  Export Report XLSX
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : viewMode === "list" ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          CP
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Category
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Sub Category
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Canvasser
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Visit At
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Images
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => {
                        const images = item.image_url
                          ? item.image_url
                              .split(";")
                              .filter((url) => url.trim())
                          : [];

                        return (
                          <tr
                            key={index}
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleRowClick(item)}
                          >
                            <td className="px-3 py-2 font-medium">
                              {item.name}
                            </td>
                            <td className="px-3 py-2">
                              {item.contact_person || "-"}
                            </td>
                            <td className="px-3 py-2">{item.category}</td>
                            <td className="px-3 py-2">{item.sub_category}</td>
                            <td className="px-3 py-2">{item.canvasser}</td>
                            <td className="px-3 py-2">{item.visit_at}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  item.result_status === "Deal"
                                    ? "bg-green-100 text-green-800"
                                    : item.result_status === "Interested"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.result_status === "Reject" ||
                                      item.result_status === "Cancel"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {item.result_status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {images.length > 0 ? (
                                <div className="flex gap-1">
                                  {images.slice(0, 2).map((url, i) => (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      [{i + 1}]
                                    </a>
                                  ))}
                                  {images.length > 2 && (
                                    <span className="text-xs text-gray-500">
                                      +{images.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {canEdit(item) && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenModal(item);
                                      }}
                                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                    >
                                      Edit
                                    </button>
                                    {!isOwner && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(item.id);
                                        }}
                                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                            Math.min(totalPages, prev + 1)
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
            ) : (
              /* Report View */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Store
                      </th>
                      {RESULT_STATUS_OPTIONS.map((status) => (
                        <th
                          key={status}
                          className="px-4 py-3 text-center font-semibold text-gray-700"
                        >
                          {status}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-blue-50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateReportData().map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.store}</td>
                        {RESULT_STATUS_OPTIONS.map((status) => (
                          <td key={status} className="px-4 py-3 text-center">
                            {row[status]}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center font-semibold text-blue-600 bg-blue-50">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generateReportData().length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Popup */}
      {showDetailPopup && selectedEntry && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setShowDetailPopup(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Images */}
            {selectedEntry.image_url && selectedEntry.image_url.trim() ? (
              <div className="flex justify-center gap-2 overflow-x-auto p-4 bg-gray-50 border-b">
                {selectedEntry.image_url
                  .split(";")
                  .filter((u) => u.trim())
                  .map((url, i) => {
                    const urls = getDriveImageUrls(url);
                    return (
                      <DriveImage
                        key={i}
                        href={url}
                        urls={urls}
                        alt={`Image ${i + 1}`}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="h-16 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border-b">
                No images
              </div>
            )}

            {/* Store name */}
            <div className="px-5 pt-4 pb-1">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">
                {toTitleCase(selectedEntry.store)}
              </p>
            </div>

            {/* Fields grid */}
            <div className="px-5 pb-4 pt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Name</p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Contact Person
                </p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.contact_person || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Category
                </p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.category || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Sub Category
                </p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.sub_category || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Canvasser
                </p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.canvasser || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Visit At
                </p>
                <p className="font-semibold text-gray-800">
                  {selectedEntry.visit_at || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-medium mb-0.5">
                  Result Status
                </p>
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    selectedEntry.result_status === "Deal"
                      ? "bg-green-100 text-green-800"
                      : selectedEntry.result_status === "Interested"
                      ? "bg-blue-100 text-blue-800"
                      : selectedEntry.result_status === "Reject" ||
                        selectedEntry.result_status === "Cancel"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {selectedEntry.result_status || "-"}
                </span>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Notes</p>
                <p className="text-gray-800 whitespace-pre-wrap text-sm">
                  {selectedEntry.notes || "-"}
                </p>
              </div>
            </div>

            {/* Close button */}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">
              {editingEntry ? "Edit Entry" : "Add New Entry"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name*
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact_person: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category*
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Category
                  </label>
                  <input
                    type="text"
                    value={formData.sub_category}
                    onChange={(e) =>
                      setFormData({ ...formData, sub_category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Canvasser*
                  </label>
                  <input
                    type="text"
                    value={formData.canvasser}
                    onChange={(e) =>
                      setFormData({ ...formData, canvasser: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visit Date*
                  </label>
                  <input
                    type="date"
                    value={formData.visit_at}
                    onChange={(e) =>
                      setFormData({ ...formData, visit_at: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Result Status*
                  </label>
                  <select
                    value={formData.result_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        result_status: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Status</option>
                    {RESULT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Images (Multiple)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {formData.files.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.files.length} file(s) selected
                    </p>
                  )}
                  {editingEntry && editingEntry.image_url && (
                    <div className="mt-2">
                      <label className="flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.keepExistingImages}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              keepExistingImages: e.target.checked,
                            })
                          }
                          className="mr-2"
                        />
                        Keep existing images
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                  {submitting
                    ? "Saving..."
                    : editingEntry
                    ? "Update Entry"
                    : "Create Entry"}
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