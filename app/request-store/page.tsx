"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BPRJgdT0HHzl7GeptF_hhQ4JncvHV2AzNfdihGrDrd3FEvjIZK_T-t7_1Ggib3UTMA9OYuVyrdnx6X7xWmveLZY";

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
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
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // SSE + notification tracking
  const knownStatusRef = useRef<Map<string, string>>(new Map()); // id → status
  const sseRef = useRef<EventSource | null>(null);

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
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  // Start SSE after user is set
  useEffect(() => {
    if (!user) return;
    startSSE(user);
    return () => {
      sseRef.current?.close();
    };
  }, [user]);

  const startSSE = (currentUser: any) => {
    if (sseRef.current) sseRef.current.close();

    const es = new EventSource(
      `/api/request-store-sse?username=${currentUser.user_name}`
    );
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "init" || msg.type === "update") {
          const newData: RequestItem[] = msg.data;

          if (msg.type === "init") {
            // Seed known statuses — no notification on first load
            newData.forEach((item) => {
              knownStatusRef.current.set(item.id, item.status);
            });
          } else {
            // update — check for new items or status changes
            newData.forEach((item) => {
              const prevStatus = knownStatusRef.current.get(item.id);

              if (prevStatus === undefined) {
                // Brand new item — notify assignee
                if (
                  item.assigned_to === currentUser.user_name &&
                  item.status === "Pending"
                ) {
                  triggerLocalNotification(
                    "📋 Request Baru Untukmu",
                    `${item.requester}: ${item.reason_request}`
                  );
                }
              } else if (prevStatus !== item.status) {
                // Status changed — notify the original requester (created_by)
                if (
                  item.status === "Completed" &&
                  item.created_by === currentUser.user_name
                ) {
                  triggerLocalNotification(
                    "✅ Request Selesai",
                    `Request "${item.reason_request}" sudah diselesaikan`
                  );
                }
              }

              knownStatusRef.current.set(item.id, item.status);
            });
          }

          setData(newData);
          setLoading(false);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => startSSE(currentUser), 5000);
    };
  };

  const triggerLocalNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo_offline_torch.png",
        tag: `request-${Date.now()}`,
      });
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted" && user) {
      await registerPush(user.user_name);
    }
  };

  const registerPush = async (username: string) => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, subscription: sub.toJSON() }),
      });
    } catch (err) {
      console.error("Push registration failed:", err);
    }
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
   * Send push notification via server.
   * assignedTo  → notified when new request is created
   * requesterUsername → notified when status changes to Completed
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

        // Notify the requester (created_by) when status becomes Completed
        if (newStatus === "Completed") {
          await sendPushNotification({
            requesterUsername: item.created_by,
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
        // Notify the assignee about the new request
        await sendPushNotification({
          assignedTo: form.assigned_to,
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
        // If editor changed status to Completed via edit modal, notify requester
        if (
          editForm.status === "Completed" &&
          selectedItem.status !== "Completed"
        ) {
          await sendPushNotification({
            requesterUsername: selectedItem.created_by,
            title: "✅ Request Selesai",
            body: `Request "${selectedItem.reason_request}" sudah diselesaikan`,
          });
        }

        // If assigned_to changed, notify new assignee
        if (
          editForm.assigned_to !== selectedItem.assigned_to &&
          editForm.status === "Pending"
        ) {
          await sendPushNotification({
            assignedTo: editForm.assigned_to,
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
              {typeof window !== "undefined" &&
                "Notification" in window &&
                notifPermission !== "granted" && (
                  <button
                    onClick={requestNotificationPermission}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded text-xs hover:bg-yellow-100"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    Enable Notifications
                  </button>
                )}
              {notifPermission === "granted" && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notifications On
                </span>
              )}
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