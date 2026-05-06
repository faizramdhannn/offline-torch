"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";
import { RegistrationRequest } from "@/types";

export default function RegistrationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [activeFilter, setActiveFilter] = useState<"pending" | "all">("pending");
  const [permissions, setPermissions] = useState({
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
  });
  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.registration_request) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, []);

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

  const fetchData = async () => {
    try {
      const response = await fetch("/api/registration");
      const result = await response.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const displayedData = activeFilter === "pending"
    ? data.filter(r => r.status === "pending")
    : data;

  const handleApprove = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setPermissions({
      dashboard: true,
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
    });
    setShowApprovalModal(true);
  };

  const handleReject = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menolak registrasi ini?")) return;
    try {
      const response = await fetch("/api/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      if (response.ok) {
        await logActivity("PUT", `Rejected registration request ID: ${id}`);
        showMessage("Registrasi ditolak", "success");
        fetchData();
      } else {
        showMessage("Gagal menolak registrasi", "error");
      }
    } catch (error) {
      showMessage("Gagal menolak registrasi", "error");
    }
  };

  const submitApproval = async () => {
    if (!selectedRequest) return;
    try {
      const response = await fetch("/api/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRequest.id, status: "approved", permissions }),
      });
      if (response.ok) {
        await logActivity("PUT", `Approved registration: ${selectedRequest.user_name} (${selectedRequest.name})`);
        showMessage("Registrasi disetujui", "success");
        setShowApprovalModal(false);
        setSelectedRequest(null);
        fetchData();
      } else {
        showMessage("Gagal menyetujui registrasi", "error");
      }
    } catch (error) {
      showMessage("Gagal menyetujui registrasi", "error");
    }
  };

  type PermKey = keyof typeof permissions;

  const CB = ({ label, k, sub }: { label: string; k: PermKey; sub?: boolean }) => (
    <label className={`flex items-center cursor-pointer hover:bg-gray-50 rounded ${sub ? "ml-5 text-xs py-0.5 px-1" : "text-sm p-2"}`}>
      <input
        type="checkbox"
        checked={permissions[k]}
        onChange={e => setPermissions({ ...permissions, [k]: e.target.checked })}
        className="mr-2 flex-shrink-0"
      />
      {label}
    </label>
  );

  const statusBadge = (status: string) => {
    if (status === "pending") return "bg-yellow-100 text-yellow-800";
    if (status === "approved") return "bg-green-100 text-green-800";
    if (status === "rejected") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const pendingCount = data.filter(r => r.status === "pending").length;

  if (!user) return null;

return (
  <div className="flex-1 overflow-auto">
    <div className="p-6">

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Registration Requests</h1>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setActiveFilter("pending")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeFilter === "pending" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Pending {pendingCount > 0 && <span className="ml-1 bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendingCount}</span>}
              </button>
              <button onClick={() => setActiveFilter("all")}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeFilter === "all" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Semua ({data.length})
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Username</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Request Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedData.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{item.id}</td>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2">{item.user_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{item.request_at}</td>
                        <td className="px-3 py-2">
                          {item.status === "pending" && (
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(item)}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                Approve
                              </button>
                              <button onClick={() => handleReject(item.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                                Reject
                              </button>
                            </div>
                          )}
                          {item.status !== "pending" && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayedData.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    {activeFilter === "pending" ? "Tidak ada permintaan pending" : "Tidak ada data registrasi"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-6">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-3">Set User Permissions</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded flex gap-6">
              <p className="text-sm text-gray-600"><strong>Name:</strong> {selectedRequest.name}</p>
              <p className="text-sm text-gray-600"><strong>Username:</strong> {selectedRequest.user_name}</p>
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
                <CB label="Traffic Store" k="traffic_store" />
                <CB label="Report Store" k="report_store" />

                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2 mt-4">Shipment</h3>
                <CB label="Request Shipment" k="request_tracking" />
                <CB label="Upload Resi" k="tracking_edit" sub />
              </div>

              {/* Column 2: Stock */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b pb-1.5 mb-2">Stock</h3>
                <CB label="View Stock" k="stock" />
                <CB label="Stock Opname" k="stock_opname" />

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

            <div className="flex gap-2">
              <button onClick={() => { setShowApprovalModal(false); setSelectedRequest(null); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">
                Cancel
              </button>
              <button onClick={submitApproval}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">
                Approve & Set Permissions
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