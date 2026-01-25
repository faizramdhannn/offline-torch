"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import { Customer } from "@/types";

export default function CustomerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<Customer[]>([]);
  const [filteredData, setFilteredData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [uploadingRow, setUploadingRow] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [followupText, setFollowupText] = useState<{[key: number]: string}>({});
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  
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
    if (!parsedUser.customer) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedStores, data]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async (username: string) => {
    try {
      const response = await fetch(`/api/customer?username=${username}`);
      const result = await response.json();
      setIsOwner(result.isOwner);
      setStoreName(result.storeName || "");
      setData(result.data);
      setFilteredData(result.data);
      
      // Extract unique stores for filter
      if (!result.isOwner) {
        const uniqueStores = [...new Set(result.data.map((item: Customer) => item.location_store))].filter(Boolean);
        setStores(uniqueStores as string[]);
      }
    } catch (error) {
      showMessage("Failed to fetch customer data", "error");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...data];

    // Filter by store (only for non-owners)
    if (!isOwner && selectedStores.length > 0) {
      filtered = filtered.filter((item) => selectedStores.includes(item.location_store));
    }

    // Search by phone number or customer name
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => 
        item.phone_number.toLowerCase().includes(query) ||
        item.customer_name.toLowerCase().includes(query)
      );
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStores([]);
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleStore = (store: string) => {
    setSelectedStores(prev => 
      prev.includes(store) 
        ? prev.filter(s => s !== store)
        : [...prev, store]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showMessage("Copied to clipboard!", "success");
  };

  const handleFileUpload = async (rowIndex: number, customer: Customer) => {
    if (!selectedFile && !followupText[rowIndex]) {
      showMessage("Please select a file or enter followup text", "error");
      return;
    }

    setUploadingRow(rowIndex);
    
    try {
      const formData = new FormData();
      formData.append('storeName', isOwner ? storeName : customer.location_store);
      formData.append('phoneNumber', customer.phone_number);
      formData.append('username', user.user_name);
      formData.append('followupText', followupText[rowIndex] || customer.followup || '');
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      
      formData.append('rowIndex', (rowIndex + 2).toString()); // +2 for header and 0-based index

      const response = await fetch('/api/customer', {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        showMessage("Followup updated successfully", "success");
        setSelectedFile(null);
        setEditingRow(null);
        setFollowupText(prev => {
          const updated = {...prev};
          delete updated[rowIndex];
          return updated;
        });
        fetchData(user.user_name);
      } else {
        showMessage("Failed to update followup", "error");
      }
    } catch (error) {
      showMessage("Failed to update followup", "error");
    } finally {
      setUploadingRow(null);
    }
  };

  // Pagination
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
          <h1 className="text-2xl font-bold text-primary mb-6">
            {isOwner ? `${storeName} - Customer Data` : "All Customers"}
          </h1>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              {!isOwner && (
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
              )}

              <div className={isOwner ? "col-span-3" : "col-span-2"}>
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
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset Filters
              </button>
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
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Phone</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Store</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Total Value</th>
                        {!isOwner && (
                          <>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Average</th>
                          </>
                        )}
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Followup</th>
                        {!isOwner && (
                          <>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Update By</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Update At</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((customer, index) => {
                        const actualIndex = indexOfFirstItem + index;
                        const hasFollowup = customer.link_url && customer.link_url.trim() !== '';
                        return (
                          <tr 
                            key={actualIndex} 
                            className={`border-b hover:bg-gray-50 ${hasFollowup ? 'bg-green-50' : ''}`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span>{customer.phone_number}</span>
                                <button
                                  onClick={() => copyToClipboard(customer.phone_number)}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Copy phone number"
                                >
                                  📋
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">{customer.customer_name}</td>
                            <td className="px-3 py-2">{customer.location_store}</td>
                            <td className="px-3 py-2">{customer.total_value}</td>
                            {!isOwner && (
                              <>
                                <td className="px-3 py-2">{customer.average_value}</td>
                              </>
                            )}
                            <td className="px-3 py-2">
                              <div className="space-y-2">
                                {/* Display current followup text if exists */}
                                {customer.followup && customer.followup.trim() !== '' && editingRow !== actualIndex && (
                                  <div className="text-xs text-gray-700 mb-1">
                                    {customer.followup}
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                  {hasFollowup ? (
                                    <>
                                      <a 
                                        href={customer.link_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-xs"
                                      >
                                        View Photo
                                      </a>
                                      {isOwner && (
                                        <button
                                          onClick={() => {
                                            setEditingRow(editingRow === actualIndex ? null : actualIndex);
                                            if (editingRow !== actualIndex) {
                                              setFollowupText(prev => ({...prev, [actualIndex]: customer.followup || ''}));
                                            }
                                          }}
                                          className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                        >
                                          {editingRow === actualIndex ? 'Cancel' : 'Edit'}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    isOwner && (
                                      <button
                                        onClick={() => {
                                          setEditingRow(editingRow === actualIndex ? null : actualIndex);
                                          if (editingRow !== actualIndex) {
                                            setFollowupText(prev => ({...prev, [actualIndex]: customer.followup || ''}));
                                          }
                                        }}
                                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                      >
                                        {editingRow === actualIndex ? 'Cancel' : 'Add Followup'}
                                      </button>
                                    )
                                  )}
                                </div>
                                
                                {/* Edit/Upload form */}
                                {isOwner && editingRow === actualIndex && (
                                  <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Followup Notes
                                      </label>
                                      <textarea
                                        value={followupText[actualIndex] || ''}
                                        onChange={(e) => setFollowupText(prev => ({...prev, [actualIndex]: e.target.value}))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        rows={2}
                                        placeholder="Enter followup notes..."
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Upload Photo (Optional)
                                      </label>
                                      <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="text-xs w-full"
                                      />
                                      {selectedFile && (
                                        <p className="text-xs text-green-600 mt-1">
                                          ✓ {selectedFile.name}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <button
                                      onClick={() => handleFileUpload(actualIndex, customer)}
                                      disabled={uploadingRow === actualIndex}
                                      className="text-xs px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 w-full"
                                    >
                                      {uploadingRow === actualIndex ? 'Saving...' : 'Save Followup'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            {!isOwner && (
                              <>
                                <td className="px-3 py-2">{customer.update_by || '-'}</td>
                                <td className="px-3 py-2">{customer.update_at || '-'}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
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

      <Popup 
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}