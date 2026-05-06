"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  petty_cash_balance: string;
  order_report_import: string;
  order_report_export: string;
  customer: string;
  voucher: string;
  bundling: string;
  canvasing: string;
  canvasing_export: string;
  request: string;
  edit_request: string;
  analytics_order: string;
  stock_opname: string;
  stock_opname_report: string;
  stock_import: string;
  stock_export: string;
  stock_view_store: string;
  stock_view_pca: string;
  stock_view_master: string;
  stock_view_hpp: string;
  stock_view_hpt: string;
  stock_view_hpj: string;
  stock_refresh_javelin: string;
  traffic_store: string;
  report_store: string;
  request_tracking: string;
  tracking_edit: string;
  last_activity: string;
}

interface JavelinStatus {
  hasCookies: boolean;
  hasCredentials: boolean;
  username: string;
  lastCookieUpdate: string;
  lastCredentialsUpdate: string;
}

const EMPTY_PERMS = {
  dashboard: false,
  order_report: false,
  order_report_import: false,
  order_report_export: false,
  stock: false,
  stock_import: false,
  stock_export: false,
  stock_view_store: false,
  stock_view_pca: false,
  stock_view_master: false,
  stock_view_hpp: false,
  stock_view_hpt: false,
  stock_view_hpj: false,
  stock_refresh_javelin: false,
  stock_opname: false,
  stock_opname_report: false,
  petty_cash: false,
  petty_cash_add: false,
  petty_cash_export: false,
  petty_cash_balance: false,
  customer: false,
  voucher: false,
  bundling: false,
  canvasing: false,
  canvasing_export: false,
  request: false,
  edit_request: false,
  analytics_order: false,
  traffic_store: false,
  report_store: false,
  request_tracking: false,
  tracking_edit: false,
  registration_request: false,
  user_setting: false,
};

