"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import { Customer } from "@/types";

const ACTION_OPTIONS = [
  "Terkirim",
  "Tidak ada Respon",
  "Merespon Membeli",
  "Merespon Tidak Membeli"
];

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
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Followup form data
  const [followupAction, setFollowupAction] = useState("");
  const [followupResult, setFollowupResult] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
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

  const openFollowupModal = (customer: Customer, rowIndex: number) => {
    setSelectedCustomer(customer);
    setSelectedRowIndex(rowIndex);
    setFollowupAction("");
    setFollowupResult(customer.followup || "");
    setSelectedFile(null);
    setShowFollowupModal(true);
  };

  const closeFollowupModal = () => {
    setShowFollowupModal(false);
    setSelectedCustomer(null);
    setSelectedRowIndex(null);
    setFollowupAction("");
    setFollowupResult("");
    setSelectedFile(null);
  };

  const handleFollowupSubmit = async () => {
    if (!selectedCustomer || selectedRowIndex === null) return;
    
    if (!followupAction && !followupResult && !selectedFile) {
      showMessage("Please fill in at least one field", "error");
      return;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('storeName', isOwner ? storeName : selectedCustomer.location_store);
      formData.append('phoneNumber', selectedCustomer.phone_number);
      formData.append('username', user.user_name);
      
      // Combine action and result into followup text
      let followupText = "";
      if (followupAction) {
        followupText = `Action: ${followupAction}`;
      }
      if (followupResult) {
        followupText += (followupText ? "\n" : "") + `Result: ${followupResult}`;
      }
      formData.append('followupText', followupText);
      
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      
      formData.append('rowIndex', (selectedRowIndex + 2).toString()); // +2 for header and 0-based index

      const response = await fetch('/api/customer', {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
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
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-24">Phone</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-32">Customer Name</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-28">Store</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20">Total Value</th>
                        <th className="px-2 py-2 text-center font-semibold text-gray-700 w-16">Total Order</th>
                        {!isOwner && (
                          <th className="px-2 py-2 text-center font-semibold text-gray-700 w-20">Average</th>
                        )}
                        <th className="px-2 py-2 text-center font-semibold text-gray-700">Followup</th>
                        {!isOwner && (
                          <>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 w-24">Update By</th>
                            <th className="px-2 py-2 text-center font-semibold text-gray-700 w-28">Update At</th>
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
                            <td className="px-2 text-center py-2">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs">{customer.phone_number}</span>
                                <button
                                  onClick={() => copyToClipboard(customer.phone_number)}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Copy phone number"
                                >
                                  📋
                                </button>
                              </div>
                            </td>
                            <td className="px-2 text-center py-2 text-xs">{customer.customer_name}</td>
                            <td className="px-2 text-center py-2 text-xs">{customer.location_store}</td>
                            <td className="px-2 text-center py-2 text-xs">{customer.total_value}</td>
                            <td className="px-2 text-center py-2 text-xs">{customer.total_order}</td>
                            {!isOwner && (
                              <td className="px-2 text-center py-2 text-xs">{customer.average_value}</td>
                            )}
                            <td className="px-2 py-2">
                              <div className="flex flex-col items-center gap-1">
                                {/* Display current followup */}
                                {customer.followup && customer.followup.trim() !== '' && (
                                  <div className="text-xs text-gray-700 text-center whitespace-pre-wrap max-w-xs">
                                    {customer.followup}
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-1">
                                  {hasFollowup && (
                                    <a 
                                      href={customer.link_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs"
                                    >
                                      View Photo
                                    </a>
                                  )}
                                  
                                  {isOwner && (
                                    <button
                                      onClick={() => openFollowupModal(customer, actualIndex)}
                                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                      {hasFollowup ? 'Edit' : 'Add'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            {!isOwner && (
                              <>
                                <td className="px-2 text-center py-2 text-xs">{customer.update_by || '-'}</td>
                                <td className="px-2 text-center py-2 text-xs">{customer.update_at || '-'}</td>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={followupAction}
                  onChange={(e) => setFollowupAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select action...</option>
                  {ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result
                </label>
                <textarea
                  value={followupResult}
                  onChange={(e) => setFollowupResult(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={4}
                  placeholder="Enter result or notes..."
                />
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