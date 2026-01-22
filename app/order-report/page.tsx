"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { OrderReport } from "@/types";
import * as XLSX from "xlsx";
import Papa from "papaparse";

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'powerbiz' | 'delivery_note' | 'sales_invoice'>('powerbiz');
  const [importing, setImporting] = useState(false);
  
  // Pagination
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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/order-report");
      const result = await response.json();
      setData(result);
      setFilteredData(result);
      
      const uniqueStatuses = [...new Set(result.map((item: OrderReport) => item.status))].filter(Boolean);
      setStatuses(uniqueStatuses as string[]);
    } catch (error) {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
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

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      let parsedData: any[] = [];

      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: async (results) => {
            parsedData = results.data.slice(1);
            await uploadToSheet(parsedData);
          },
          header: false,
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          parsedData = jsonData.slice(1);
          await uploadToSheet(parsedData);
        };
        reader.readAsBinaryString(file);
      }
    } catch (error) {
      alert("Failed to import file");
    } finally {
      setImporting(false);
    }
  };

  const uploadToSheet = async (importData: any[]) => {
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName: importType,
          data: importData,
        }),
      });

      if (response.ok) {
        alert("Data imported successfully");
        setShowImportModal(false);
        fetchData(); // Refresh data
      } else {
        alert("Failed to import data");
      }
    } catch (error) {
      alert("Failed to import data");
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
    XLSX.writeFile(wb, "order_report.xlsx");
  };

  // Pagination calculations
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

          {/* Filter Section */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-4 gap-3 mb-3">
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto">
                  {statuses.map((status) => (
                    <label key={status} className="flex items-center text-xs mb-1 cursor-pointer hover:bg-gray-50 p-1 rounded">
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
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                className="px-4 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90"
              >
                Apply Filter
              </button>
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                Import
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-1.5 bg-secondary text-primary rounded text-xs hover:bg-secondary/90 ml-auto"
              >
                Export to Excel
              </button>
            </div>
          </div>

          {/* Table */}
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

                {/* Pagination */}
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">Import Data</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Import Type
                </label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="powerbiz_salesorder">PowerBiz Sales Order</option>
                  <option value="delivery_note">Delivery Note</option>
                  <option value="sales_invoice">Sales Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose File (CSV or Excel)
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileImport}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90"
                />
              </div>

              {importing && (
                <div className="text-sm text-gray-600 text-center">
                  Importing...
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