type Perms = typeof EMPTY_PERMS;

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
  const [permissions, setPermissions] = useState<Perms>({ ...EMPTY_PERMS });
  const [searchQuery, setSearchQuery] = useState("");
  useSessionGuard();

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
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.user_setting) { router.push("/dashboard"); return; }
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
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
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
        body: JSON.stringify({ cookie: manualCookie.trim(), username: user.user_name }),
      });
      if (!cookieResponse.ok) { showMessage("Failed to save cookie", "error"); return; }

      if (javelinUsername.trim() && javelinPassword.trim()) {
        const credResponse = await fetch("/api/javelin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: javelinUsername.trim(), password: javelinPassword.trim(), updatedBy: user.user_name }),
        });
        if (credResponse.ok) {
          await logActivity("PUT", "Updated Javelin configuration (cookie + credentials)");
          showMessage("Cookie and credentials saved! Auto-refresh enabled.", "success");
        } else {
          await logActivity("PUT", "Updated Javelin cookie configuration");
          showMessage("Cookie saved! (Credentials not saved - optional)", "success");
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
    const p: Perms = {
      dashboard: userData.dashboard === "TRUE",
      order_report: userData.order_report === "TRUE",
      order_report_import: userData.order_report_import === "TRUE",
      order_report_export: userData.order_report_export === "TRUE",
      stock: userData.stock === "TRUE",
      stock_import: userData.stock_import === "TRUE",
      stock_export: userData.stock_export === "TRUE",
      stock_view_store: userData.stock_view_store === "TRUE",
      stock_view_pca: userData.stock_view_pca === "TRUE",
      stock_view_master: userData.stock_view_master === "TRUE",
      stock_view_hpp: userData.stock_view_hpp === "TRUE",
      stock_view_hpt: userData.stock_view_hpt === "TRUE",
      stock_view_hpj: userData.stock_view_hpj === "TRUE",
      stock_refresh_javelin: userData.stock_refresh_javelin === "TRUE",
      stock_opname: userData.stock_opname === "TRUE",
      stock_opname_report: userData.stock_opname_report === "TRUE",
      petty_cash: userData.petty_cash === "TRUE",
      petty_cash_add: userData.petty_cash_add === "TRUE",
      petty_cash_export: userData.petty_cash_export === "TRUE",
      petty_cash_balance: userData.petty_cash_balance === "TRUE",
      customer: userData.customer === "TRUE",
      voucher: userData.voucher === "TRUE",
      bundling: userData.bundling === "TRUE",
      canvasing: userData.canvasing === "TRUE",
      canvasing_export: userData.canvasing_export === "TRUE",
      request: userData.request === "TRUE",
      edit_request: userData.edit_request === "TRUE",
      analytics_order: userData.analytics_order === "TRUE",
      traffic_store: userData.traffic_store === "TRUE",
      report_store: userData.report_store === "TRUE",
      request_tracking: userData.request_tracking === "TRUE",
      tracking_edit: userData.tracking_edit === "TRUE",
      registration_request: userData.registration_request === "TRUE",
      user_setting: userData.user_setting === "TRUE",
    };
    setPermissions(p);
    setShowEditModal(true);
  };

  const setPerm = (key: keyof Perms, val: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: val }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUser.id, permissions }),
      });
      if (response.ok) {
        await logActivity("PUT", `Updated permissions for user: ${selectedUser.user_name}`);
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
    const perms: string[] = [];
    if (userData.dashboard === "TRUE") perms.push("Dashboard");
    if (userData.order_report === "TRUE") perms.push("Order Report");
    if (userData.analytics_order === "TRUE") perms.push("Analytics");
    if (userData.stock === "TRUE") perms.push("Stock");
    if (userData.stock_opname === "TRUE") perms.push("STO");
    if (userData.petty_cash === "TRUE") perms.push("Petty Cash");
    if (userData.customer === "TRUE") perms.push("Customer");
    if (userData.voucher === "TRUE") perms.push("Voucher");
    if (userData.bundling === "TRUE") perms.push("Bundling");
    if (userData.canvasing === "TRUE") perms.push("Canvasing");
    if (userData.request === "TRUE") perms.push("Request");
    if (userData.request_tracking === "TRUE") perms.push("Shipment");
    if (userData.traffic_store === "TRUE") perms.push("Traffic");
    if (userData.report_store === "TRUE") perms.push("Report");
    if (userData.registration_request === "TRUE") perms.push("Registration");
    if (userData.user_setting === "TRUE") perms.push("Settings");
    return perms;
  };

  const CB = ({ label, k, sub }: { label: string; k: keyof Perms; sub?: boolean }) => (
    <label className={`flex items-center text-sm cursor-pointer hover:bg-gray-50 rounded ${sub ? "ml-5 text-xs py-0.5 px-1" : "p-2"}`}>
      <input
        type="checkbox"
        checked={permissions[k]}
        onChange={e => setPerm(k, e.target.checked)}
        className="mr-2 flex-shrink-0"
      />
      {label}
    </label>
  );

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

