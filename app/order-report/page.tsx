"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import { OrderReport } from "@/types";
import * as XLSX from "xlsx";
import Papa from "papaparse";

// Mapping username ke warehouse
const USERNAME_TO_WAREHOUSE: Record<string, string> = {
  'cirebon': 'WH TORCH CIREBON',
  'jogja': 'WH TORCH JOGJA',
  'karawaci': 'WH TORCH KARAWACI',
  'karawang': 'WH TORCH KARAWANG',
  'lampung': 'WH TORCH LAMPUNG',
  'lembong': 'WH TORCH LEMBONG',
  'makassar': 'WH TORCH MAKASSAR',
  'malang': 'WH TORCH MALANG',
  'margonda': 'WH TORCH MARGONDA',
  'medan': 'WH TORCH MEDAN',
  'pekalongan': 'WH TORCH PEKALONGAN',
  'purwokerto': 'WH TORCH PURWOKERTO',
  'surabaya': 'WH TORCH SURABAYA',
  'tambun': 'WH TORCH TAMBUN',
};

export default function OrderReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<OrderReport[]>([]);
  const [filteredData, setFilteredData] = useState<OrderReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [lockedWarehouse, setLockedWarehouse] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  
  const [powerbizFile, setPowerbizFile] = useState<File | null>(null);
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.order_report) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    
    // Check if user has warehouse lock based on username
    const username = parsedUser.user_name.toLowerCase();
    const locked = USERNAME_TO_WAREHOUSE[username] || null;
    setLockedWarehouse(locked);
    
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dateFrom, dateTo, statusFilter, warehouseFilter, data]);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/order-report");
      const result = await response.json();
      setData(result);
      setFilteredData(result);
      
      const uniqueStatuses = [...new Set(result.map((item: OrderReport) => item.status))].filter(Boolean);
      setStatuses(uniqueStatuses as string[]);
      
      const uniqueWarehouses = [...new Set(result.map((item: OrderReport) => item.warehouse))].filter(Boolean);
      setWarehouses(uniqueWarehouses as string[]);
    } catch (error) {
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const [datePart] = dateString.split(" ");
    const [day, month, year] = datePart.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[parseInt(month) - 1]} ${year}`;
  };

  const applyFilters = () => {
    let filtered = [...data];

    // Apply warehouse lock if user doesn't have import permission
    if (lockedWarehouse && !user?.order_report_import) {
      filtered = filtered.filter((item) => item.warehouse === lockedWarehouse);
    } else if (warehouseFilter.length > 0) {
      filtered = filtered.filter((item) => warehouseFilter.includes(item.warehouse));
    }

    if (dateFrom) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.order_date.split(" ")[0].split("-").reverse().join("-"));
        const fromDate = new Date(dateFrom);
        return itemDate >= fromDate;
      });
    }

    if (dateTo) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.order_date.split(" ")[0].split("-").reverse().join("-"));
        const toDate = new Date(dateTo);
        return itemDate <= toDate;
      });
    }

    if (statusFilter.length > 0) {
      filtered = filtered.filter((item) => statusFilter.includes(item.status));
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatusFilter([]);
    // Only reset warehouse filter if user has import permission
    if (user?.order_report_import) {
      setWarehouseFilter([]);
    }
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleWarehouse = (warehouse: string) => {
    setWarehouseFilter(prev => 
      prev.includes(warehouse) 
        ? prev.filter(w => w !== warehouse)
        : [...prev, warehouse]
    );
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: (results) => {
            let parsedData = results.data as any[];
            parsedData = parsedData.filter(row => 
              Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            resolve(parsedData);
          },
          header: false,
          skipEmptyLines: true,
          error: (error) => {
            reject(error);
          }
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            jsonData = jsonData.filter(row => 
              Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => {
          reject(new Error("Failed to read file"));
        };
        reader.readAsBinaryString(file);
      } else {
        reject(new Error("Unsupported file format"));
      }
    });
  };

  const uploadToSheet = async (sheetName: string, importData: any[]) => {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetName: sheetName,
        data: importData,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Import failed');
    }

    return await response.json();
  };

  const handleImportAll = async () => {
    if (!powerbizFile && !deliveryFile && !invoiceFile) {
      showMessage("Please select at least one file to import", "error");
      return;
    }

    setImporting(true);
    const results: string[] = [];
    const errors: string[] = [];

    try {
      if (powerbizFile) {
        try {
          const parsedData = await parseFile(powerbizFile);
          if (parsedData.length === 0) {
            errors.push("PowerBiz: No valid data found");
          } else {
            const result = await uploadToSheet('powerbiz_salesorder', parsedData);
            results.push(`PowerBiz: ${result.rowsImported} rows imported`);
          }
        } catch (error) {
          errors.push(`PowerBiz: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }

      if (deliveryFile) {
        try {
          const parsedData = await parseFile(deliveryFile);
          if (parsedData.length === 0) {
            errors.push("Delivery Note: No valid data found");
          } else {
            const result = await uploadToSheet('delivery_note', parsedData);
            results.push(`Delivery Note: ${result.rowsImported} rows imported`);
          }
        } catch (error) {
          errors.push(`Delivery Note: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }

      if (invoiceFile) {
        try {
          const parsedData = await parseFile(invoiceFile);
          if (parsedData.length === 0) {
            errors.push("Sales Invoice: No valid data found");
          } else {
            const result = await uploadToSheet('sales_invoice', parsedData);
            results.push(`Sales Invoice: ${result.rowsImported} rows imported`);
          }
        } catch (error) {
          errors.push(`Sales Invoice: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }

      let message = "";
      if (results.length > 0) {
        message += "✅ Success:\n" + results.join("\n");
      }
      if (errors.length > 0) {
        message += (message ? "\n\n" : "") + "❌ Errors:\n" + errors.join("\n");
      }
      
      showMessage(message || "Import completed", results.length > 0 && errors.length === 0 ? "success" : "error");
      
      if (results.length > 0) {
        setShowImportModal(false);
        setPowerbizFile(null);
        setDeliveryFile(null);
        setInvoiceFile(null);
        fetchData();
      }
    } catch (error) {
      showMessage("Failed to import data. Please try again.", "error");
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      "Order Date": formatDate(item.order_date),
      "Sales Order": item.sales_order,
      "Warehouse": item.warehouse,
      "Status": item.status,
      "Sales Channel": item.sales_channel,
      "Payment Method": item.payment_method,
      "Value Amount": item.value_amount,
      "Delivery Note": item.delivery_note || "-",
      "Sales Invoice": item.sales_invoice || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Order Report");
    XLSX.writeFile(wb, `order_report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <h1 className="text-2xl font-bold text-primary mb-6">Order Report</h1>

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
              
              {/* Warehouse Filter */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Warehouse
                  {lockedWarehouse && !user?.order_report_import && (
                    <span className="ml-1 text-red-500">🔒</span>
                  )}
                </label>
                {lockedWarehouse && !user?.order_report_import ? (
                  <input
                    type="text"
                    value={lockedWarehouse}
                    disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-gray-100 cursor-not-allowed"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                    >
                      <span className="text-gray-500">
                        {warehouseFilter.length === 0 
                          ? "All warehouses..." 
                          : `${warehouseFilter.length} selected`}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    {showWarehouseDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {warehouses.map((warehouse) => (
                          <label 
                            key={warehouse} 
                            className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={warehouseFilter.includes(warehouse)}
                              onChange={() => toggleWarehouse(warehouse)}
                              className="mr-2"
                            />
                            {warehouse}
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Status Filter */}
              <div className="col-span-2 relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                  >
                    <span className="text-gray-500">
                      {statusFilter.length === 0 
                        ? "Select status..." 
                        : `${statusFilter.length} selected`}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      {statuses.map((status) => (
                        <label 
                          key={status} 
                          className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={statusFilter.includes(status)}
                            onChange={() => toggleStatus(status)}
                            className="mr-2"
                          />
                          {status}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset
              </button>
              {user.order_report_import && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Import
                </button>
              )}
              {user.order_report_export && (
                <button
                  onClick={exportToExcel}
                  className="px-4 py-1.5 bg-secondary text-primary rounded text-xs hover:bg-secondary/90 ml-auto"
                >
                  Export to Excel
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Order Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Sales Order</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Warehouse</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Sales Channel</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Payment Method</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Value Amount</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Delivery Note</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Sales Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{formatDate(item.order_date)}</td>
                          <td className="px-3 py-2">{item.sales_order}</td>
                          <td className="px-3 py-2">{item.warehouse}</td>
                          <td className="px-3 py-2">{item.status}</td>
                          <td className="px-3 py-2">{item.sales_channel}</td>
                          <td className="px-3 py-2">{item.payment_method}</td>
                          <td className="px-3 py-2">{item.value_amount}</td>
                          <td className="px-3 py-2">
                            {item.delivery_note && item.delivery_note !== "null" ? (
                              item.delivery_note
                            ) : (
                              <span className="text-red-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {item.sales_invoice && item.sales_invoice !== "null" ? (
                              item.sales_invoice
                            ) : (
                              <span className="text-red-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredData.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No data available</div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Import Data</h2>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Upload files for PowerBiz Sales Order, Delivery Note, and/or Sales Invoice. 
                You can upload one, two, or all three files at once.
              </p>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  1. PowerBiz Sales Order
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setPowerbizFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
                />
                {powerbizFile && (
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    ✓ Selected: {powerbizFile.name}
                  </p>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  2. Delivery Note
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
                />
                {deliveryFile && (
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    ✓ Selected: {deliveryFile.name}
                  </p>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  3. Sales Invoice
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
                />
                {invoiceFile && (
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    ✓ Selected: {invoiceFile.name}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Files should be CSV or Excel format. All data including headers will be replaced.
                </p>
              </div>

              {importing && (
                <div className="text-sm text-gray-600 text-center py-3">
                  <div className="animate-pulse">Importing files... Please wait.</div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setPowerbizFile(null);
                  setDeliveryFile(null);
                  setInvoiceFile(null);
                }}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImportAll}
                disabled={importing || (!powerbizFile && !deliveryFile && !invoiceFile)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import Selected Files"}
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