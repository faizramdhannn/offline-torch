"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

interface UserData {
  id: string;
  name: string;
  user_name: string;
  dashboard: string;
  order_report: string;
  stock: string;
  registration_request: string;
  user_setting: string;
  petty_cash: string;
  petty_cash_add: string;
  petty_cash_export: string;
  order_report_import: string;
  order_report_export: string;
  customer: string;
  voucher: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState({
    dashboard: false,
    order_report: false,
    stock: false,
    registration_request: false,
    user_setting: false,
    petty_cash: false,
    petty_cash_add: false,
    petty_cash_export: false,
    order_report_import: false,
    order_report_export: false,
    customer: false,
    voucher: false,
  });

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.user_setting) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchUsers();
  }, []);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const result = await response.json();
      setUsers(result);
    } catch (error) {
      showMessage("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userData: UserData) => {
    setSelectedUser(userData);
    setPermissions({
      dashboard: userData.dashboard === 'TRUE',
      order_report: userData.order_report === 'TRUE',
      stock: userData.stock === 'TRUE',
      registration_request: userData.registration_request === 'TRUE',
      user_setting: userData.user_setting === 'TRUE',
      petty_cash: userData.petty_cash === 'TRUE',
      petty_cash_add: userData.petty_cash_add === 'TRUE',
      petty_cash_export: userData.petty_cash_export === 'TRUE',
      order_report_import: userData.order_report_import === 'TRUE',
      order_report_export: userData.order_report_export === 'TRUE',
      customer: userData.customer === 'TRUE',
      voucher: userData.voucher === 'TRUE',
    });
    setShowEditModal(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          permissions,
        }),
      });

      if (response.ok) {
        showMessage("User permissions updated successfully", "success");
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        showMessage("Failed to update user permissions", "error");
      }
    } catch (error) {
      showMessage("Failed to update user permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">User Settings</h1>
          
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Username</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Permissions</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userData, index) => {
                      const activePermissions = [
                        userData.dashboard === 'TRUE' && 'Dashboard',
                        userData.order_report === 'TRUE' && 'Order Report',
                        userData.stock === 'TRUE' && 'Stock',
                        userData.petty_cash === 'TRUE' && 'Petty Cash',
                        userData.customer === 'TRUE' && 'Customer',
                        userData.voucher === 'TRUE' && 'Voucher',
                        userData.registration_request === 'TRUE' && 'Registration',
                        userData.user_setting === 'TRUE' && 'Settings',
                      ].filter(Boolean);

                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{userData.id}</td>
                          <td className="px-4 py-3">{userData.name}</td>
                          <td className="px-4 py-3">{userData.user_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {activePermissions.map((perm, i) => (
                                <span 
                                  key={i}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleEditUser(userData)}
                              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No users found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">Edit User Permissions</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Name:</strong> {selectedUser.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Username:</strong> {selectedUser.user_name}
              </p>
            </div>

            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.dashboard}
                  onChange={(e) => setPermissions({...permissions, dashboard: e.target.checked})}
                  className="mr-2"
                />
                Dashboard
              </label>
              
              <div className="border-t pt-2">
                <p className="text-xs font-semibold text-gray-700 mb-2">Order Report</p>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.order_report}
                    onChange={(e) => setPermissions({...permissions, order_report: e.target.checked})}
                    className="mr-2"
                  />
                  View Order Report
                </label>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.order_report_import}
                    onChange={(e) => setPermissions({...permissions, order_report_import: e.target.checked})}
                    className="mr-2"
                  />
                  Import Data
                </label>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.order_report_export}
                    onChange={(e) => setPermissions({...permissions, order_report_export: e.target.checked})}
                    className="mr-2"
                  />
                  Export Data
                </label>
              </div>

              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.stock}
                  onChange={(e) => setPermissions({...permissions, stock: e.target.checked})}
                  className="mr-2"
                />
                Stock
              </label>

              <div className="border-t pt-2">
                <p className="text-xs font-semibold text-gray-700 mb-2">Petty Cash</p>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.petty_cash}
                    onChange={(e) => setPermissions({...permissions, petty_cash: e.target.checked})}
                    className="mr-2"
                  />
                  View Petty Cash
                </label>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.petty_cash_add}
                    onChange={(e) => setPermissions({...permissions, petty_cash_add: e.target.checked})}
                    className="mr-2"
                  />
                  Add Entry
                </label>
                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded ml-4">
                  <input
                    type="checkbox"
                    checked={permissions.petty_cash_export}
                    onChange={(e) => setPermissions({...permissions, petty_cash_export: e.target.checked})}
                    className="mr-2"
                  />
                  Export Data
                </label>
              </div>

              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.customer}
                  onChange={(e) => setPermissions({...permissions, customer: e.target.checked})}
                  className="mr-2"
                />
                Customer
              </label>

              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.voucher}
                  onChange={(e) => setPermissions({...permissions, voucher: e.target.checked})}
                  className="mr-2"
                />
                Voucher
              </label>

              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.registration_request}
                  onChange={(e) => setPermissions({...permissions, registration_request: e.target.checked})}
                  className="mr-2"
                />
                Registration Request
              </label>
              
              <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={permissions.user_setting}
                  onChange={(e) => setPermissions({...permissions, user_setting: e.target.checked})}
                  className="mr-2"
                />
                User Settings
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
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