return (
  <div className="flex-1 overflow-auto">
    <div className="p-6">

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Settings</h1>

          {/* Javelin Configuration */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Javelin Configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure cookie for Javelin data refresh</p>
                </div>
                <button onClick={() => setShowJavelinModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  {javelinStatus.hasCookies ? "Update" : "Configure"}
                </button>
              </div>
            </div>
            <div className="p-6">
              {loadingJavelin ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Cookie Status</span>
                      {javelinStatus.hasCookies
                        ? <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Configured</span>
                        : <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Not Set</span>}
                    </div>
                    {javelinStatus.lastCookieUpdate && (
                      <div className="text-xs text-gray-500 mt-1">Updated: {javelinStatus.lastCookieUpdate}</div>
                    )}
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Auto-Refresh</span>
                      {javelinStatus.hasCredentials
                        ? <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">✓ Enabled</span>
                        : <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Optional</span>}
                    </div>
                    {javelinStatus.hasCredentials && (
                      <div className="text-xs text-gray-600 mt-1">Username: {javelinStatus.username}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">User Management</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage user permissions and access control</p>
                </div>
                <input
                  type="text"
                  placeholder="Cari nama / username..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary w-52"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Username</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Active Modules</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Last Activity</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((userData, index) => {
                      const activePermissions = getActivePermissions(userData);
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{userData.name}</td>
                          <td className="px-4 py-3 text-gray-600">{userData.user_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {activePermissions.length > 0 ? (
                                activePermissions.map((perm, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{perm}</span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400 italic">No permissions</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{userData.last_activity || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleEditUser(userData)}
                              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90">
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery ? "Tidak ada user yang cocok" : "No users found"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Javelin Modal */}
      {showJavelinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Javelin Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cookie Value</label>
                <textarea
                  value={manualCookie}
                  onChange={e => setManualCookie(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  rows={6}
                  placeholder="Paste cookie value here..."
                />
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs text-gray-500 font-medium">Auto-refresh credentials (optional)</p>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Username</label>
                  <input type="text" value={javelinUsername} onChange={e => setJavelinUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty to skip auto-refresh" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Password</label>
                  <input type="password" value={javelinPassword} onChange={e => setJavelinPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Leave empty to skip auto-refresh" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowJavelinModal(false); setManualCookie(""); setJavelinPassword(""); }}
                  disabled={savingJavelin}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSaveJavelin} disabled={savingJavelin || !manualCookie.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                  {savingJavelin ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-3">Edit User Permissions</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded flex gap-6">
              <p className="text-sm text-gray-600"><strong>Name:</strong> {selectedUser.name}</p>
              <p className="text-sm text-gray-600"><strong>Username:</strong> {selectedUser.user_name}</p>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-5">
              {/* Column 1: General */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2">General</h3>
                <CB label="Dashboard" k="dashboard" />
                <CB label="Analytics Order" k="analytics_order" />
                <CB label="Customer" k="customer" />
                <CB label="Voucher" k="voucher" />
                <CB label="Bundling" k="bundling" />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Order Report</h3>
                <CB label="View Order Report" k="order_report" />
                <CB label="Import Data" k="order_report_import" sub />
                <CB label="Export Data" k="order_report_export" sub />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Request & Traffic</h3>
                <CB label="Request Store" k="request" />
                <CB label="Edit Request" k="edit_request" sub />
                <CB label="Request Shipment" k="request_tracking" />
                <CB label="Upload Resi" k="tracking_edit" sub />
                <CB label="Traffic Store" k="traffic_store" />
                <CB label="Report Store" k="report_store" />
              </div>

              {/* Column 2: Stock */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2">Stock</h3>
                <CB label="View Stock" k="stock" />

                <p className="text-[10px] font-semibold text-gray-400 uppercase mt-3 mb-1 ml-1">Actions</p>
                <CB label="Import Stock" k="stock_import" sub />
                <CB label="Export Stock" k="stock_export" sub />
                <CB label="Refresh Javelin" k="stock_refresh_javelin" sub />

                <p className="text-[10px] font-semibold text-gray-400 uppercase mt-3 mb-1 ml-1">View Tabs</p>
                <CB label="View Store Tab" k="stock_view_store" sub />
                <CB label="View PCA Tab" k="stock_view_pca" sub />
                <CB label="View Master Tab" k="stock_view_master" sub />

                <p className="text-[10px] font-semibold text-gray-400 uppercase mt-3 mb-1 ml-1">Price Columns</p>
                <CB label="View HPP" k="stock_view_hpp" sub />
                <CB label="View HPT" k="stock_view_hpt" sub />
                <CB label="View HPJ" k="stock_view_hpj" sub />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Stock Opname</h3>
                <CB label="Stock Opname" k="stock_opname" />
                <CB label="Lihat Semua Report STO" k="stock_opname_report" sub />
              </div>

              {/* Column 3: Petty Cash, Canvasing, Admin */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2">Petty Cash</h3>
                <CB label="View Petty Cash" k="petty_cash" />
                <CB label="Add Entry" k="petty_cash_add" sub />
                <CB label="Export Data" k="petty_cash_export" sub />
                <CB label="View Balance" k="petty_cash_balance" sub />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Canvasing</h3>
                <CB label="View Canvasing" k="canvasing" />
                <CB label="Export Canvasing" k="canvasing_export" sub />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Admin</h3>
                <CB label="Registration Request" k="registration_request" />
                <CB label="User Settings" k="user_setting" />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Changes will take effect on user's next login or page refresh.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSavePermissions} disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  </div>
  );
}