"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UserCheck,
  Store as StoreIcon,
  Users,
  Activity,
  CircleAlert,
  Clock3,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { ShiftCard } from "@/components/dashboard/ShiftCard";
import { QuickAction } from "@/components/dashboard/QuickAction";
import { StoreTable } from "@/components/dashboard/StoreTable";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CardSkeletonRow, TableSkeletonRows } from "@/components/dashboard/LoadingSkeleton";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
}

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
  status: string; // 'Active' | 'Draft' | 'Archived' — kosong dianggap Active
}

interface TaftEntry {
  id: string;
  store_name: string;
  taft_name: string;
  start_date: string;
  end_date: string;
}

interface DateEntry {
  id: string;
  date_range: string;
  week_start: string;
  week_end: string;
}

interface ScheduleRow {
  id: string;
  date_range: string;
  taft_name: string;
  store_name: string;
  monday: string; tuesday: string; wednesday: string;
  thursday: string; friday: string; saturday: string; sunday: string;
}

interface ReportRow {
  date: string;
  store_name: string;
  taft_name: string;
  clock_in: string;
  clock_out: string;
  code_time: string;
  overtime_hours: string;
  reason: string;
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

const CODE_COLORS: Record<string, string> = {
  P:   'bg-blue-100 text-blue-800',
  S:   'bg-yellow-100 text-yellow-800',
  F:   'bg-green-100 text-green-800',
  MF:  'bg-purple-100 text-purple-800',
  M:   'bg-orange-100 text-orange-800',
  O:   'bg-red-100 text-red-600',
  C:   'bg-pink-100 text-pink-800',
  '+': 'bg-red-100 text-red-700',
  I:   'bg-indigo-100 text-indigo-700',
  A:   'bg-red-200 text-red-900',
};

function parseDateSafe(str: string): Date | null {
  if (!str) return null;
  const dmY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function truncateName(name: string, max = 12): string {
  if (!name) return '';
  return name.length > max ? name.slice(0, max) + '…' : name;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [storeAddresses, setStoreAddresses] = useState<StoreAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  useSessionGuard();

  // Absensi hari ini (dari report)
  const [todayReport, setTodayReport] = useState<{
    store: string;
    tafts: { name: string; code: string; clockIn: string; clockOut: string }[];
  }[]>([]);
  const [reportLoading, setReportLoading] = useState(true);

  // Jadwal shift mingguan
  const [todaySchedules, setTodaySchedules] = useState<{ store: string; tafts: { name: string; code: string }[] }[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  const itemsPerPage = 10;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.dashboard) { router.push("/login"); return; }
    setUser(parsedUser);
    fetchActivityLogs();
    fetchStoreAddresses();
    fetchTodayAttendance();
    fetchTodaySchedule();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      const res = await fetch("/api/activity-log");
      if (res.ok) setActivityLogs(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchStoreAddresses = async () => {
    try {
      const res = await fetch("/api/store-address");
      if (res.ok) setStoreAddresses(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTodayAttendance = async () => {
    try {
      setReportLoading(true);
      const now   = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const today = todayISO();

      const [reportRes, metaRes] = await Promise.all([
        fetch(`/api/attendance/report?month=${month}`),
        fetch('/api/attendance/meta?type=taft_list'),
      ]);
      const allReports: ReportRow[] = await reportRes.json();
      const taftList: TaftEntry[]   = await metaRes.json();
      const todayRows = allReports.filter(r => r.date === today);
      const stores    = [...new Set(taftList.map(t => t.store_name))];

      setTodayReport(stores.map(store => ({
        store,
        tafts: taftList.filter(t => t.store_name === store).map(taft => {
          const row = todayRows.find(r => r.taft_name === taft.taft_name && r.store_name === store);
          return {
            name:     taft.taft_name,
            code:     row?.code_time?.trim() || '',
            clockIn:  row?.clock_in  || '',
            clockOut: row?.clock_out || '',
          };
        }),
      })));
    } catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  const fetchTodaySchedule = async () => {
    try {
      setScheduleLoading(true);
      const metaRes = await fetch('/api/attendance/meta?type=all');
      const meta    = await metaRes.json();
      const taftList: TaftEntry[] = meta.taftList || [];
      const dateList: DateEntry[] = meta.dateList || [];

      const todayDay    = new Date().getDay();
      const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];
      const today = new Date(); today.setHours(0,0,0,0);

      let currentDateRange = '';
      for (const d of dateList) {
        if (d.week_start && d.week_end) {
          const start = parseDateSafe(d.week_start);
          const end   = parseDateSafe(d.week_end);
          if (!start || !end) continue;
          start.setHours(0,0,0,0); end.setHours(23,59,59,999);
          if (today >= start && today <= end) { currentDateRange = d.date_range; break; }
        }
      }
      if (!currentDateRange && dateList.length > 0) currentDateRange = dateList[dateList.length - 1].date_range;
      if (!currentDateRange) { setTodaySchedules([]); return; }


const schedRes  = await fetch(`/api/attendance/schedule?date_range=${encodeURIComponent(currentDateRange)}`);
const schedRaw  = await schedRes.json();
const schedules: ScheduleRow[] = Array.isArray(schedRaw) ? schedRaw : (schedRaw?.data ?? []);
      const stores = [...new Set(taftList.map(t => t.store_name))];

      setTodaySchedules(stores.map(store => ({
        store,
        tafts: taftList.filter(t => t.store_name === store).map(taft => {
          const sched = schedules.find(s => s.taft_name === taft.taft_name && s.store_name === taft.store_name && s.date_range === currentDateRange);
          return { name: taft.taft_name, code: sched?.[todayDayKey as keyof ScheduleRow] as string || '' };
        }),
      })));
    } catch (e) { console.error(e); }
    finally { setScheduleLoading(false); }
  };

  const handleCopy = (store: StoreAddress) => {
    const text = `${store.store_location}\n${store.phone_number} ${store.address}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(store.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  // ── UI-only state (does not touch business logic) ────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchActivityLogs(),
      fetchStoreAddresses(),
      fetchTodayAttendance(),
      fetchTodaySchedule(),
    ]);
    setIsRefreshing(false);
  };

  // Client-side display filter only — does not mutate activityLogs state.
  const displayedLogs = useMemo(() => {
    if (!searchQuery.trim()) return activityLogs;
    const q = searchQuery.toLowerCase();
    return activityLogs.filter(
      (log) =>
        log.user?.toLowerCase().includes(q) ||
        log.activity_log?.toLowerCase().includes(q) ||
        log.method?.toLowerCase().includes(q)
    );
  }, [activityLogs, searchQuery]);

  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems     = displayedLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages       = Math.ceil(displayedLogs.length / itemsPerPage);

  // ── Derived KPI numbers for summary cards (display-only, reuses existing state) ──
  // Store yang statusnya Active di store_address (kosong = dianggap Active,
  // untuk baris lama sebelum kolom status ditambahkan). Store Draft/Archived
  // tidak dihitung di manapun di dashboard ini.
  const activeStoreNames = new Set(
    storeAddresses
      .filter((s) => !s.status || s.status.trim().toLowerCase() === "active")
      .map((s) => s.store_location.toLowerCase().trim())
  );
  const activeStoreCount = activeStoreNames.size;

  // Attendance Today = berapa store AKTIF yang sudah capture attendance hari
  // ini, dari total store aktif (bukan lagi dari daftar toko di taft_list).
  const attendanceTodayCount = todayReport.filter(
    (store) => activeStoreNames.has(store.store.toLowerCase().trim()) && store.tafts.some(t => t.code)
  ).length;
  const totalStoreCount = activeStoreCount;
  const totalTaftToday = todayReport.reduce((sum, store) => sum + store.tafts.length, 0);
  // Hitung log hari ini — coba semua format timestamp yang mungkin
  const todayStr = todayISO();
  const MONTHS_ID: { [key: string]: number } = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
    Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11,
  };
  const todayActivityCount = activityLogs.filter((log) => {
    if (!log.timestamp) return false;
    const ts = log.timestamp.trim();
    // Format: "2025-01-15T..." atau "2025-01-15 ..."
    if (ts.startsWith(todayStr) || ts.includes(todayStr)) return true;
    // Format dd/mm/yyyy
    const now = new Date();
    const ddmmyyyy = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
    if (ts.startsWith(ddmmyyyy)) return true;
    // Format "08 Jul 2026, 14:23:11" (dari lib/sheets locale id-ID)
    const idMatch = ts.match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (idMatch) {
      const [, day, monShort, year] = idMatch;
      const monIdx = MONTHS_ID[monShort];
      if (monIdx !== undefined &&
          Number(day) === now.getDate() &&
          monIdx === now.getMonth() &&
          Number(year) === now.getFullYear()) {
        return true;
      }
    }
    return false;
  }).length;
  const pendingShiftCount = todaySchedules.reduce(
    (sum, s) => sum + s.tafts.filter((t) => !t.code).length,
    0
  );

  if (!user) return null;

  const todayDayIdx     = new Date().getDay();
  const DAY_LABELS_FULL = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS          = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const now             = new Date();
  const todayLabel      = DAY_LABELS_FULL[todayDayIdx];
  const dateLabel       = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50">
      <div className="mx-auto max-w-7xl p-4">

        {/* ── Header ─────────────────────────────────────────────── */}
        <DashboardHeader
          dayLabel={todayLabel}
          dateLabel={dateLabel}
          onRefresh={handleRefreshAll}
          isRefreshing={isRefreshing}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* ── Summary Cards ──────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            label="Attendance Today"
            value={attendanceTodayCount}
            suffix={totalStoreCount ? `/${totalStoreCount} store` : ""}
            icon={UserCheck}
            accent="green"
            delay={0}
          />
          <SummaryCard
            label="Store Active"
            value={activeStoreCount}
            icon={StoreIcon}
            accent="blue"
            delay={0.04}
          />
          <SummaryCard
            label="Total Staff"
            value={totalTaftToday}
            icon={Users}
            accent="purple"
            delay={0.08}
          />
          <SummaryCard
            label="Pending Shift"
            value={pendingShiftCount}
            icon={CircleAlert}
            accent="orange"
            delay={0.12}
          />
          <SummaryCard
            label="Activity Today"
            value={todayActivityCount}
            icon={Activity}
            accent="gray"
            delay={0.16}
          />
        </div>

        {/* ── Today's Shift ──────────────────────────────────────── */}
        <div className="mb-6">
          <SectionCard
            title="Jadwal Shift Hari Ini"
            subtitle={`(${todayLabel})`}
            badge={
              scheduleLoading && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock3 className="h-3 w-3 animate-pulse" />
                  Memuat...
                </span>
              )
            }
            noPadding
          >
            <div className="p-4">
              {scheduleLoading ? (
                <CardSkeletonRow count={4} />
              ) : todaySchedules.length === 0 ? (
                <EmptyState icon={Clock3} message="Tidak ada data jadwal hari ini" />
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1 snap-x sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
                  {todaySchedules.map(({ store, tafts }, i) => (
                    <ShiftCard
                      key={store}
                      store={store}
                      tafts={tafts}
                      toTitleCase={toTitleCase}
                      truncateName={truncateName}
                      codeColors={CODE_COLORS}
                      delay={i * 0.04}
                    />
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Quick Action ───────────────────────────────────────── */}
        <div className="mb-6">
          <SectionCard title="Quick Action" noPadding>
            <div className="p-4">
              <QuickAction />
            </div>
          </SectionCard>
        </div>

        {/* ── Store Location ─────────────────────────────────────── */}
        <div className="mb-6">
          <SectionCard title="Store Location">
            <StoreTable
              stores={storeAddresses.filter((s) => !s.status || s.status.trim().toLowerCase() === "active")}
              onCopy={handleCopy}
              copiedId={copiedId}
              onRefresh={fetchStoreAddresses}
            />
          </SectionCard>
        </div>

        {/* ── Activity Log (Timeline) ────────────────────────────── */}
        <SectionCard title="Recent Activity">
          {loading ? (
            <TableSkeletonRows count={5} />
          ) : displayedLogs.length === 0 ? (
            <EmptyState icon={Activity} message="Belum ada activity log" />
          ) : (
            <>
              <ActivityTimeline logs={currentItems} />

              {totalPages > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, displayedLogs.length)} of {displayedLogs.length} logs
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                              currentPage === page
                                ? "border-primary bg-primary text-white"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-1 text-xs text-gray-400">...</span>;
                      }
                      return <span key={page} />;
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>

      </div>
    </div>
  );
}