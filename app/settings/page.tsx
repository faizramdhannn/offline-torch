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
  bundling: string;
  canvasing: string;
  stock_opname: string;
  stock_import: string;
  stock_export: string;
  stock_view_store: string;
  stock_view_pca: string;
  stock_view_master: string;
  stock_view_hpp: string;
  stock_view_hpt: string;
  stock_view_hpj: string;
  stock_refresh_javelin: string;
}

interface JavelinStatus {
  hasCookies: boolean;
  hasCredentials: boolean;
  username: string;
  lastCookieUpdate: string;
  lastCredentialsUpdate: string;
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
    bundling: false,
    canvasing: false,
    stock_opname: false,
    stock_import: false,
    stock_export: false,
    stock_view_store: false,
    stock_view_pca: false,
    stock_view_master: false,
    stock_view_hpp: false,
    stock_view_hpt: false,
    stock_view_hpj: false,
    stock_refresh_javelin: false,
  });

  // Javelin Configuration
  const [showJavelinModal, setShowJavelinModal] = useState(false);
  const [javelinStatus, setJavelinStatus] = useState<JavelinStatus>({
    hasCookies: false,
    hasCredentials: false,
    username: "",
    lastCookieUpdate: "",
    lastCredentialsUpdate: "",
  });
  const [javelinUsername, setJavelinUsername] = useState("");
  const [javelinPassword, setJavelinPassword] = useState("");
  const [manualCookie, setManualCookie] = useState("");
  const [savingJavelin, setSavingJavelin] = useState(false);
  const [loadingJavelin, setLoadingJavelin] = useState(false);

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
    fetchJavelinStatus();
  }, [router]);

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

  const fetchJavelinStatus = async () => {
    try {
      setLoadingJavelin(true);
      const response = await fetch("/api/javelin-login");
      if (!response.ok) throw new Error("Failed to fetch Javelin status");
      const result = await response.json();
      if (result.success) {
        setJavelinStatus(result);
        setJavelinUsername(result.username || "");
      }
    } catch (error) {
      console.error("Failed to fetch Javelin status:", error);
    } finally {
      setLoadingJavelin(false);
    }
  };

  const handleSaveJavelin = async () => {
    if (!manualCookie.trim()) {
      showMessage("Please enter a cookie value", "error");
      return;
    }

    setSavingJavelin(true);
    try {
      const cookieResponse = await fetch("/api/javelin-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie: manualCookie.trim(),
          username: user.user_name,
        }),
      });

      if (!cookieResponse.ok) {
        showMessage("Failed to save cookie", "error");
        return;
      }

      if (javelinUsername.trim() && javelinPassword.trim()) {
        const credResponse = await fetch("/api/javelin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: javelinUsername.trim(),
            password: javelinPassword.trim(),
            updatedBy: user.user_name,
          }),
        });

        if (credResponse.ok) {
          await logActivity(
            "PUT",
            "Updated Javelin configuration (cookie + credentials)",
          );
          showMessage(
            "Cookie and credentials saved! Auto-refresh enabled.",
            "success",
          );
        } else {
          await logActivity("PUT", "Updated Javelin cookie configuration");
          showMessage(
            "Cookie saved! (Credentials not saved - optional)",
            "success",
          );
        }
      } else {
        showMessage("Cookie saved successfully!", "success");
      }

      setShowJavelinModal(false);
      setManualCookie("");
      setJavelinPassword("");
      fetchJavelinStatus();
    } catch (error) {
      showMessage("Failed to save Javelin configuration", "error");
    } finally {
      setSavingJavelin(false);
    }
  };

  const handleEditUser = (userData: UserData) => {
    setSelectedUser(userData);
    setPermissions({
      dashboard: userData.dashboard === "TRUE",
      order_report: userData.order_report === "TRUE",
      stock: userData.stock === "TRUE",
      registration_request: userData.registration_request === "TRUE",
      user_setting: userData.user_setting === "TRUE",
      petty_cash: userData.petty_cash === "TRUE",
      petty_cash_add: userData.petty_cash_add === "TRUE",
      petty_cash_export: userData.petty_cash_export === "TRUE",
      order_report_import: userData.order_report_import === "TRUE",
      order_report_export: userData.order_report_export === "TRUE",
      customer: userData.customer === "TRUE",
      voucher: userData.voucher === "TRUE",
      bundling: userData.bundling === "TRUE",
      canvasing: userData.canvasing === "TRUE",
      stock_opname: userData.stock_opname === "TRUE",
      stock_import: userData.stock_import === "TRUE",
      stock_export: userData.stock_export === "TRUE",
      stock_view_store: userData.stock_view_store === "TRUE",
      stock_view_pca: userData.stock_view_pca === "TRUE",
      stock_view_master: userData.stock_view_master === "TRUE",
      stock_view_hpp: userData.stock_view_hpp === "TRUE",
      stock_view_hpt: userData.stock_view_hpt === "TRUE",
      stock_view_hpj: userData.stock_view_hpj === "TRUE",
      stock_refresh_javelin: userData.stock_refresh_javelin === "TRUE",
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
        await logActivity(
          "PUT",
          `Updated permissions for user: ${selectedUser.user_name}`,
        );
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

  const getActivePermissions = (userData: UserData) => {
    const perms = [];
    if (userData.dashboard === "TRUE") perms.push("Dashboard");
    if (userData.order_report === "TRUE") perms.push("Order Report");
    if (userData.stock === "TRUE") perms.push("Stock");
    if (userData.petty_cash === "TRUE") perms.push("Petty Cash");
    if (userData.customer === "TRUE") perms.push("Customer");
    if (userData.voucher === "TRUE") perms.push("Voucher");
    if (userData.bundling === "TRUE") perms.push("Bundling");
    if (userData.canvasing === "TRUE") perms.push("Canvasing");
    if (userData.stock_opname === "TRUE") perms.push("Stock Opname");
    if (userData.registration_request === "TRUE") perms.push("Registration");
    if (userData.user_setting === "TRUE") perms.push("Settings");
    return perms;
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Settings</h1>

          {/* Javelin Configuration */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Javelin Configuration
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure cookie for Javelin data refresh
                  </p>
                </div>
                <button
                  onClick={() => setShowJavelinModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  {javelinStatus.hasCookies ? "Update" : "Configure"}
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingJavelin ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Cookie Status
                        </span>
                        {javelinStatus.hasCookies ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            Configured
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                            Not Set
                          </span>
                        )}
                      </div>
                      {javelinStatus.lastCookieUpdate && (
                        <div className="text-xs text-gray-500 mt-1">
                          Updated: {javelinStatus.lastCookieUpdate}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Auto-Refresh
                        </span>
                        {javelinStatus.hasCredentials ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            ✓ Enabled
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                            Optional
                          </span>
                        )}
                      </div>
                      {javelinStatus.hasCredentials && (
                        <div className="text-xs text-gray-600 mt-1">
                          Username: {javelinStatus.username}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                User Management
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage user permissions and access control
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Active Modules
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userData, index) => {
                      const activePermissions = getActivePermissions(userData);

                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {userData.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {userData.user_name}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {activePermissions.length > 0 ? (
                                activePermissions.map((perm, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                                  >
                                    {perm}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  No permissions
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditUser(userData)}
                              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                            >
                              Edit Permissions
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Javelin Configuration Modal */}
      {showJavelinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cookie Value
                </label>
                <textarea
                  value={manualCookie}
                  onChange={(e) => setManualCookie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  rows={6}
                />
              </div>

              <div className="border-t pt-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={javelinUsername}
                      onChange={(e) => setJavelinUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Leave empty to skip auto-refresh"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={javelinPassword}
                      onChange={(e) => setJavelinPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Leave empty to skip auto-refresh"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowJavelinModal(false);
                    setManualCookie("");
                    setJavelinPassword("");
                  }}
                  disabled={savingJavelin}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveJavelin}
                  disabled={savingJavelin || !manualCookie.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingJavelin ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">
              Edit User Permissions
            </h2>

            <div className="mb-4 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                <strong className="text-gray-800">User:</strong>{" "}
                {selectedUser.name}
              </p>
              <p className="text-sm text-gray-600">
                <strong className="text-gray-800">Username:</strong>{" "}
                {selectedUser.user_name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Left Column - Basic Modules */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 border-b pb-2">
                  Basic Modules
                </h3>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.dashboard}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        dashboard: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Dashboard</span>
                </label>

                {/* Order Report */}
                <div className="border-l-2 border-blue-300 pl-3">
                  <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded font-medium">
                    <input
                      type="checkbox"
                      checked={permissions.order_report}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          order_report: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Order Report</span>
                  </label>

                  <div className="ml-6 mt-1 space-y-1">
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.order_report_import}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            order_report_import: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Import Data
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.order_report_export}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            order_report_export: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Export Data
                    </label>
                  </div>
                </div>

                {/* Petty Cash */}
                <div className="border-l-2 border-green-300 pl-3">
                  <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded font-medium">
                    <input
                      type="checkbox"
                      checked={permissions.petty_cash}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          petty_cash: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Petty Cash</span>
                  </label>

                  <div className="ml-6 mt-1 space-y-1">
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.petty_cash_add}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            petty_cash_add: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Add Entry
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.petty_cash_export}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            petty_cash_export: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Export Data
                    </label>
                  </div>
                </div>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.customer}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        customer: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Customer</span>
                </label>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.voucher}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        voucher: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Voucher</span>
                </label>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.bundling}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        bundling: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Bundling</span>
                </label>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.canvasing}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        canvasing: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Canvasing</span>
                </label>

                <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={permissions.stock_opname}
                    onChange={(e) =>
                      setPermissions({
                        ...permissions,
                        stock_opname: e.target.checked,
                      })
                    }
                    className="mr-2"
                  />
                  <span>Stock Opname</span>
                </label>
              </div>

              {/* Right Column - Stock & Admin */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 border-b pb-2">
                  Stock Management
                </h3>

                {/* Stock */}
                <div className="border-l-2 border-purple-300 pl-3">
                  <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded font-medium">
                    <input
                      type="checkbox"
                      checked={permissions.stock}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          stock: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Stock</span>
                  </label>

                  <div className="ml-6 mt-2 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">
                      Actions:
                    </p>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_import}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_import: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Import Data
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_export}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_export: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Export Data
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_refresh_javelin}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_refresh_javelin: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      Refresh Javelin
                    </label>

                    <p className="text-xs font-semibold text-gray-600 mt-3">
                      View Tabs:
                    </p>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_store}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_store: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View Store Tab
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_pca}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_pca: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View PCA Tab
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_master}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_master: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View Master Tab
                    </label>

                    <p className="text-xs font-semibold text-gray-600 mt-3">
                      Price Columns:
                    </p>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_hpp}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_hpp: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View HPP
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_hpt}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_hpt: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View HPT
                    </label>
                    <label className="flex items-center text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={permissions.stock_view_hpj}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            stock_view_hpj: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      View HPJ
                    </label>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    Admin Access
                  </h3>

                  <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={permissions.registration_request}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          registration_request: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span>Registration Requests</span>
                  </label>

                  <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={permissions.user_setting}
                      onChange={(e) =>
                        setPermissions({
                          ...permissions,
                          user_setting: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <span>User Settings</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Changes will take effect on user's next
                login or page refresh.
              </p>
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