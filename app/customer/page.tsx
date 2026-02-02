"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import { Customer } from "@/types";
import * as XLSX from "xlsx";

const RESULT_OPTIONS = [
  "Terkirim",
  "Tidak ada Respon",
  "Merespon Membeli",
  "Merespon Tidak Membeli",
];

const STORE_LIST = [
  "Torch Cirebon",
  "Torch Jogja",
  "Torch Karawaci",
  "Torch Karawang",
  "Torch Lampung",
  "Torch Lembong",
  "Torch Makassar",
  "Torch Malang",
  "Torch Margonda",
  "Torch Medan",
  "Torch Pekalongan",
  "Torch Purwokerto",
  "Torch Surabaya",
  "Torch Tambun",
];

export default function CustomerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<"list" | "report1" | "report2">("list");
  const [data, setData] = useState<Customer[]>([]);
  const [filteredData, setFilteredData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const [followupChecked, setFollowupChecked] = useState(false);
  const [followupResult, setFollowupResult] = useState("");
  const [followupKet, setFollowupKet] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.customer) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedStores, dateFrom, dateTo, data]);

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
      const response = await fetch(
        `/api/customer?username=${username}&view=list`,
      );
      const result = await response.json();

      setIsOwner(result.isOwner);
      setStoreName(result.storeName || "");
      setData(result.data);
      setFilteredData(result.data);

      if (!result.isOwner) {
        const uniqueStores = [
          ...new Set(result.data.map((item: Customer) => item.location_store)),
        ].filter(Boolean);
        setStores(uniqueStores as string[]);
      }
    } catch (error) {
      showMessage("Failed to fetch customer data", "error");
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    const parts = dateString.split(",")[0].split(" ");
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
    return new Date(
      parseInt(parts[2]),
      months[parts[1]],
      parseInt(parts[0]),
    );
  };

  const applyFilters = () => {
    let filtered = [...data];

    if (!isOwner && selectedStores.length > 0) {
      filtered = filtered.filter((item) =>
        selectedStores.includes(item.location_store),
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.phone_number.toLowerCase().includes(query) ||
          item.customer_name.toLowerCase().includes(query),
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((item) => {
        const itemDate = parseDate(item.update_at);
        return itemDate && itemDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter((item) => {
        const itemDate = parseDate(item.update_at);
        return itemDate && itemDate <= toDate;
      });
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStores([]);
    setDateFrom("");
    setDateTo("");
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleStore = (store: string) => {
    setSelectedStores((prev) =>
      prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store],
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showMessage("Copied to clipboard!", "success");
  };

  const openFollowupModal = (customer: Customer, rowIndex: number) => {
    setSelectedCustomer(customer);
    setSelectedRowIndex(rowIndex);
    setFollowupChecked(
      customer.followup === "TRUE" ||
        customer.followup === "True" ||
        customer.followup === "true",
    );
    setFollowupResult(customer.result || "");
    setFollowupKet(customer.ket || "");
    setSelectedFile(null);
    setShowFollowupModal(true);
  };

  const closeFollowupModal = () => {
    setShowFollowupModal(false);
    setSelectedCustomer(null);
    setSelectedRowIndex(null);
    setFollowupChecked(false);
    setFollowupResult("");
    setFollowupKet("");
    setSelectedFile(null);
  };

  const handleFollowupSubmit = async () => {
    if (!selectedCustomer || selectedRowIndex === null) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append(
        "storeName",
        isOwner ? storeName : selectedCustomer.location_store,
      );
      formData.append("phoneNumber", selectedCustomer.phone_number);
      formData.append("username", user.user_name);
      formData.append("followup", followupChecked.toString());
      formData.append("result", followupResult);
      formData.append("ket", followupKet);

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      formData.append("rowIndex", (selectedRowIndex + 2).toString());

      const response = await fetch("/api/customer", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        await logActivity("PUT", `Updated customer followup`);
        showMessage("Followup saved successfully", "success");
        closeFollowupModal();
        fetchData(user.user_name);
      } else {
        showMessage("Failed to save followup", "error");
      }
    } catch (error) {
      showMessage("Failed to save followup", "error");
    } finally {
      setUploading(false);
    }
  };

  // Report 1: Date x Store matrix
  const generateReport1Data = () => {
    const dateStoreMap = new Map<string, Map<string, number>>();

    filteredData.forEach((item) => {
      if (!item.update_at) return;
      const date = item.update_at.split(",")[0]; // Get date part only
      const store = item.location_store;

      if (!dateStoreMap.has(date)) {
        dateStoreMap.set(date, new Map());
      }

      const storeMap = dateStoreMap.get(date)!;
      storeMap.set(store, (storeMap.get(store) || 0) + 1);
    });

    const sortedDates = Array.from(dateStoreMap.keys()).sort((a, b) => {
      const dateA = parseDate(a + ", 00:00");
      const dateB = parseDate(b + ", 00:00");
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    });

    return sortedDates.map((date) => {
      const storeMap = dateStoreMap.get(date)!;
      const row: any = { date };

      STORE_LIST.forEach((store) => {
        row[store] = storeMap.get(store) || 0;
      });

      row.total = Array.from(storeMap.values()).reduce((a, b) => a + b, 0);

      return row;
    });
  };

  // Report 2: Store x Result matrix
  const generateReport2Data = () => {
    const storeCustomerCount = new Map<string, number>();
    const storeResultMap = new Map<string, Map<string, number>>();

    // Count total customers per store (including No Result)
    filteredData.forEach((item) => {
      const store = item.location_store;
      storeCustomerCount.set(store, (storeCustomerCount.get(store) || 0) + 1);
    });

    // Count results per store (excluding No Result)
    filteredData.forEach((item) => {
      const store = item.location_store;
      const result = item.result;

      // Skip items without result (No Result)
      if (!result || result.trim() === "") return;

      if (!storeResultMap.has(store)) {
        storeResultMap.set(store, new Map());
      }

      const resultMap = storeResultMap.get(store)!;
      resultMap.set(result, (resultMap.get(result) || 0) + 1);
    });

    const allResults = new Set<string>();
    storeResultMap.forEach((resultMap) => {
      resultMap.forEach((_, result) => allResults.add(result));
    });

    const sortedResults = Array.from(allResults).sort();

    return STORE_LIST.map((store) => {
      const totalCustomer = storeCustomerCount.get(store) || 0;
      const resultMap = storeResultMap.get(store);

      const row: any = { 
        store, 
        totalCustomer 
      };

      sortedResults.forEach((result) => {
        const count = resultMap?.get(result) || 0;
        row[result] = count;
      });

      // Calculate percentage (total results with actual result / total customers * 100)
      const totalResults = resultMap
        ? Array.from(resultMap.values()).reduce((a, b) => a + b, 0)
        : 0;
      row.percentage = totalCustomer > 0 
        ? ((totalResults / totalCustomer) * 100).toFixed(1) + "%"
        : "0%";

      return row;
    }).filter((row) => row.totalCustomer > 0);
  };

  const exportReport1ToExcel = () => {
    const reportData = generateReport1Data();
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Date x Store Report");
    XLSX.writeFile(
      wb,
      `customer_report_date_store_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    logActivity("GET", "Exported customer report 1 (Date x Store)");
  };

  const exportReport2ToExcel = () => {
    const reportData = generateReport2Data();
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Store x Result Report");
    XLSX.writeFile(
      wb,
      `customer_report_store_result_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    logActivity("GET", "Exported customer report 2 (Store x Result)");
  };

  // Get cell color based on value for Report 1
  const getCellColor = (value: number) => {
    if (value < 10) {
      return "text-red-600 font-semibold"; // Solid red text
    } else if (value >= 10) {
      return "text-green-600 font-semibold"; // Solid green text
    }
    return ""; // Default (no color)
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
              {isOwner ? `${storeName} - Customer Data` : "Customer Management"}
            </h1>

            {!isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => setView("list")}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    view === "list"
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Customer List
                </button>
                <button
                  onClick={() => setView("report1")}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    view === "report1"
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Daily Store
                </button>
                <button
                  onClick={() => setView("report2")}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    view === "report2"
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Store Result
                </button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-4 gap-3 mb-3">
              {view === "list" && (
                <>
                  {!isOwner && (
                    <div className="relative">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Store
                      </label>
                      <button
                        onClick={() =>
                          setShowStoreDropdown(!showStoreDropdown)
                        }
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
                  )}

                  <div className={isOwner ? "col-span-4" : "col-span-3"}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Search
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by phone number or customer name..."
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </>
              )}

              {(view === "report1" || view === "report2") && (
                <>
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
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset Filters
              </button>
              {view === "report1" && (
                <button
                  onClick={exportReport1ToExcel}
                  className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto"
                >
                  Export XLSX
                </button>
              )}
              {view === "report2" && (
                <button
                  onClick={exportReport2ToExcel}
                  className="px-4 py-1.5 bg-gray-400 text-white rounded text-xs hover:bg-secondary/90 ml-auto"
                >
                  Export XLSX
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : view === "list" ? (
              /* List View */
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-24">
                          Phone
                        </th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-34">
                          Customer
                        </th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-34">
                          Store
                        </th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20">
                          Total Value
                        </th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-16">
                          Total Order
                        </th>
                        {!isOwner && (
                          <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20">
                            Average
                          </th>
                        )}
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-16">
                          Followup
                        </th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700">
                          Result & Note
                        </th>
                        {!isOwner && (
                          <>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20">
                              Update By
                            </th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 w-24">
                              Update At
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((customer, index) => {
                        const actualIndex = indexOfFirstItem + index;
                        const hasFollowup =
                          customer.followup === "TRUE" ||
                          customer.followup === "True" ||
                          customer.followup === "true";
                        return (
                          <tr
                            key={actualIndex}
                            className={`border-b hover:bg-gray-50 ${hasFollowup ? "bg-green-50" : ""}`}
                          >
                            <td className="px-2 text-center py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs">
                                  {customer.phone_number}
                                </span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(customer.phone_number)
                                  }
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Copy phone number"
                                >
                                  📋
                                </button>
                              </div>
                            </td>
                            <td className="px-2 text-center py-2 text-xs">
                              {customer.customer_name}
                            </td>
                            <td className="px-2 text-center py-2 text-xs">
                              {customer.location_store}
                            </td>
                            <td className="px-2 text-center py-2 text-xs">
                              {customer.total_value}
                            </td>
                            <td className="px-2 text-center py-2 text-xs">
                              {customer.total_order}
                            </td>
                            {!isOwner && (
                              <td className="px-2 text-center py-2 text-xs">
                                {customer.average_value}
                              </td>
                            )}
                            <td className="px-2 text-center py-2">
                              <span
                                className={`text-xs ${hasFollowup ? "text-green-600 font-semibold" : "text-gray-400"}`}
                              >
                                {hasFollowup ? "✓" : "-"}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-col items-center gap-1">
                                {customer.result && (
                                  <div className="text-xs text-gray-700 font-medium">
                                    {customer.result}
                                  </div>
                                )}
                                {customer.ket && (
                                  <div
                                    className="text-xs text-gray-600 italic max-w-xs truncate"
                                    title={customer.ket}
                                  >
                                    {customer.ket}
                                  </div>
                                )}

                                <div className="flex items-center gap-1 mt-1">
                                  {customer.link_url &&
                                    customer.link_url.trim() !== "" && (
                                      <a
                                        href={customer.link_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-xs"
                                      >
                                        View
                                      </a>
                                    )}

                                  {isOwner && (
                                    <button
                                      onClick={() =>
                                        openFollowupModal(customer, actualIndex)
                                      }
                                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                      {hasFollowup ? "Edit" : "Add"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            {!isOwner && (
                              <>
                                <td className="px-2 text-center py-2 text-xs">
                                  {customer.update_by || "-"}
                                </td>
                                <td className="px-2 text-center py-2 text-xs">
                                  {customer.update_at || "-"}
                                </td>
                              </>
                            )}
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
            ) : view === "report1" ? (
              /* Report 1: Date x Store */
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-100">
                        Date
                      </th>
                      {STORE_LIST.map((store) => (
                        <th
                          key={store}
                          className="px-2 py-2 text-center font-semibold text-gray-700"
                        >
                          {store.replace("Torch ", "")}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 bg-blue-50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateReport1Data().map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-2 py-2 font-medium sticky left-0 bg-white">
                          {row.date}
                        </td>
                        {STORE_LIST.map((store) => {
                          const value = row[store] || 0;
                          return (
                            <td
                              key={store}
                              className={`px-2 py-2 text-center ${getCellColor(value)}`}
                            >
                              {value}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-semibold text-blue-600 bg-blue-50">
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generateReport1Data().length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            ) : (
              /* Report 2: Store x Result */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">
                        Store
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">
                        Total Customer
                      </th>
                      {Array.from(
                        new Set(
                          filteredData
                            .map((item) => item.result)
                            .filter((result) => result && result.trim() !== "")
                            .sort(),
                        ),
                      ).map((result) => (
                        <th
                          key={result}
                          className="px-3 py-2 text-center font-semibold text-gray-700"
                        >
                          {result}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-blue-50">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateReport2Data().map((row, index) => {
                      const results = Array.from(
                        new Set(
                          filteredData
                            .map((item) => item.result)
                            .filter((result) => result && result.trim() !== "")
                            .sort(),
                        ),
                      );
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">
                            {row.store}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {row.totalCustomer}
                          </td>
                          {results.map((result) => (
                            <td
                              key={result}
                              className="px-3 py-2 text-center"
                            >
                              {row[result] || 0}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold text-blue-600 bg-blue-50">
                            {row.percentage}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {generateReport2Data().length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Followup Modal */}
      {showFollowupModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">
              Add/Edit Followup
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">
                <strong>Customer:</strong> {selectedCustomer.customer_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Phone:</strong> {selectedCustomer.phone_number}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followupChecked}
                    onChange={(e) => setFollowupChecked(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="font-medium">Followup Done</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result
                </label>
                <select
                  value={followupResult}
                  onChange={(e) => setFollowupResult(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select result...</option>
                  {RESULT_OPTIONS.map((result) => (
                    <option key={result} value={result}>
                      {result}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note / Keterangan
                </label>
                <textarea
                  value={followupKet}
                  onChange={(e) => setFollowupKet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Enter notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-gray-300 rounded p-2 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {selectedFile.name}
                  </p>
                )}
                {selectedCustomer.link_url && !selectedFile && (
                  <p className="text-xs text-blue-600 mt-1">
                    Current file:{" "}
                    <a
                      href={selectedCustomer.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={closeFollowupModal}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFollowupSubmit}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
              >
                {uploading ? "Saving..." : "Save Followup"}
              </button>
            </div>
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