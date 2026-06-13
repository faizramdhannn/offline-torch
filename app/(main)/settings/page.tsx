"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";

// ─── Types ───────────────────────────────────────────────────────────────────
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
  attendance: string;
  attendance_report: string;
  invoice: string;
  invoice_create: string;
  invoice_edit: string;
  invoice_delete: string;
  invoice_master: string;
  sales_view: string;
  sales_view_all: string;
  attendance_store: string;
  attendance_store_all: string;
  material_issue: string;
  material_issue_all: string;
  asset_store: string;
  last_activity: string;
}

type PermKey = keyof Omit<UserData, "id" | "name" | "user_name" | "last_activity">;

interface JavelinStatus {
  hasCookies: boolean;
  hasCredentials: boolean;
  username: string;
  lastCookieUpdate: string;
  lastCredentialsUpdate: string;
}

// ─── Permission column definitions ────────────────────────────────────────────
// Each group = one <colgroup> with a border-left divider
const PERM_GROUPS: {
  label: string;
  color: string;          // header bg
  fields: { key: PermKey; label: string }[];
}[] = [
  {
    label: "General",
    color: "bg-slate-100",
    fields: [
      { key: "dashboard",      label: "Dashboard" },
      { key: "analytics_order",label: "Analytics" },
      { key: "customer",       label: "Customer" },
      { key: "voucher",        label: "Voucher" },
      { key: "bundling",       label: "Bundling" },
    ],
  },
  {
    label: "Order & Sales",
    color: "bg-blue-50",
    fields: [
      { key: "order_report",        label: "Order" },
      { key: "order_report_import", label: "Import" },
      { key: "order_report_export", label: "Export" },
      { key: "sales_view",          label: "Sales" },
      { key: "sales_view_all",      label: "Semua" },
    ],
  },
  {
    label: "Stock",
    color: "bg-violet-50",
    fields: [
      { key: "stock",                label: "View" },
      { key: "stock_import",         label: "Import" },
      { key: "stock_export",         label: "Export" },
      { key: "stock_refresh_javelin",label: "Javelin" },
      { key: "stock_view_store",     label: "Store" },
      { key: "stock_view_pca",       label: "PCA" },
      { key: "stock_view_master",    label: "Master" },
      { key: "stock_view_hpp",       label: "HPP" },
      { key: "stock_view_hpt",       label: "HPT" },
      { key: "stock_view_hpj",       label: "HPJ" },
      { key: "stock_opname",         label: "STO" },
      { key: "stock_opname_report",  label: "STO Rpt" },
    ],
  },
  {
    label: "Finance",
    color: "bg-emerald-50",
    fields: [
      { key: "petty_cash",         label: "Kas" },
      { key: "petty_cash_add",     label: "Add" },
      { key: "petty_cash_export",  label: "Export" },
      { key: "petty_cash_balance", label: "Saldo" },
      { key: "canvasing",          label: "Canvas" },
      { key: "canvasing_export",   label: "Exp." },
    ],
  },
  {
    label: "Request & Traffic",
    color: "bg-orange-50",
    fields: [
      { key: "request",          label: "Request" },
      { key: "edit_request",     label: "Edit" },
      { key: "request_tracking", label: "Shipment" },
      { key: "tracking_edit",    label: "Resi" },
      { key: "traffic_store",    label: "Traffic" },
      { key: "report_store",     label: "Report" },
    ],
  },
  {
    label: "Invoice & Ops",
    color: "bg-rose-50",
    fields: [
      { key: "invoice",          label: "Invoice" },
      { key: "invoice_create",   label: "Create" },
      { key: "invoice_edit",     label: "Edit" },
      { key: "invoice_delete",   label: "Delete" },
      { key: "invoice_master",   label: "Master" },
      { key: "material_issue",   label: "Material" },
      { key: "material_issue_all",label: "Mat All" },
      { key: "asset_store",      label: "Asset" },
    ],
  },
  {
    label: "HR & Hadir",
    color: "bg-teal-50",
    fields: [
      { key: "attendance",           label: "Hadir" },
      { key: "attendance_report",    label: "Laporan" },
      { key: "attendance_store",     label: "Store" },
      { key: "attendance_store_all", label: "Semua" },
    ],
  },
  {
    label: "Admin",
    color: "bg-gray-100",
    fields: [
      { key: "registration_request", label: "Reg." },
      { key: "user_setting",         label: "Setting" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isTrue = (v: string) => v === "TRUE";

// ─── Checkbox cell ────────────────────────────────────────────────────────────
function CB({
  checked,
  onChange,
  saving,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
}) {
  return (
    <td className="px-0 py-0 text-center align-middle border-r border-gray-200 last:border-r-0 w-[26px] min-w-[26px]">
      <label className="flex items-center justify-center h-full py-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          disabled={saving}
          onChange={(e) => onChange(e.target.checked)}
          className="w-3 h-3 rounded accent-primary cursor-pointer disabled:cursor-wait"
        />
      </label>
    </td>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<Record<PermKey, boolean>>>>({});
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  useSessionGuard();

  const itemsPerPage = 25;

  // Javelin
  const [showJavelinModal, setShowJavelinModal] = useState(false);
  const [javelinStatus, setJavelinStatus] = useState<JavelinStatus>({
    hasCookies: false, hasCredentials: false, username: "",
    lastCookieUpdate: "", lastCredentialsUpdate: "",
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
    setPopupMessage(message); setPopupType(type); setShowPopup(true);
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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      setUsers(await response.json());
    } catch { showMessage("Failed to fetch users", "error"); }
    finally { setLoading(false); }
  };

  const fetchJavelinStatus = async () => {
    try {
      setLoadingJavelin(true);
      const response = await fetch("/api/javelin-login");
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.success) { setJavelinStatus(result); setJavelinUsername(result.username || ""); }
    } catch {}
    finally { setLoadingJavelin(false); }
  };

  const handleSaveJavelin = async () => {
    if (!manualCookie.trim()) { showMessage("Please enter a cookie value", "error"); return; }
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
          await logActivity("PUT", "Updated Javelin configuration");
          showMessage("Cookie dan credentials disimpan!", "success");
        } else { showMessage("Cookie disimpan (credentials gagal)", "success"); }
      } else { showMessage("Cookie disimpan!", "success"); }
      setShowJavelinModal(false); setManualCookie(""); setJavelinPassword("");
      fetchJavelinStatus();
    } catch { showMessage("Gagal menyimpan konfigurasi Javelin", "error"); }
    finally { setSavingJavelin(false); }
  };

  // ── Inline permission toggle ───────────────────────────────────────────────
  const handleToggle = useCallback(
    (userId: string, userName: string, key: PermKey, newVal: boolean) => {
      // Optimistic UI update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, [key]: newVal ? "TRUE" : "FALSE" } : u
        )
      );
      setPendingChanges((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] || {}), [key]: newVal },
      }));
    },
    []
  );

  // Save pending changes for a single user
  const handleSaveUser = async (userId: string, userName: string) => {
    const changes = pendingChanges[userId];
    if (!changes || Object.keys(changes).length === 0) return;
    setSavingId(userId);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, permissions: changes }),
      });
      if (res.ok) {
        await logActivity("PUT", `Updated permissions for: ${userName}`);
        setPendingChanges((prev) => { const n = { ...prev }; delete n[userId]; return n; });
        showMessage(`Izin ${userName} diperbarui`, "success");
      } else { showMessage("Gagal menyimpan", "error"); }
    } catch { showMessage("Gagal menyimpan", "error"); }
    finally { setSavingId(null); }
  };

  // Discard pending changes for a user (revert optimistic)
  const handleDiscardUser = (userId: string) => {
    fetchUsers(); // re-fetch to revert
    setPendingChanges((prev) => { const n = { ...prev }; delete n[userId]; return n; });
  };

  // ── Filter & paginate ──────────────────────────────────────────────────────
  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const slice = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-5">
        <h1 className="text-xl font-bold text-primary mb-4">Settings</h1>

        {/* ── Javelin Card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 flex items-center justify-between px-4 py-2.5 gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700">Javelin Configuration</p>
            {loadingJavelin ? (
              <p className="text-[11px] text-gray-400">Loading...</p>
            ) : (
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="text-gray-400">Cookie:</span>
                  {javelinStatus.hasCookies ? (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                      ✓ Aktif{javelinStatus.lastCookieUpdate ? ` · ${javelinStatus.lastCookieUpdate}` : ""}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">Belum diset</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="text-gray-400">Auto-Refresh:</span>
                  {javelinStatus.hasCredentials ? (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                      ✓ {javelinStatus.username}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-medium">—</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowJavelinModal(true)}
            className="shrink-0 px-3 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            {javelinStatus.hasCookies ? "Update" : "Set Cookie"}
          </button>
        </div>

        {/* ── User Management ───────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
            <div>
              <p className="text-xs font-semibold text-gray-700">User Management</p>
              <p className="text-[11px] text-gray-400">Klik checkbox untuk mengubah akses · Simpan untuk menyimpan perubahan</p>
            </div>
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-6 pr-2 py-1 border border-gray-300 rounded text-[11px] w-40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ fontSize: "10px" }}>
                <thead>
                  {/* Row 1: Group labels */}
                  <tr className="border-b border-gray-300">
                    {/* Sticky identity columns */}
                    <th
                      className="sticky left-0 z-10 bg-white border-r-2 border-gray-300 px-2 py-1 text-left align-bottom whitespace-nowrap"
                      rowSpan={2}
                      style={{ minWidth: 120 }}
                    >
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Nama</span>
                    </th>
                    <th
                      className="sticky bg-white border-r-2 border-gray-300 px-2 py-1 text-left align-bottom whitespace-nowrap"
                      style={{ left: 120, zIndex: 10, minWidth: 90 }}
                      rowSpan={2}
                    >
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Username</span>
                    </th>

                    {/* Group headers */}
                    {PERM_GROUPS.map((g, gi) => (
                      <th
                        key={gi}
                        colSpan={g.fields.length}
                        className={`px-1 py-1 text-center border-l-2 border-gray-300 ${g.color}`}
                      >
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">
                          {g.label}
                        </span>
                      </th>
                    ))}

                    <th className="px-2 py-1 text-center align-bottom border-l-2 border-gray-300 bg-gray-50 whitespace-nowrap" rowSpan={2} style={{ minWidth: 90 }}>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Aksi</span>
                    </th>
                  </tr>

                  {/* Row 2: Individual field labels */}
                  <tr className="border-b-2 border-gray-300">
                    {PERM_GROUPS.map((g, gi) =>
                      g.fields.map((f, fi) => (
                        <th
                          key={`${gi}-${fi}`}
                          className={`px-0.5 py-1 text-center font-semibold text-gray-500 whitespace-nowrap
                            ${fi === 0 ? "border-l-2 border-gray-300" : "border-l border-gray-200"}
                            ${g.color}`}
                          style={{ minWidth: 28 }}
                        >
                          <span
                            className="block text-[8px] font-semibold uppercase tracking-wide"
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 44 }}
                          >
                            {f.label}
                          </span>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>

                <tbody>
                  {slice.map((u, idx) => {
                    const hasPending = !!pendingChanges[u.id] && Object.keys(pendingChanges[u.id]).length > 0;
                    const isSaving = savingId === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-gray-100 transition-colors
                          ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                          ${isSaving ? "opacity-60" : ""}`}
                      >
                        {/* Sticky: Name */}
                        <td
                          className={`sticky left-0 z-10 px-2 py-1 font-semibold text-gray-800 border-r-2 border-gray-300 whitespace-nowrap
                            ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          style={{ minWidth: 120 }}
                        >
                          {u.name}
                        </td>
                        {/* Sticky: Username */}
                        <td
                          className={`sticky px-2 py-1 text-gray-500 border-r-2 border-gray-300 whitespace-nowrap
                            ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          style={{ left: 120, zIndex: 10, minWidth: 90 }}
                        >
                          {u.user_name}
                        </td>

                        {/* Permission checkboxes */}
                        {PERM_GROUPS.map((g, gi) =>
                          g.fields.map((f, fi) => (
                            <td
                              key={`${gi}-${fi}`}
                              className={`text-center align-middle py-1
                                ${fi === 0 ? "border-l-2 border-gray-300" : "border-l border-gray-200"}
                                w-[28px] min-w-[28px]`}
                            >
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isTrue(u[f.key] as string)}
                                  disabled={isSaving}
                                  onChange={(e) => handleToggle(u.id, u.user_name, f.key, e.target.checked)}
                                  className="w-[11px] h-[11px] rounded accent-primary cursor-pointer disabled:cursor-wait"
                                />
                              </label>
                            </td>
                          ))
                        )}

                        {/* Actions */}
                        <td className="px-2 py-1 text-center border-l-2 border-gray-300 whitespace-nowrap">
                          {hasPending ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveUser(u.id, u.user_name)}
                                disabled={isSaving}
                                className="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {isSaving ? "..." : "Simpan"}
                              </button>
                              <button
                                onClick={() => handleDiscardUser(u.id)}
                                disabled={isSaving}
                                className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] hover:bg-gray-300 disabled:opacity-50 transition-colors"
                                title="Batalkan perubahan"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {slice.length === 0 && (
                    <tr>
                      <td colSpan={999} className="p-8 text-center text-sm text-gray-400">
                        {searchQuery ? "Tidak ada user yang cocok" : "Tidak ada user"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-2 border-t border-gray-200 bg-gray-50">
              <span className="text-[11px] text-gray-400">
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} dari {filtered.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 text-[11px] border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  ‹
                </button>
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1))
                    return (
                      <button key={p} onClick={() => setCurrentPage(p)}
                        className={`px-2 py-0.5 text-[11px] border rounded ${p === currentPage ? "bg-primary text-white border-primary" : "hover:bg-gray-100"}`}>
                        {p}
                      </button>
                    );
                  if (p === currentPage - 2 || p === currentPage + 2)
                    return <span key={p} className="self-center text-gray-400 text-[11px]">…</span>;
                  return null;
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 text-[11px] border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Javelin Modal ──────────────────────────────────────────────── */}
        {showJavelinModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800">Konfigurasi Javelin</h2>
                <button
                  onClick={() => { setShowJavelinModal(false); setManualCookie(""); setJavelinPassword(""); }}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cookie Value</label>
                  <textarea
                    value={manualCookie}
                    onChange={(e) => setManualCookie(e.target.value)}
                    rows={5}
                    placeholder="Paste cookie value di sini..."
                    className="w-full px-3 py-2 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="border-t border-dashed pt-4 space-y-3">
                  <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Auto-Refresh (opsional)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Username</label>
                      <input type="text" value={javelinUsername} onChange={(e) => setJavelinUsername(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Kosongkan jika tidak perlu" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Password</label>
                      <input type="password" value={javelinPassword} onChange={(e) => setJavelinPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Kosongkan jika tidak perlu" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowJavelinModal(false); setManualCookie(""); setJavelinPassword(""); }}
                    disabled={savingJavelin}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveJavelin}
                    disabled={savingJavelin || !manualCookie.trim()}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingJavelin ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
      </div>
    </div>
  );
}