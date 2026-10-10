"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Activity, Search, SlidersHorizontal, Rss, Database, Users as UsersIcon } from "lucide-react";
import Popup from "@/components/Popup";
import { PERM_GROUPS as SHARED_PERM_GROUPS } from "@/lib/permGroups";
import { Button } from "@/components/shared/Button";
import { GlassCard } from "@/components/shared/GlassCard";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { SearchShortcutHint } from "@/components/shared/SearchShortcutHint";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TableSkeletonRows } from "@/components/dashboard/LoadingSkeleton";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserData {
  id: string;
  name: string;
  user_name: string;
  role?: string;
  role_name?: string;
  deviations?: string[];
  email?: string;
  phone?: string;
  address?: string;
  photo_url?: string;
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
  stock_pca_view: string;
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
  step_erp: string;
  step_erp_all: string;
  employee_discount: string;
  employee_discount_approval: string;
  daily_checklist: string;
  daily_checklist_all: string;
  affiliate_view: string;
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
const PERM_GROUPS = SHARED_PERM_GROUPS as unknown as {
  label: string;
  color: string;
  fields: { key: PermKey; label: string }[];
}[];

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
  const [profileUser, setProfileUser] = useState<UserData | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<Record<PermKey, boolean>>>>({});
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [searchQuery, setSearchQuery] = useState("");
  const { ref: searchRef, shortcutLabel } = useSearchShortcut();
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
  const [dbTables, setDbTables] = useState<{ key: string; label: string }[]>([]);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  // ─── Recent Activity — dipindah dari Dashboard ke sini supaya hanya user
  // dengan akses Settings yang bisa melihat (halaman ini sudah digate
  // user_setting di atas). ────────────────────────────────────────────────
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const activityPerPage = 10;

  // Pencarian + paginasi di server (log bisa ribuan baris).
  const fetchActivityLogs = async (page = activityPage, q = activitySearch) => {
    try {
      const res = await fetch(`/api/activity-log?page=${page}&per=${activityPerPage}&q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const j = await res.json();
        setActivityLogs(j.rows || []);
        setActivityTotal(j.total || 0);
      }
    } catch (e) { console.error(e); }
    finally { setActivityLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchActivityLogs(activityPage, activitySearch), activitySearch ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityPage, activitySearch]);

  const activityIndexLast = activityPage * activityPerPage;
  const activityIndexFirst = activityIndexLast - activityPerPage;
  const activityCurrentItems = activityLogs;
  const activityTotalPages = Math.ceil(activityTotal / activityPerPage);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.user_setting) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchUsers();
    fetchJavelinStatus();
    if (parsedUser.registration_request) {
      fetch("/api/admin/db-export?list=1")
        .then((r) => r.json())
        .then((d) => setDbTables(d.tables || []))
        .catch(() => setDbTables([]));
    }
  }, [router]);

  const copyImportFormula = (tableKey: string) => {
    const url = `${window.location.origin}/api/admin/db-export?table=${tableKey}&username=${encodeURIComponent(user.user_name)}`;
    const formula = `=IMPORTDATA("${url}")`;
    navigator.clipboard.writeText(formula).then(() => {
      setCopiedTable(tableKey);
      setTimeout(() => setCopiedTable(null), 1500);
    });
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message); setPopupType(type); setShowPopup(true);
  };

  const logActivity = async (method: string, activity: string, entityId?: string) => {
    if (!user) return;
    try {
      await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.user_name, method, activity_log: activity, entity_type: "settings", entity_id: entityId || "" }),
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
        // Log perubahan permission dicatat server (app/api/users PUT), tidak lagi dari browser.
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
    <div className="flex-1 overflow-auto page-bg">
      <div className="p-4">
        <div
          className="relative mb-5 overflow-hidden rounded-3xl px-6 py-6"
          style={{ background: "linear-gradient(135deg, #35393C 0%, #1f4e63 45%, #0d7a8f 100%)" }}
        >
          <div
            className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full opacity-30 blur-2xl"
            style={{ background: "radial-gradient(circle, #A4D8FF 0%, transparent 70%)" }}
          />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
              <SlidersHorizontal className="h-5 w-5 text-white" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white">Settings</h1>
              <p className="text-xs text-white/70">Konfigurasi aplikasi, user, dan integrasi</p>
            </div>
          </div>
        </div>

        {/* ── Javelin + Export Database — bento row ───────────────────────── */}
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard padding="none" className="glass-card-elevated flex items-center justify-between px-4 py-2.5 gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-orange-50">
              <Rss className="h-3.5 w-3.5 text-orange-600" strokeWidth={2.25} />
            </span>
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
          </div>
          <Button
            size="sm"
            onClick={() => setShowJavelinModal(true)}
          >
            {javelinStatus.hasCookies ? "Update" : "Set Cookie"}
          </Button>
        </GlassCard>

        {/* ── Export Database ke Spreadsheet ─────────────────────────────── */}
        {/* Hanya untuk user dengan registration_request (page ini sendiri
            sudah digate user_setting) — dua permission ini yang paling dekat
            dengan "akses users, setting" yang diminta untuk fitur ini. */}
        {!!user.registration_request && dbTables.length > 0 && (
          <GlassCard padding="none" className="glass-card-elevated px-4 py-3">
            <div className="mb-0.5 flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                <Database className="h-3.5 w-3.5 text-purple-600" strokeWidth={2.25} />
              </span>
              <p className="text-xs font-semibold text-gray-700">Export Database ke Spreadsheet</p>
            </div>
            <p className="mb-2.5 ml-9 text-[11px] text-gray-400">
              Tabel-tabel ini tersimpan di database (bukan Google Sheets). Klik "Copy" lalu tempel
              formulanya di sel Google Sheets — hasilnya otomatis jadi tabel.
            </p>
            <div className="flex flex-col gap-1.5">
              {dbTables.map((t) => (
                <div
                  key={t.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
                >
                  <span className="text-[11px] font-medium text-gray-600">{t.label}</span>
                  <button
                    onClick={() => copyImportFormula(t.key)}
                    className="shrink-0 rounded bg-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-primary/90"
                  >
                    {copiedTable === t.key ? "Tersalin!" : "Copy Formula"}
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
        </div>

        {/* ── Recent Activity — dipindah dari Dashboard, cuma kelihatan di sini
            (halaman Settings sudah digate user_setting). ───────────────── */}
        <GlassCard padding="none" className="glass-card-elevated mb-4 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/40 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <Activity className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.25} />
              </span>
              <p className="text-xs font-semibold text-gray-700">Recent Activity</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(1); }}
                placeholder="Cari activity log..."
                className="h-8 w-48 rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          <div className="p-4">
            {activityLoading ? (
              <TableSkeletonRows count={5} />
            ) : activityTotal === 0 ? (
              <EmptyState icon={Activity} message="Belum ada activity log" />
            ) : (
              <>
                <ActivityTimeline logs={activityCurrentItems} />

                {activityTotalPages > 1 && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div className="text-xs text-gray-500">
                      Showing {activityIndexFirst + 1} to {Math.min(activityIndexLast, activityTotal)} of {activityTotal} logs
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                        disabled={activityPage === 1}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      {[...Array(activityTotalPages)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === activityTotalPages || (page >= activityPage - 1 && page <= activityPage + 1)) {
                          return (
                            <button
                              key={page}
                              onClick={() => setActivityPage(page)}
                              className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                                activityPage === page
                                  ? "border-primary bg-primary text-white"
                                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === activityPage - 2 || page === activityPage + 2) {
                          return <span key={page} className="px-1 text-xs text-gray-400">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                        disabled={activityPage === activityTotalPages}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </GlassCard>

        {/* ── User Management ───────────────────────────────────────────── */}
        <GlassCard padding="none" className="glass-card-elevated overflow-hidden">
          {/* Table header bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-white/40">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50">
                <UsersIcon className="h-3.5 w-3.5 text-green-600" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-700">User Management</p>
                <p className="text-[11px] text-gray-400">Klik checkbox untuk mengubah akses · Simpan untuk menyimpan perubahan</p>
              </div>
            </div>
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-6 pr-10 py-1 border border-gray-300 rounded text-[11px] w-40 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <SearchShortcutHint label={shortcutLabel} />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">Loading...</div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table data-stack="off" className="border-collapse" style={{ fontSize: "10px" }}>
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
                    <th
                      className="border-r-2 border-gray-300 bg-white px-2 py-1 text-left align-bottom whitespace-nowrap"
                      rowSpan={2}
                      style={{ minWidth: 110 }}
                    >
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Last Login</span>
                    </th>
                    <th
                      className="border-r-2 border-gray-300 bg-white px-2 py-1 text-left align-bottom whitespace-nowrap"
                      rowSpan={2}
                      style={{ minWidth: 90 }}
                    >
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Role</span>
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
                          ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "row-stripe"}
                          ${isSaving ? "opacity-60" : ""}`}
                      >
                        {/* Sticky: Name */}
                        <td
                          className={`sticky left-0 z-10 px-2 py-1 font-semibold text-gray-800 border-r-2 border-gray-300 whitespace-nowrap
                            ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "row-stripe-solid"}`}
                          style={{ minWidth: 120 }}
                        >
                          <button
                            type="button"
                            onClick={() => setProfileUser(u)}
                            title="Lihat profil"
                            className="text-left font-semibold text-gray-800 underline-offset-2 hover:text-primary hover:underline"
                          >
                            {u.name}
                          </button>
                        </td>
                        {/* Sticky: Username */}
                        <td
                          className={`sticky px-2 py-1 text-gray-500 border-r-2 border-gray-300 whitespace-nowrap
                            ${hasPending ? "bg-amber-50" : idx % 2 === 0 ? "bg-white" : "row-stripe-solid"}`}
                          style={{ left: 120, zIndex: 10, minWidth: 90 }}
                        >
                          {u.user_name}
                        </td>
                        {/* Last Login */}
                        <td className="px-2 py-1 text-gray-500 border-r-2 border-gray-300 whitespace-nowrap" style={{ minWidth: 110 }}>
                          {u.last_activity ? (
                            <span className="text-[10px] text-gray-600">{u.last_activity}</span>
                          ) : (
                            <span className="text-[10px] italic text-gray-300">Belum pernah</span>
                          )}
                        </td>

                        {/* Role + penanda menyimpang dari template role */}
                        <td className="px-2 py-1 border-r-2 border-gray-300 whitespace-nowrap" style={{ minWidth: 90 }}>
                          <span className="text-[10px] font-semibold text-gray-700">{u.role_name || u.role}</span>
                          {u.deviations && u.deviations.length > 0 && (
                            <span
                              className="ml-1 cursor-help text-[10px] text-amber-600"
                              title={`Berbeda dari role ${u.role_name || u.role}:\n${u.deviations.join("\n")}`}
                            >
                              ⚠ {u.deviations.length}
                            </span>
                          )}
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

            {/* HP: kartu per user (tanpa geser). Ketuk "Hak akses" untuk membuka daftar checkbox per grup. */}
            <div className="divide-y divide-gray-100 md:hidden">
              {slice.length === 0 && (
                <p className="p-8 text-center text-sm text-gray-400">{searchQuery ? "Tidak ada user yang cocok" : "Tidak ada user"}</p>
              )}
              {slice.map((u) => {
                const hasPending = !!pendingChanges[u.id] && Object.keys(pendingChanges[u.id]).length > 0;
                const isSaving = savingId === u.id;
                const open = openUserId === u.id;
                const total = PERM_GROUPS.reduce((n, g) => n + g.fields.filter((f) => isTrue(u[f.key] as string)).length, 0);
                return (
                  <div key={u.id} className={`p-3 ${hasPending ? "bg-amber-50" : ""} ${isSaving ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button type="button" onClick={() => setProfileUser(u)} className="truncate text-left text-sm font-semibold text-gray-800 underline-offset-2 hover:underline">
                          {u.name}
                        </button>
                        <p className="truncate text-xs text-gray-500">{u.user_name} · {u.role_name || u.role}{u.deviations && u.deviations.length > 0 ? ` · ⚠ ${u.deviations.length}` : ""}</p>
                        <p className="text-[11px] text-gray-400">{u.last_activity ? `Login terakhir ${u.last_activity}` : "Belum pernah login"}</p>
                      </div>
                      {hasPending && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button onClick={() => handleSaveUser(u.id, u.user_name)} disabled={isSaving} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {isSaving ? "..." : "Simpan"}
                          </button>
                          <button onClick={() => handleDiscardUser(u.id)} disabled={isSaving} className="rounded-lg bg-gray-200 px-3 py-2 text-xs text-gray-600 disabled:opacity-50" title="Batalkan perubahan">✕</button>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setOpenUserId(open ? null : u.id)} className="mt-2 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                      <span>Hak akses <span className="text-gray-400">({total} aktif)</span></span>
                      <span className="text-gray-400">{open ? "Tutup" : "Buka"}</span>
                    </button>
                    {open && (
                      <div className="mt-3 space-y-4">
                        {PERM_GROUPS.map((g) => (
                          <div key={g.label}>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{g.label}</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {g.fields.map((f) => (
                                <label key={f.key} className="flex items-center gap-2 py-1.5 text-xs text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={isTrue(u[f.key] as string)}
                                    disabled={isSaving}
                                    onChange={(e) => handleToggle(u.id, u.user_name, f.key, e.target.checked)}
                                    className="h-4 w-4 shrink-0 rounded accent-primary"
                                  />
                                  <span className="truncate">{f.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
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
        </GlassCard>

        {/* ── Profil user ── */}
        {profileUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setProfileUser(null)}>
            <div className="glass-card w-full max-w-sm overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col items-center gap-2 px-5 py-6 text-white" style={{ background: "linear-gradient(135deg, #35393C 0%, #1f4e63 45%, #0d7a8f 100%)" }}>
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/15 text-2xl font-semibold ring-2 ring-white/40">
                  {profileUser.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/drive-image?url=${encodeURIComponent(profileUser.photo_url)}&sz=w256`} alt={profileUser.name} className="h-full w-full object-cover" />
                  ) : (
                    (profileUser.name || profileUser.user_name).charAt(0).toUpperCase()
                  )}
                </div>
                <p className="text-base font-semibold" style={{ color: "#fff" }}>{profileUser.name}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,.75)" }}>@{profileUser.user_name}</p>
              </div>
              <dl className="space-y-3 px-5 py-4 text-sm">
                {[
                  ["Role", (profileUser as any).role || "store"],
                  ["Email", profileUser.email],
                  ["No. telepon", profileUser.phone],
                  ["Alamat", profileUser.address],
                  ["Login terakhir", profileUser.last_activity],
                ].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-medium text-gray-400">{label}</dt>
                    <dd className="text-gray-800">{val || <span className="italic text-gray-300">Belum diisi</span>}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-gray-100 px-5 py-3 text-right">
                <button onClick={() => setProfileUser(null)} className="rounded-lg bg-black/5 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-black/10">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Javelin Modal ──────────────────────────────────────────────── */}
        {showJavelinModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-card rounded-xl w-full max-w-lg mx-4 overflow-hidden">
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
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setShowJavelinModal(false); setManualCookie(""); setJavelinPassword(""); }}
                    disabled={savingJavelin}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveJavelin}
                    disabled={savingJavelin || !manualCookie.trim()}
                    loading={savingJavelin}
                  >
                    {savingJavelin ? "Menyimpan..." : "Simpan"}
                  </Button>
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