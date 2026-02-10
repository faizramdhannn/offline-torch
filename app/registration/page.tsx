"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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
  const [permissions, setPermissions] = useState({
    dashboard: false,
    order_report: false,
    stock: false,
    registration_request: false,
    user_setting: false,
    petty_cash: false,
    petty_cash_add: false,
    petty_cash_export: false,
    petty_cash_balance: false,
    order_report_import: false,
    order_report_export: false,
    customer: false,
    voucher: false,
    bundling: false,
    canvasing: false,
    canvasing_export: false,
    stock_opname: false,
    // Stock permissions
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

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.registration_request) {
      router.push("/dashboard");
      return;
    }
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
      const filteredData = result.filter((req: RegistrationRequest) => req.status !== "approved");
      setData(filteredData);
    } catch (error) {
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: RegistrationRequest) => {
    setSelectedRequest(request);
    setPermissions({
      dashboard: true,
      order_report: false,
      stock: false,
      registration_request: false,
      user_setting: false,
      petty_cash: false,
      petty_cash_add: false,
      petty_cash_export: false,
      petty_cash_balance: false,
      order_report_import: false,
      order_report_export: false,
      customer: false,
      voucher: false,
      bundling: false,
      canvasing: false,
      canvasing_export: false,
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

  const CheckboxItem = ({ label, permKey }: { label: string; permKey: keyof typeof permissions }) => (
    <label className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
      <input
        type="checkbox"
        checked={permissions[permKey]}
        onChange={(e) => setPermissions({ ...permissions, [permKey]: e.target.checked })}
        className="mr-2"
      />
      {label}
    </label>
  );

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Registration Requests</h1>

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
                    {data.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{item.id}</td>
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2">{item.user_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${item.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{item.request_at}</td>
                        <td className="px-3 py-2">
                          {item.status === "pending" && (
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(item)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Approve</button>
                              <button onClick={() => handleReject(item.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length === 0 && <div className="p-8 text-center text-gray-500">No pending requests</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 my-8">
            <h2 className="text-lg font-bold text-primary mb-4">Set User Permissions</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1"><strong>Name:</strong> {selectedRequest.name}</p>
              <p className="text-sm text-gray-600"><strong>Username:</strong> {selectedRequest.user_name}</p>
            </div>

            <div className="space-y-1 mb-6 max-h-[60vh] overflow-y-auto pr-1">
              <CheckboxItem label="Dashboard" permKey="dashboard" />

              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1 px-2">Order Report</p>
                <div className="ml-2">
                  <CheckboxItem label="View Order Report" permKey="order_report" />
                  <CheckboxItem label="Import Data" permKey="order_report_import" />
                  <CheckboxItem label="Export Data" permKey="order_report_export" />
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1 px-2">Stock</p>
                <div className="ml-2">
                  <CheckboxItem label="View Stock" permKey="stock" />
                  <CheckboxItem label="Import Stock" permKey="stock_import" />
                  <CheckboxItem label="Export Stock" permKey="stock_export" />
                  <CheckboxItem label="View Store" permKey="stock_view_store" />
                  <CheckboxItem label="View PCA" permKey="stock_view_pca" />
                  <CheckboxItem label="View Master" permKey="stock_view_master" />
                  <CheckboxItem label="View HPP" permKey="stock_view_hpp" />
                  <CheckboxItem label="View HPT" permKey="stock_view_hpt" />
                  <CheckboxItem label="View HPJ" permKey="stock_view_hpj" />
                  <CheckboxItem label="Refresh Javelin" permKey="stock_refresh_javelin" />
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1 px-2">Petty Cash</p>
                <div className="ml-2">
                  <CheckboxItem label="View Petty Cash" permKey="petty_cash" />
                  <CheckboxItem label="Add Entry" permKey="petty_cash_add" />
                  <CheckboxItem label="Export Data" permKey="petty_cash_export" />
                  <CheckboxItem label="View Balance" permKey="petty_cash_balance" />
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1 px-2">Canvasing</p>
                <div className="ml-2">
                  <CheckboxItem label="View Canvasing" permKey="canvasing" />
                  <CheckboxItem label="Export Canvasing" permKey="canvasing_export" />
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <CheckboxItem label="Customer" permKey="customer" />
                <CheckboxItem label="Voucher" permKey="voucher" />
                <CheckboxItem label="Bundling" permKey="bundling" />
                <CheckboxItem label="Stock Opname" permKey="stock_opname" />
                <CheckboxItem label="Registration Request" permKey="registration_request" />
                <CheckboxItem label="User Settings" permKey="user_setting" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowApprovalModal(false); setSelectedRequest(null); }} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Cancel</button>
              <button onClick={submitApproval} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90">Approve</button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}