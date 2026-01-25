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
    } catch (error) {
      showMessage("Failed to fetch customer data", "error");
    } finally {
      setLoading(false);
    }
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

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">
            {isOwner ? `${storeName} - Customer Data` : "All Customers"}
          </h1>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
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
                    {data.map((customer, index) => {
                      const hasFollowup = customer.link_url && customer.link_url.trim() !== '';
                      return (
                        <tr 
                          key={index} 
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
                              {customer.followup && customer.followup.trim() !== '' && editingRow !== index && (
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
                                          setEditingRow(editingRow === index ? null : index);
                                          if (editingRow !== index) {
                                            setFollowupText(prev => ({...prev, [index]: customer.followup || ''}));
                                          }
                                        }}
                                        className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                      >
                                        {editingRow === index ? 'Cancel' : 'Edit'}
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  isOwner && (
                                    <button
                                      onClick={() => {
                                        setEditingRow(editingRow === index ? null : index);
                                        if (editingRow !== index) {
                                          setFollowupText(prev => ({...prev, [index]: customer.followup || ''}));
                                        }
                                      }}
                                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                      {editingRow === index ? 'Cancel' : 'Add Followup'}
                                    </button>
                                  )
                                )}
                              </div>
                              
                              {/* Edit/Upload form */}
                              {isOwner && editingRow === index && (
                                <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Followup Notes
                                    </label>
                                    <textarea
                                      value={followupText[index] || ''}
                                      onChange={(e) => setFollowupText(prev => ({...prev, [index]: e.target.value}))}
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
                                    onClick={() => handleFileUpload(index, customer)}
                                    disabled={uploadingRow === index}
                                    className="text-xs px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 w-full"
                                  >
                                    {uploadingRow === index ? 'Saving...' : 'Save Followup'}
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
                {data.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No data available</div>
                )}
              </div>
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