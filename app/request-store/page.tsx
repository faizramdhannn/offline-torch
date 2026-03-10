"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";

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
  sales_order?: string;
  delivery_note?: string;
  sales_invoice?: string;
  image_url?: string;
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

  const itemsPerPage = 10;

  // File refs
  const addFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    requester: "",
    assigned_to: "",
    reason_request: "",
    notes: "",
    sales_order: "",
    delivery_note: "",
    sales_invoice: "",
  });

  const [editForm, setEditForm] = useState({
    date: "",
    requester: "",
    assigned_to: "",
    reason_request: "",
    notes: "",
    status: "Pending",
    sales_order: "",
    delivery_note: "",
    sales_invoice: "",
    image_url: "",
  });

  // ─── Auth & init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchDropdowns();
  }, []);

  // ─── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch("/api/request-store");
        if (res.ok && isMounted) {
          setData(await res.json());
          setLoading(false);
        }
      } catch {}
    };

    fetchData();
    const interval = setInterval(fetchData, 20_000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [user]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
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
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity }),
      });
    } catch {}
  };

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
    } catch {}
  };

  // ─── Extract Google Drive file ID from URL ────────────────────────────────
  const getDriveFileId = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  // ─── Status Change ────────────────────────────────────────────────────────
  const handleStatusChange = async (item: RequestItem, newStatus: string) => {
    setUpdatingStatus(item.id);
    try {
      const res = await fetch("/api/request-store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: newStatus, update_by: user.user_name }),
      });

      if (res.ok) {
        setData((prev) => prev.map((d) => d.id === item.id ? { ...d, status: newStatus } : d));
        if (newStatus === "Completed") {
          await sendPushNotification({
            requesterUsername: item.created_by,
            title: "✅ Request Selesai",
            body: `Request "${item.reason_request}" sudah diselesaikan oleh ${user.user_name}`,
          });
        }
        await logActivity("PUT", `Status request ID: ${item.id} → ${newStatus}`);
      } else {
        showMessage("Gagal update status", "error");
      }
    } catch {
      showMessage("Gagal update status", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ─── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.date || !form.requester || !form.assigned_to || !form.reason_request) {
      showMessage("Please fill all required fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("date", form.date);
      fd.append("requester", form.requester);
      fd.append("assigned_to", form.assigned_to);
      fd.append("reason_request", form.reason_request);
      fd.append("notes", form.notes);
      fd.append("created_by", user.user_name);
      fd.append("sales_order", form.sales_order);
      fd.append("delivery_note", form.delivery_note);
      fd.append("sales_invoice", form.sales_invoice);
      if (addImageFile) fd.append("image", addImageFile);

      const res = await fetch("/api/request-store", { method: "POST", body: fd });

      if (res.ok) {
        await sendPushNotification({
          assignedTo: form.assigned_to,
          title: "📋 Request Baru Untukmu",
          body: `${form.requester}: ${form.reason_request}`,
        });
        showMessage("Request berhasil dibuat", "success");
        setShowAddModal(false);
        resetAddForm();
        await logActivity("POST", `Created request: ${form.reason_request} → ${form.assigned_to}`);
        const fresh = await fetch("/api/request-store");
        if (fresh.ok) setData(await fresh.json());
      } else {
        showMessage("Gagal membuat request", "error");
      }
    } catch {
      showMessage("Gagal membuat request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setForm({ date: new Date().toISOString().split("T")[0], requester: "", assigned_to: "", reason_request: "", notes: "", sales_order: "", delivery_note: "", sales_invoice: "" });
    setAddImageFile(null);
    if (addFileRef.current) addFileRef.current.value = "";
  };

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("id", selectedItem.id);
      fd.append("date", editForm.date);
      fd.append("requester", editForm.requester);
      fd.append("assigned_to", editForm.assigned_to);
      fd.append("reason_request", editForm.reason_request);
      fd.append("notes", editForm.notes);
      fd.append("status", editForm.status);
      fd.append("update_by", user.user_name);
      fd.append("sales_order", editForm.sales_order);
      fd.append("delivery_note", editForm.delivery_note);
      fd.append("sales_invoice", editForm.sales_invoice);
      fd.append("image_url", editForm.image_url);
      if (editImageFile) fd.append("image", editImageFile);

      const res = await fetch("/api/request-store", { method: "PUT", body: fd });

      if (res.ok) {
        const result = await res.json();

        if (editForm.status === "Completed" && selectedItem.status !== "Completed") {
          await sendPushNotification({
            requesterUsername: selectedItem.created_by,
            title: "✅ Request Selesai",
            body: `Request "${selectedItem.reason_request}" sudah diselesaikan`,
          });
        }
        if (editForm.assigned_to !== selectedItem.assigned_to && editForm.status === "Pending") {
          await sendPushNotification({
            assignedTo: editForm.assigned_to,
            title: "📋 Request Ditugaskan ke Kamu",
            body: `${editForm.requester}: ${editForm.reason_request}`,
          });
        }

        showMessage("Request berhasil diupdate", "success");
        setShowEditModal(false);
        setSelectedItem(null);
        setEditImageFile(null);
        if (editFileRef.current) editFileRef.current.value = "";
        await logActivity("PUT", `Updated request ID: ${selectedItem.id}`);
        const fresh = await fetch("/api/request-store");
        if (fresh.ok) setData(await fresh.json());
      } else {
        showMessage("Gagal update request", "error");
      }
    } catch {
      showMessage("Gagal update request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (item: RequestItem) => {
    if (!confirm("Cancel dan hapus request ini?")) return;
    try {
      const res = await fetch(`/api/request-store?id=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((d) => d.id !== item.id));
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
      sales_order: item.sales_order || "",
      delivery_note: item.delivery_note || "",
      sales_invoice: item.sales_invoice || "",
      image_url: item.image_url || "",
    });
    setEditImageFile(null);
    setShowEditModal(true);
  };

  // ─── Pagination ───────────────────────────────────────────────────────────
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = data.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  if (!user) return null;
  const canEdit = user.edit_request;

  // ─── Shared form fields ───────────────────────────────────────────────────
  const renderDocFields = (
    vals: { sales_order: string; delivery_note: string; sales_invoice: string },
    setter: (k: string, v: string) => void
  ) => (
    <div className="grid grid-cols-3 gap-2">
      {[
        { key: "sales_order", label: "Sales Order" },
        { key: "delivery_note", label: "Delivery Note" },
        { key: "sales_invoice", label: "Sales Invoice" },
      ].map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <input
            type="text"
            value={(vals as any)[key]}
            onChange={(e) => setter(key, e.target.value)}
            placeholder={`e.g. ${key === "sales_order" ? "#464140" : key === "delivery_note" ? "MP-DN-2026-..." : "MP-SINV-..."}`}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ))}
    </div>
  );

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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Request
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Requester</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Assigned To</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Reason</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">SO</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">DN</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">SI</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Notes</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 w-12">Foto</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-32">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{item.date}</td>
                          <td className="px-3 py-2 text-gray-700">{item.requester}</td>
                          <td className="px-3 py-2 text-gray-700">{item.assigned_to}</td>
                          <td className="px-3 py-2 text-gray-700">{item.reason_request}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{item.sales_order || "-"}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{item.delivery_note || "-"}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">{item.sales_invoice || "-"}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate" title={item.notes}>
                            {item.notes || "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.image_url ? (
                              <a
                                href={item.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                                title="Lihat foto"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canEdit ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => item.status !== "Pending" && handleStatusChange(item, "Pending")}
                                  disabled={updatingStatus === item.id || item.status === "Pending"}
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                                    item.status === "Pending"
                                      ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-400 cursor-default"
                                      : "bg-gray-100 text-gray-400 hover:bg-yellow-50 hover:text-yellow-700 cursor-pointer"
                                  }`}
                                >
                                  Pending
                                </button>
                                <button
                                  onClick={() => item.status !== "Completed" && handleStatusChange(item, "Completed")}
                                  disabled={updatingStatus === item.id || item.status === "Completed"}
                                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                                    item.status === "Completed"
                                      ? "bg-green-100 text-green-800 ring-1 ring-green-400 cursor-default"
                                      : "bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-700 cursor-pointer"
                                  }`}
                                >
                                  {updatingStatus === item.id ? "..." : "Completed"}
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
                              {item.created_by === user.user_name && item.status === "Pending" && (
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
                    <div className="p-8 text-center text-gray-500">No requests found</div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirst + 1} to {Math.min(indexOfLast, data.length)} of {data.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                          return (
                            <button key={page} onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}>
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2 text-xs">...</span>;
                        }
                        return null;
                      })}
                      <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Add New Request</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Requester <span className="text-red-500">*</span></label>
                <select value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Requester</option>
                  {dropdownData.requesters.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To <span className="text-red-500">*</span></label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Assignee</option>
                  {dropdownData.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason Request <span className="text-red-500">*</span></label>
                <select value={form.reason_request} onChange={(e) => setForm({ ...form, reason_request: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Reason</option>
                  {dropdownData.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {/* Doc fields */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Dokumen Referensi</label>
                {renderDocFields(
                  { sales_order: form.sales_order, delivery_note: form.delivery_note, sales_invoice: form.sales_invoice },
                  (k, v) => setForm((prev) => ({ ...prev, [k]: v }))
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Foto</label>
                <input
                  ref={addFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAddImageFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                {addImageFile && (
                  <p className="text-[10px] text-green-600 mt-1">✓ {addImageFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Cancel</button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-primary mb-4">Edit Request</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Requester</label>
                <select value={editForm.requester} onChange={(e) => setEditForm({ ...editForm, requester: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Requester</option>
                  {dropdownData.requesters.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                <select value={editForm.assigned_to} onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Assignee</option>
                  {dropdownData.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reason Request</label>
                <select value={editForm.reason_request} onChange={(e) => setEditForm({ ...editForm, reason_request: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select Reason</option>
                  {dropdownData.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {/* Doc fields */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Dokumen Referensi</label>
                {renderDocFields(
                  { sales_order: editForm.sales_order, delivery_note: editForm.delivery_note, sales_invoice: editForm.sales_invoice },
                  (k, v) => setEditForm((prev) => ({ ...prev, [k]: v }))
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Foto</label>
                {editForm.image_url && !editImageFile && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded border">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <a href={editForm.image_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate flex-1">
                      Lihat foto saat ini →
                    </a>
                  </div>
                )}
                <input
                  ref={editFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                {editImageFile && (
                  <p className="text-[10px] text-green-600 mt-1">✓ Foto baru: {editImageFile.name}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Upload foto baru untuk mengganti foto lama.</p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowEditModal(false); setSelectedItem(null); setEditImageFile(null); if (editFileRef.current) editFileRef.current.value = ""; }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Cancel</button>
              <button onClick={handleEdit} disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}