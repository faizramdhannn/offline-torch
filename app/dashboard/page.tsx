"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

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
      const schedules: ScheduleRow[] = await schedRes.json();
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

  const indexOfLastItem  = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems     = activityLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages       = Math.ceil(activityLogs.length / itemsPerPage);

  if (!user) return null;

  const todayDayIdx     = new Date().getDay();
  const DAY_LABELS_FULL = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS          = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const now             = new Date();
  const todayLabel      = DAY_LABELS_FULL[todayDayIdx];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>
          {/* ── Jadwal Shift Hari Ini — card style ─────────────────────────── */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Jadwal Shift Hari Ini
                <span className="ml-2 text-xs font-normal text-gray-400">({todayLabel})</span>
              </h3>
              {scheduleLoading && <span className="text-xs text-gray-400 animate-pulse">Memuat...</span>}
            </div>

            {!scheduleLoading && todaySchedules.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-gray-400">Tidak ada data jadwal hari ini</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex gap-3 px-4 py-3" style={{ minWidth: 'max-content' }}>
                  {todaySchedules.map(({ store, tafts }) => (
                    <div
                      key={store}
                      className="flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden"
                      style={{ minWidth: '140px', maxWidth: '180px' }}
                    >
                      <div className="px-2.5 py-1.5 bg-primary/5 border-b border-primary/10">
                        <span className="text-[10px] font-bold text-primary block truncate" title={store}>
                          {toTitleCase(store)}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {tafts.map(taft => (
                          <div key={taft.name} className="flex items-center justify-between px-2.5 py-1 gap-1">
                            <span className="text-[10px] text-gray-700 shrink-0" title={taft.name}>
                              {truncateName(taft.name, 10)}
                            </span>
                            {taft.code ? (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${CODE_COLORS[taft.code] || 'bg-gray-100 text-gray-700'}`}>
                                {taft.code}
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-300 shrink-0">—</span>
                            )}
                          </div>
                        ))}
                        {tafts.length === 0 && (
                          <div className="px-2.5 py-1.5 text-[10px] text-gray-300 text-center">-</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Store Location ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Store Location</h3>
            </div>
            {storeAddresses.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">No store data available</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Store</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Address</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeAddresses.map((store, index) => (
                      <tr key={store.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                        <td className="px-3 py-1.5 text-gray-700 font-medium">{store.store_location}</td>
                        <td className="px-3 py-1.5 text-gray-600">{store.phone_number} {store.address}</td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => handleCopy(store)} className="text-gray-400 hover:text-primary transition-colors">
                            {copiedId === store.id ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Activity Log ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Activity Log</h3>
            </div>
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
            ) : activityLogs.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">No activity logs yet</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-36">Timestamp</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">User</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">Method</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((log, index) => (
                        <tr key={log.id} className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{log.timestamp}</td>
                          <td className="px-3 py-2 text-gray-700 font-medium">{log.user}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.method === "POST"     ? "bg-green-100 text-green-800"
                              : log.method === "PUT"    ? "bg-blue-100 text-blue-800"
                              : log.method === "DELETE" ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                            }`}>
                              {log.method}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{log.activity_log}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, activityLogs.length)} of {activityLogs.length} logs
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                          return <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 text-xs border rounded ${currentPage === page ? "bg-primary text-white" : "hover:bg-gray-50"}`}>{page}</button>;
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2 text-xs">...</span>;
                        }
                        return null;
                      })}
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}