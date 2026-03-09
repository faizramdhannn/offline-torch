"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

// ─── FIX: Hapus VAPID_PUBLIC_KEY dan semua push/SSE logic dari page ini ──────
// Push subscription & SSE sekarang HANYA dihandle oleh NotificationListener
// yang di-mount via Sidebar. Duplikasi dulu menyebabkan:
// 1. Race condition: dua komponen saling overwrite token di sheet
// 2. Double SSE connection per user
// 3. VAPID key berbeda antara file ini dan NotificationListener
// ─────────────────────────────────────────────────────────────────────────────

interface RequestItem {
  id: string;
  date: string;
  requester: string;
  assigned_to: string;
  reason_request: string;
  notes: string;
  status: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface DropdownData {
  requesters: string[];
  assignees: string[];
  reasons: string[];
}

export default function RequestStorePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<RequestItem[]>([]);
  const [dropdownData, setDropdownData] = useState<DropdownData>({
    requesters: [],
    assignees: [],
    reasons: [],
  });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [currentPage, setCurrentPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // ─── SSE untuk real-time update data tabel ───────────────────────────────
  // Notifikasi (lokal & push) sudah dihandle NotificationListener di Sidebar.
  // SSE di sini HANYA untuk update data tabel, tidak trigger notif.
  const sseRef = useRef<EventSource | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const itemsPerPage = 10;

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    requester: "",
    assigned_to: "",
    reason_request: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    date: "",
    requester: "",
    assigned_to: "",
    reason_request: "",
    notes: "",
    status: "Pending",
  });

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    fetchDropdowns();
    // ─── FIX: Hapus registerPushForUser() dari sini ───────────────────────
    // Dulu: if (perm === "granted") { registerPushForUser(parsedUser.user_name) }
    // Sekarang: NotificationListener yang handle, tidak perlu di sini
    // ─────────────────────────────────────────────────────────────────────
  }, []);

  // Start SSE setelah user diset — HANYA untuk update data tabel
  useEffect(() => {
    if (!user) return;
    startSSE();
    return () => {
      sseRef.current?.close();
    };
  }, [user]);

  const startSSE = () => {
    if (sseRef.current) sseRef.current.close();

    // SSE tidak perlu kirim username karena tidak dipakai untuk filter notif
    const es = new EventSource("/api/request-store-sse");
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "init" || msg.type === "update") {
          // Hanya update data tabel, TIDAK ada logika notifikasi di sini
          setData(msg.data);
          setLoading(false);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => startSSE(), 5000);
    };
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/master-dropdown");
      if (res.ok) setDropdownData(await res.json());
    } catch {}
  };

  const logActivity = async (method: string, activity: string) => {
    if (!user) return;
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
    } catch {}
  };

  /**
   * Kirim push notification via server.
   * assignedTo      → notif saat request baru dibuat (pakai user_name)
   * requesterUsername → notif saat status → Completed (pakai user_name / created_by)
   */
  const sendPushNotification = async (params: {
    assignedTo?: string;
    requesterUsername?: string;
    title: string;
    body: string;
  }) => {
    try {
      await fetch("/api/push-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    } catch {
      // non-fatal
    }
  };

  const handleStatusChange = async (item: RequestItem, newStatus: string) => {
    setUpdatingStatus(item.id);
    try {
      const res = await fetch("/api/request-store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status: newStatus,
          update_by: user.user_name,
        }),
      });

      if (res.ok) {
        setData((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, status: newStatus } : d))
        );

        // Notify requester (created_by = user_name) saat Completed
        if (newStatus === "Completed") {
          await sendPushNotification({
            requesterUsername: item.created_by, // ini user_name, cocok dengan subscription key
            title: "✅ Request Selesai",
            body: `Request "${item.reason_request}" sudah diselesaikan oleh ${user.user_name}`,
          });
        }

        await logActivity(
          "PUT",
          `Status request ID: ${item.id} → ${newStatus}`
        );
      } else {
        showMessage("Gagal update status", "error");
      }
    } catch {
      showMessage("Gagal update status", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleAdd = async () => {
    if (
      !form.date ||
      !form.requester ||
      !form.assigned_to ||
      !form.reason_request
    ) {
      showMessage("Please fill all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, created_by: user.user_name }),
      });

      if (res.ok) {
        // Notify assignee — form.assigned_to berisi user_name (dari master_dropdown)
        await sendPushNotification({
          assignedTo: form.assigned_to, // user_name, cocok dengan subscription key
          title: "📋 Request Baru Untukmu",
          body: `${form.requester}: ${form.reason_request}`,
        });

        showMessage("Request berhasil dibuat", "success");
        setShowAddModal(false);
        setForm({
          date: new Date().toISOString().split("T")[0],
          requester: "",
          assigned_to: "",
          reason_request: "",
          notes: "",
        });
        await logActivity(
          "POST",
          `Created request: ${form.reason_request} → ${form.assigned_to}`
        );
      } else {
        showMessage("Gagal membuat request", "error");
      }
    } catch {
      showMessage("Gagal membuat request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/request-store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.id,
          ...editForm,
          update_by: user.user_name,
        }),
      });

      if (res.ok) {
        // Status berubah ke Completed via edit modal → notify requester
        if (
          editForm.status === "Completed" &&
          selectedItem.status !== "Completed"
        ) {
          await sendPushNotification({
            requesterUsername: selectedItem.created_by, // user_name
            title: "✅ Request Selesai",
            body: `Request "${selectedItem.reason_request}" sudah diselesaikan`,
          });
        }

        // assigned_to berubah → notify assignee baru
        if (
          editForm.assigned_to !== selectedItem.assigned_to &&
          editForm.status === "Pending"
        ) {
          await sendPushNotification({
            assignedTo: editForm.assigned_to, // user_name
            title: "📋 Request Ditugaskan ke Kamu",
            body: `${editForm.requester}: ${editForm.reason_request}`,
          });
        }

        showMessage("Request berhasil diupdate", "success");
        setShowEditModal(false);
        setSelectedItem(null);
        await logActivity("PUT", `Updated request ID: ${selectedItem.id}`);
      } else {
        showMessage("Gagal update request", "error");
      }
    } catch {
      showMessage("Gagal update request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: RequestItem) => {
    if (!confirm("Cancel dan hapus request ini?")) return;
    try {
      const res = await fetch(`/api/request-store?id=${item.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showMessage("Request dihapus", "success");
        await logActivity("DELETE", `Deleted request ID: ${item.id}`);
      } else {
        showMessage("Gagal menghapus request", "error");
      }
    } catch {
      showMessage("Gagal menghapus request", "error");
    }
  };

  const openEdit = (item: RequestItem) => {
    setSelectedItem(item);
    setEditForm({
      date: item.date,
      requester: item.requester,
      assigned_to: item.assigned_to,
      reason_request: item.reason_request,
      notes: item.notes || "",
      status: item.status,
    });
    setShowEditModal(true);
  };

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = data.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  if (!user) return null;
  const canEdit = user.edit_request;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Request Store</h1>
            <div className="flex items-center gap-3">
              {user.request && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Request
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">
                          Requester
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">
                          Assigned To
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-40">
                          Reason
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">
                          Notes
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`border-b ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          } hover:bg-gray-100`}
                        >
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {item.requester}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {item.assigned_to}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {item.reason_request}
                          </td>
                          <td
                            className="px-3 py-2 text-gray-600 max-w-xs truncate"
                            title={item.notes}
                          >
                            {item.notes || "-"}
                          </td>
                          <td className="px-3 py-2">
                            {canEdit ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    item.status !== "Pending" &&
                                    handleStatusChange(item, "Pending")
                                  }
                                  disabled={
                                    updatingStatus === item.id ||
                                    item.status === "Pending"
                                  }
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                                    item.status === "Pending"
                                      ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-400 cursor-default"
                                      : "bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-700 cursor-pointer"
                                  }`}
                                >
                                  Pending
                                </button>
                                <button
                                  onClick={() =>
                                    item.status !== "Completed" &&
                                    handleStatusChange(item, "Completed")
                                  }
                                  disabled={
                                    updatingStatus === item.id ||
                                    item.status === "Completed"
                                  }
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                                    item.status === "Completed"
                                      ? "bg-green-100 text-green-800 ring-1 ring-green-400 cursor-default"
                                      : "bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-700 cursor-pointer"
                                  }`}
                                >
                                  {updatingStatus === item.id
                                    ? "..."
                                    : "Completed"}
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.status === "Completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {item.status}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {canEdit && (
                                <button
                                  onClick={() => openEdit(item)}
                                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                              )}
                              {item.created_by === user.user_name &&
                                item.status === "Pending" && (
                                  <button
                                    onClick={() => handleDelete(item)}
                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                  >
                                    Cancel
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No requests found
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirst + 1} to{" "}
                      {Math.min(indexOfLast, data.length)} of {data.length}{" "}
                      entries
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
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
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span key={page} className="px-2 text-xs">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-primary mb-4">
              Add New Request
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Requester <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.requester}
                  onChange={(e) =>
                    setForm({ ...form, requester: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Requester</option>
                  {dropdownData.requesters.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assigned To <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm({ ...form, assigned_to: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Assignee</option>
                  {dropdownData.assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason Request <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.reason_request}
                  onChange={(e) =>
                    setForm({ ...form, reason_request: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Reason</option>
                  {dropdownData.reasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes{" "}
                  <span className="text-gray-400">
                    (Sales Order, Delivery Note, Sales Invoice)
                  </span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="e.g. #464140, MP-DN-2026-40521, MP-SINV-2026-40150"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setForm({
                    date: new Date().toISOString().split("T")[0],
                    requester: "",
                    assigned_to: "",
                    reason_request: "",
                    notes: "",
                  });
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-lg font-bold text-primary mb-4">
              Edit Request
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Requester
                </label>
                <select
                  value={editForm.requester}
                  onChange={(e) =>
                    setEditForm({ ...editForm, requester: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Requester</option>
                  {dropdownData.requesters.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <select
                  value={editForm.assigned_to}
                  onChange={(e) =>
                    setEditForm({ ...editForm, assigned_to: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Assignee</option>
                  {dropdownData.assignees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason Request
                </label>
                <select
                  value={editForm.reason_request}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      reason_request: e.target.value,
                    })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Reason</option>
                  {dropdownData.reasons.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes{" "}
                  <span className="text-gray-400">
                    (Sales Order, Delivery Note, Sales Invoice)
                  </span>
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="e.g. #464140, MP-DN-2026-40521, MP-SINV-2026-40150"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedItem(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save"}
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