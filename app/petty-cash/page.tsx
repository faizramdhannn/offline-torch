"use client";

import { useState, useEffect } from "react";
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
  created_at: string;
  update_at: string;
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
  const [exporting, setExporting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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
    fetchData();
    fetchCategories();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dateFrom, dateTo, selectedCategories, selectedStores, data]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async () => {
    try {
      const response = await fetch("/api/petty-cash");
      const result = await response.json();
      setData(result);
      setFilteredData(result);
      
      const uniqueStores = [...new Set(result.map((item: PettyCash) => item.store))].filter(Boolean);
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
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const parts = dateString.split(' ');
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

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedCategories([]);
    setSelectedStores([]);
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleStore = (store: string) => {
    setSelectedStores(prev => 
      prev.includes(store) 
        ? prev.filter(s => s !== store)
        : [...prev, store]
    );
  };

  const formatRupiah = (value: string) => {
    const number = parseInt(value.replace(/[^0-9]/g, ''));
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(number);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('description', formData.description);
      form.append('category', formData.category);
      form.append('value', formData.value);
      form.append('store', user.user_name);
      form.append('ket', formData.ket);
      form.append('transfer', formData.transfer.toString());
      
      if (formData.file) {
        form.append('file', formData.file);
      }

      const response = await fetch("/api/petty-cash", {
        method: "POST",
        body: form,
      });

      if (response.ok) {
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
        fetchData();
      } else {
        showMessage("Failed to add entry", "error");
      }
    } catch (error) {
      showMessage("Failed to add entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      "Date": item.date,
      "Description": toTitleCase(item.description),
      "Category": item.category,
      "Value": item.value,
      "Store": item.store,
      "Ket": item.ket,
      "Transfer": item.transfer === 'TRUE' ? 'Yes' : 'No',
      "Link": item.link_url || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Petty Cash");
    XLSX.writeFile(wb, "petty_cash.xlsx");
  };

  const toTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
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
        const a = document.createElement('a');
        a.href = url;
        a.download = `Petty_Cash_${user.user_name}_${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
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

  const totalValue = filteredData.reduce((sum, item) => {
    return sum + parseInt(item.value.replace(/[^0-9]/g, ''));
  }, 0);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary">Petty Cash</h1>
            {user.petty_cash_add && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-primary/90"
              >
                Add Petty Cash
              </button>
            )}
          </div>

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
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category
                </label>
                <div className="relative">
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
              </div>
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Store
                </label>
                <div className="relative">
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
              </div>
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
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Ket</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Transfer</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{item.date}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.category}</td>
                          <td className="px-3 py-2">{item.value}</td>
                          <td className="px-3 py-2">{item.store}</td>
                          <td className="px-3 py-2">{item.ket || "-"}</td>
                          <td className="px-3 py-2">
                            {item.transfer === 'TRUE' ? '✓' : '-'}
                          </td>
                          <td className="px-3 py-2">
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
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={3} className="px-3 py-2 text-right">Total:</td>
                        <td className="px-3 py-2">{formatRupiah(totalValue.toString())}</td>
                        <td colSpan={4}></td>
                      </tr>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">Add Petty Cash Entry</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description*
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
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
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({...formData, value: val ? formatRupiah(val) : ''});
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
                    onChange={(e) => setFormData({...formData, ket: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="flex items-center text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.transfer}
                      onChange={(e) => setFormData({...formData, transfer: e.target.checked})}
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
                    onChange={(e) => setFormData({...formData, file: e.target.files?.[0] || null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {formData.file && (
                    <p className="text-xs text-gray-500 mt-1">Selected: {formData.file.name}</p>
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

      <Popup 
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}