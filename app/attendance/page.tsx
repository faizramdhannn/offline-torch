"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx-js-style";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleRow {
  id: string;
  date_range: string;
  taft_name: string;
  store_name: string;
  monday: string; tuesday: string; wednesday: string;
  thursday: string; friday: string; saturday: string; sunday: string;
}

interface DateEntry    { id: string; date_range: string; week_start: string; week_end: string; }
interface TaftEntry    { id: string; store_name: string; taft_name: string; start_date: string; end_date: string; }
interface TimeCode     { id: string; code_time: string; definition_code: string; }
interface StoreEntry   { id: string; store_name: string; }
interface StoreWagesEntry {
  id: string;
  store_name: string;
  type_store?: string;
  open_hours?: string;
  close_hours?: string;
  store_wages?: string; // e.g. "Rp2.878.646"
}
interface SalesStat {
  month_sales: string;
  store_name: string;
  sales: number;
}
interface ReportRow {
  date: string; store_name: string; taft_name: string;
  clock_in: string; clock_out: string; code_time: string;
  overtime_hours: string; reason: string;
}

function parseCurrencyStr(val: string | undefined | null): number {
  if (!val) return 0;
  const s = String(val).replace(/Rp\s?/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const DAYS       = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DAY_LABELS = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
const DAY_LABELS_FULL = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

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

const CODE_BG_CELL: Record<string, string> = {
  P:   'bg-blue-50',
  S:   'bg-yellow-50',
  F:   'bg-green-50',
  MF:  'bg-purple-50',
  M:   'bg-orange-50',
  O:   'bg-red-50',
  C:   'bg-pink-50',
  '+': 'bg-red-50',
  I:   'bg-indigo-50',
  A:   'bg-red-100',
};

const RECAP_KEYS = [
  { key:'P',   label:'PAGI (P)'        },
  { key:'S',   label:'SIANG (S)'       },
  { key:'O',   label:'OFF (O)'         },
  { key:'F',   label:'FULL (F)'        },
  { key:'MF',  label:'MIDLE FULL (MF)' },
  { key:'C',   label:'CUTI (C)'        },
  { key:'+',   label:'SAKIT (+)'       },
  { key:'I',   label:'IZIN (I)'        },
  { key:'A',   label:'ALPA (A)'        },
];

const OVERTIME_RATE = 17500;

function normalizeTime(raw: string | number | undefined | null): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim().replace(/^[`']+/, '');
  if (s === '' || s.toLowerCase() === 'none' || s === '-') return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m.slice(0, 2)}`;
  }
  const f = parseFloat(s);
  if (!isNaN(f)) {
    if (f > 0 && f < 1) {
      const totalMinutes = Math.round(f * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const h = Math.floor(f);
    const m = Math.round((f - h) * 100);
    return `${String(h).padStart(2, '0')}:${String(Math.min(m, 59)).padStart(2, '0')}`;
  }
  return s;
}

function displayTime(val: string | number | undefined | null): string {
  if (val === null || val === undefined || val === '') return '-';
  const n = normalizeTime(val);
  return n || String(val);
}

function parseDateSafe(str: string): Date | null {
  if (!str) return null;
  const dmY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function findCurrentDateRange(dateList: DateEntry[]): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const d of dateList) {
    if (d.week_start && d.week_end) {
      const start = parseDateSafe(d.week_start);
      const end   = parseDateSafe(d.week_end);
      if (!start || !end) continue;
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) return d.date_range;
    }
  }
  if (dateList.length > 0) return dateList[dateList.length - 1].date_range;
  return '';
}

function buildTaftDateRange(month: string, startDay: number, endDay: number): { from: Date; to: Date } {
  const [year, mon] = month.split('-').map(Number);
  let from: Date;
  let to: Date;
  if (startDay >= endDay) {
    from = new Date(year, mon - 2, startDay);
    to   = new Date(year, mon - 1, endDay);
  } else {
    from = new Date(year, mon - 1, startDay);
    to   = new Date(year, mon - 1, endDay);
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function buildTaftDates(month: string, startDay: number, endDay: number): Date[] {
  const { from, to } = buildTaftDateRange(month, startDay, endDay);
  const dates: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const fmtISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getWeekDates(dateList: DateEntry[], dateRange: string): Date[] | null {
  const entry = dateList.find(d => d.date_range === dateRange);
  if (!entry?.week_start) return null;
  const start = parseDateSafe(entry.week_start);
  if (!start) return null;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const fmtDDMM = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const MONTH_SHORT_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const truncName = (s: string, n = 15) => s && s.length > n ? s.slice(0, n) + '…' : (s || '');

const toTitleCase = (str: string) =>
  str ? str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : str;

const fmtRupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter();
  const [user,        setUser]        = useState<any>(null);
  const [isStoreUser, setIsStoreUser] = useState(false);
  const [myStoreName, setMyStoreName] = useState('');
  const [activeTab,   setActiveTab]   = useState<'weekly'|'monthly'|'report'>('weekly');

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance) { router.push("/dashboard"); return; }
    setUser(parsed);

    fetch('/api/attendance/meta?type=store_list')
      .then(r => r.json())
      .then((stores: StoreEntry[]) => {
        const match = stores.find(
          s => s.store_name?.toLowerCase() === parsed.user_name?.toLowerCase()
        );
        if (match) {
          setIsStoreUser(true);
          setMyStoreName(match.store_name);
        }
      });
  }, []);

  if (!user) return null;

  const tabs = [
    { key: 'weekly',  label: 'Weekly'  },
    { key: 'monthly', label: 'Monthly' },
    ...(user.attendance_report ? [{ key: 'report', label: 'Report' }] : []),
  ] as { key: 'weekly'|'monthly'|'report'; label: string }[];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-primary">Attendance</h1>
            <div className="flex gap-0.5 bg-white rounded-lg p-0.5 shadow border border-gray-100">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-900 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'weekly'  && <WeeklySchedule  user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
          {activeTab === 'monthly' && <MonthlyReport   user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
          {activeTab === 'report'  && user.attendance_report && <FullReport user={user} />}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Schedule ───────────────────────────────────────────────────────────
function WeeklySchedule({
  user, isStoreUser, myStoreName,
}: { user: any; isStoreUser: boolean; myStoreName: string }) {
  const [dateList,          setDateList]          = useState<DateEntry[]>([]);
  const [allTaftList,       setAllTaftList]       = useState<TaftEntry[]>([]);
  const [allStores,         setAllStores]         = useState<string[]>([]);
  const [timeCodes,         setTimeCodes]         = useState<TimeCode[]>([]);
  const [schedules,         setSchedules]         = useState<ScheduleRow[]>([]);
  const [selectedStore,     setSelectedStore]     = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('');
  const weekDates = getWeekDates(dateList, selectedDateRange);

  const [editingRow,   setEditingRow]   = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [savingRow,    setSavingRow]    = useState<string | null>(null);

  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' as 'success'|'error' });

  useEffect(() => {
    fetch('/api/attendance/meta?type=all').then(r => r.json()).then(d => {
      setDateList(d.dateList || []);
      setAllTaftList(d.taftList || []);
      const stores = [...new Set((d.taftList || []).map((t: TaftEntry) => t.store_name))] as string[];
      setAllStores(stores);
      if (isStoreUser && myStoreName) {
        setSelectedStore(myStoreName);
      }
      const seen  = new Set<string>();
      const codes = (d.timeSchedule || []).filter((t: TimeCode) => {
        if (seen.has(t.code_time)) return false;
        seen.add(t.code_time);
        return true;
      });
      setTimeCodes(codes);
      const currentRange = findCurrentDateRange(d.dateList || []);
      if (currentRange) setSelectedDateRange(currentRange);
    });
  }, [isStoreUser, myStoreName]);

  useEffect(() => {
    if (selectedDateRange) fetchSchedules();
  }, [selectedStore, selectedDateRange]);

  const fetchSchedules = async () => {
    const storeParam = selectedStore ? `&store_name=${encodeURIComponent(selectedStore)}` : '';
    const res = await fetch(
      `/api/attendance/schedule?date_range=${encodeURIComponent(selectedDateRange)}${storeParam}`
    );
    setSchedules(await res.json());
  };

  const taftList = selectedStore
    ? allTaftList.filter(t => t.store_name?.toLowerCase() === selectedStore.toLowerCase())
    : allTaftList;

  const getSchedule = (taft: TaftEntry) =>
    schedules.find(
      s => s.taft_name === taft.taft_name &&
           s.store_name === taft.store_name &&
           s.date_range === selectedDateRange
    );

  const rowKey = (taft: TaftEntry) => `${taft.store_name}__${taft.taft_name}`;

  const startEdit = (taft: TaftEntry) => {
    const key = rowKey(taft);
    const existing = getSchedule(taft);
    const init: Record<string, string> = {};
    DAYS.forEach(d => { init[d] = existing?.[d as keyof ScheduleRow] as string || ''; });
    setEditFormData(init);
    setEditingRow(key);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditFormData({});
  };

  const saveRow = async (taft: TaftEntry) => {
    const key = rowKey(taft);
    setSavingRow(key);
    try {
      const res = await fetch('/api/attendance/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_range: selectedDateRange,
          taft_name:  taft.taft_name,
          store_name: taft.store_name,
          ...editFormData,
          created_by: user.user_name,
        }),
      });
      if (res.ok) {
        setPopup({ show: true, message: 'Jadwal berhasil disimpan!', type: 'success' });
        setEditingRow(null);
        fetchSchedules();
      } else {
        setPopup({ show: true, message: 'Gagal menyimpan jadwal', type: 'error' });
      }
    } finally {
      setSavingRow(null);
    }
  };

  const todayDay    = new Date().getDay();
  const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];

  const storeGroups: { storeName: string; tafts: TaftEntry[] }[] = [];
  const seenStores = new Set<string>();
  taftList.forEach(t => {
    if (!seenStores.has(t.store_name)) {
      seenStores.add(t.store_name);
      storeGroups.push({ storeName: t.store_name, tafts: [] });
    }
    storeGroups.find(g => g.storeName === t.store_name)!.tafts.push(t);
  });

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isStoreUser ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-900">Store:</span>
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{toTitleCase(myStoreName)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Store</label>
              <select
                value={selectedStore}
                onChange={e => { setSelectedStore(e.target.value); setSchedules([]); setEditingRow(null); }}
                className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Semua Store</option>
                {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Periode</label>
            <select
              value={selectedDateRange}
              onChange={e => { setSelectedDateRange(e.target.value); setEditingRow(null); }}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Pilih Periode</option>
              {dateList.map(d => (
                <option key={d.id} value={d.date_range}>{d.date_range}</option>
              ))}
            </select>
          </div>

          {selectedDateRange && (
            <span className="text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded font-medium">
              {selectedDateRange}
            </span>
          )}
        </div>
      </div>

      {!selectedDateRange ? (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">
          Pilih periode untuk melihat jadwal
        </div>
      ) : storeGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">
          Tidak ada data taft
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[140px] max-w-[160px] w-40 border-r border-gray-200">
                    Nama TAFT
                  </th>
                  {DAYS.map((day, i) => (
                    <th
                      key={day}
                      className={`px-1 py-2 text-center font-semibold text-gray-900 w-16 ${
                        day === todayDayKey ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="text-[11px]">{DAY_LABELS[i]}</div>
                      {weekDates?.[i] && (
                        <div className="text-[9px] font-normal text-gray-900 mt-0.5">
                          {fmtDDMM(weekDates[i])}
                        </div>
                      )}
                      {day === todayDayKey && (
                        <div className="text-[9px] text-blue-500 font-normal">Hari ini</div>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-900 w-24 sticky right-0 bg-gray-50 z-10 border-l border-gray-200">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {storeGroups.map(({ storeName, tafts }) => (
                  <React.Fragment key={storeName}>
                    <tr className="bg-primary/5 border-y border-primary/10">
                      <td colSpan={9} className="px-3 py-1.5 sticky left-0 bg-primary/5 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-primary">{toTitleCase(storeName)}</span>
                          <span className="text-[10px] text-gray-900">{tafts.length} taft</span>
                        </div>
                      </td>
                    </tr>

                    {tafts.map(taft => {
                      const key      = rowKey(taft);
                      const sched    = getSchedule(taft);
                      const isEdit   = editingRow === key;
                      const isSaving = savingRow === key;
                      const hasEntry = sched && DAYS.some(d => sched[d as keyof ScheduleRow]);

                      return (
                        <tr key={key} className={`border-b border-gray-100 transition-colors ${isEdit ? 'bg-amber-50/60' : 'hover:bg-gray-50/80'}`}>
                          <td className={`px-2 py-1.5 sticky left-0 z-10 border-r border-gray-100 min-w-[140px] max-w-[160px] w-40 ${isEdit ? 'bg-amber-50/60' : 'bg-white'}`}>
                            <div className="flex items-center gap-1">
                              {isEdit && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                              <span className="font-medium text-gray-800 text-[11px] leading-tight truncate" title={taft.taft_name}>{taft.taft_name}</span>
                            </div>
                          </td>

                          {DAYS.map((day) => {
                            const code = isEdit
                              ? editFormData[day] || ''
                              : (sched?.[day as keyof ScheduleRow] as string || '');

                            return (
                              <td key={day} className={`px-1 py-1 text-center w-16 ${day === todayDayKey && !isEdit ? 'bg-blue-50/50' : ''} ${isEdit && code ? CODE_BG_CELL[code] || '' : ''}`}>
                                {isEdit ? (
                                  <select
                                    value={editFormData[day] || ''}
                                    onChange={e => setEditFormData(prev => ({ ...prev, [day]: e.target.value }))}
                                    className="w-14 px-0.5 py-0.5 border border-gray-300 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                                  >
                                    <option value="">-</option>
                                    {timeCodes.map(t => (
                                      <option key={`${t.id}-${t.code_time}`} value={t.code_time}>{t.code_time}</option>
                                    ))}
                                  </select>
                                ) : (
                                  code ? (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${CODE_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>{code}</span>
                                  ) : (
                                    <span className="text-gray-900 text-[10px]">—</span>
                                  )
                                )}
                              </td>
                            );
                          })}

                          <td className={`px-2 py-1 text-center sticky right-0 z-10 border-l border-gray-100 ${isEdit ? 'bg-amber-50/60' : 'bg-white'}`}>
                            {isEdit ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => saveRow(taft)} disabled={isSaving} className="px-2 py-1 bg-primary text-white rounded text-[10px] font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
                                  {isSaving ? '...' : 'Simpan'}
                                </button>
                                <button onClick={cancelEdit} disabled={isSaving} className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-[10px] font-medium hover:bg-gray-400 disabled:opacity-50">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(taft)}
                                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${hasEntry ? 'bg-gray-100 text-gray-900 hover:bg-primary/10 hover:text-primary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                              >
                                {hasEntry ? 'Edit' : '+ Input'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-1.5">
            {Object.entries(CODE_COLORS).map(([code, cls]) => (
              <span key={code} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cls}`}>{code}</span>
            ))}
          </div>
        </div>
      )}

      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />
    </div>
  );
}

// ─── Monthly Report ────────────────────────────────────────────────────────────
function MonthlyReport({
  user, isStoreUser, myStoreName,
}: { user: any; isStoreUser: boolean; myStoreName: string }) {
  const [taftList,          setTaftList]          = useState<TaftEntry[]>([]);
  const [allStores,         setAllStores]         = useState<string[]>([]);
  const [selectedStore,     setSelectedStore]     = useState('');
  const [selectedMonth,     setSelectedMonth]     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [importing,         setImporting]         = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' as 'success'|'error' });
  const fileRef = useRef<HTMLInputElement>(null);

  const [subTab, setSubTab] = useState<'import'|'recap'>('import');
  const [recapStore,   setRecapStore]   = useState('');
  const [recapReports, setRecapReports] = useState<ReportRow[]>([]);
  const [recapLoading, setRecapLoading] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/meta?type=taft_list').then(r => r.json()).then((data: TaftEntry[]) => {
      setTaftList(data);
      const stores = [...new Set(data.map(t => t.store_name))] as string[];
      setAllStores(stores);
      if (isStoreUser && myStoreName) {
        setSelectedStore(myStoreName);
      }
    });
  }, [isStoreUser, myStoreName]);

  const filteredTafts = selectedStore
    ? taftList.filter(t => t.store_name?.toLowerCase() === selectedStore.toLowerCase())
    : taftList;

  const handleDownloadTemplate = () => {
    if (!selectedMonth) return;
    const storeForTemplate = isStoreUser ? myStoreName : selectedStore;
    if (!storeForTemplate) return;

    const taftsForStore = taftList.filter(
      t => t.store_name?.toLowerCase() === storeForTemplate.toLowerCase()
    );
    if (taftsForStore.length === 0) return;

    const wb      = XLSX.utils.book_new();
    const headers = ['date','store_name','taft_name','clock_in','clock_out','code_time','overtime_hours','reason'];
    const colWidths = [{ wch:14 },{ wch:16 },{ wch:28 },{ wch:10 },{ wch:10 },{ wch:12 },{ wch:14 },{ wch:20 }];

    for (const taft of taftsForStore) {
      const startDay = parseInt(taft.start_date || '26');
      const endDay   = parseInt(taft.end_date   || '25');
      const dates    = buildTaftDates(selectedMonth, startDay, endDay);

      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ...dates.map(d => [fmtISO(d), storeForTemplate, taft.taft_name, '', '', '', '', '']),
      ]);
      ws['!cols'] = colWidths;

      const sheetName = taft.taft_name.replace(/[\\\/?*\[\]:']/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const refWs = XLSX.utils.aoa_to_sheet([
      ['Kode','Keterangan'],
      ['P','Pagi'],['S','Siang'],['F','Full'],['MF','Midle Full'],
      ['O','OFF'],['C','Cuti'],['+','Sakit'],['I','Izin'],['A','Alpa'],
    ]);
    refWs['!cols'] = [{ wch:8 },{ wch:16 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Kode Referensi');

    XLSX.writeFile(wb, `attendance_${storeForTemplate}_${selectedMonth}.xlsx`);
    setShowDownloadModal(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array' });
      const SKIP_SHEETS = ['kode referensi', 'referensi', 'kode'];
      const allRows: any[] = [];
      let dataSheetCount = 0;
      for (const sheetName of wb.SheetNames) {
        if (SKIP_SHEETS.includes(sheetName.toLowerCase())) continue;
        dataSheetCount++;
        const ws      = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        for (const r of rawRows) {
          if (!r.date) continue;
          allRows.push({
            date:           String(r.date           || ''),
            store_name:     String(r.store_name     || ''),
            taft_name:      String(r.taft_name      || ''),
            clock_in:       normalizeTime(r.clock_in  ?? ''),
            clock_out:      normalizeTime(r.clock_out ?? ''),
            code_time:      String(r.code_time      || ''),
            overtime_hours: String(r.overtime_hours || ''),
            reason:         String(r.reason         || ''),
          });
        }
      }

      if (allRows.length === 0) {
        setPopup({ show: true, message: 'Tidak ada data yang valid di file', type: 'error' });
        return;
      }

      const res    = await fetch('/api/attendance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: allRows }),
      });
      const result = await res.json();
      setPopup({
        show: true,
        message: result.success
          ? `${result.imported} baris dari ${dataSheetCount} sheet berhasil diimport`
          : (result.error || 'Import gagal'),
        type: result.success ? 'success' : 'error',
      });
    } catch {
      setPopup({ show: true, message: 'Gagal membaca file XLSX', type: 'error' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fetchRecap = async () => {
    setRecapLoading(true);
    try {
      const storeParam = recapStore ? `&store_name=${encodeURIComponent(recapStore)}` : '';
      const res = await fetch(`/api/attendance/report?month=${selectedMonth}${storeParam}`);
      setRecapReports(await res.json());
    } finally {
      setRecapLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'recap' && selectedMonth) fetchRecap();
  }, [subTab, recapStore, selectedMonth]);

  const recapTafts = recapStore
    ? taftList.filter(t => t.store_name?.toLowerCase() === recapStore.toLowerCase())
    : taftList;

  const calcRecap = (taft: TaftEntry) => {
    const startDay = parseInt(taft.start_date) || 26;
    const endDay   = parseInt(taft.end_date)   || 25;
    const { from, to } = buildTaftDateRange(selectedMonth, startDay, endDay);

    const rows = recapReports.filter(r => {
      if (r.taft_name !== taft.taft_name || r.store_name !== taft.store_name) return false;
      const d = parseDateSafe(r.date);
      return d && d >= from && d <= to;
    });

    const counts: Record<string,number> = {};
    let totalMasuk = 0, totalOff = 0, totalLembur = 0;
    rows.forEach(r => {
      const code = r.code_time?.trim();
      if (code) counts[code] = (counts[code] || 0) + 1;
      if (['P','S','F','MF','M'].includes(code)) totalMasuk++;
      if (code === 'O') totalOff++;
      if (r.overtime_hours && parseFloat(r.overtime_hours) > 0) totalLembur += parseFloat(r.overtime_hours);
    });
    return { counts, totalMasuk, totalOff, totalLembur };
  };

  const exportRecapXlsx = () => {
    const wb = XLSX.utils.book_new();

    const borderAll = {
      top:    { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left:   { style: 'thin', color: { rgb: '000000' } },
      right:  { style: 'thin', color: { rgb: '000000' } },
    };

    const styleTitle = {
      font:      { bold: true, sz: 11, color: { rgb: '000000' } },
      fill:      { fgColor: { rgb: 'FFC000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border:    borderAll,
    };

    const styleSubHeader = {
      font:      { bold: true, sz: 10, color: { rgb: '000000' } },
      fill:      { fgColor: { rgb: '92D050' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    borderAll,
    };

    const styleSubHeaderTotal = {
      font:      { bold: true, sz: 10, color: { rgb: '000000' } },
      fill:      { fgColor: { rgb: '92D050' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    borderAll,
    };

    const styleLabelNormal = {
      font:      { bold: true, sz: 10 },
      fill:      { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    borderAll,
    };

    const styleValueNormal = {
      font:      { bold: true, sz: 10 },
      fill:      { fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    borderAll,
    };

    const styleLabelLembur = {
      font:      { bold: true, sz: 10, color: { rgb: '0070C0' } },
      fill:      { fgColor: { rgb: '00B0F0' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    borderAll,
    };

    const styleValueLembur = {
      font:      { bold: true, sz: 10, color: { rgb: '0070C0' } },
      fill:      { fgColor: { rgb: '00B0F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border:    borderAll,
    };

    for (const { storeName, tafts } of recapStoreGroups) {
      const TAFT_WIDTH = 2;
      const GAP        = 1;
      const BLOCK      = TAFT_WIDTH + GAP;
      const ROWS_PER_CARD = 14;

      const maxCols = tafts.length * BLOCK;
      const grid: any[][] = Array.from({ length: ROWS_PER_CARD }, () =>
        Array(maxCols).fill(null)
      );

      tafts.forEach((taft, tIdx) => {
        const colA = tIdx * BLOCK;
        const colB = tIdx * BLOCK + 1;

        const sd = parseInt(taft.start_date) || 26;
        const ed = parseInt(taft.end_date)   || 25;
        const { from, to } = buildTaftDateRange(selectedMonth, sd, ed);
        const recap = calcRecap(taft);

        const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const fmtTgl = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${MONTH_ID[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
        const toUpper = (s: string) => s.toUpperCase();

        grid[0][colA] = { v: `REKAPAN ABSEN ${fmtTgl(from)} - ${fmtTgl(to)}`, s: styleTitle };
        grid[0][colB] = { v: '', s: styleTitle };
        grid[1][colA] = { v: `${toUpper(taft.taft_name)} / ${toUpper(storeName)}`, s: styleSubHeader };
        grid[1][colB] = { v: 'TOTAL', s: styleSubHeaderTotal };

        const dataRows = [
          { label: 'TOTAL MASUK KERJA', value: recap.totalMasuk,           lembur: false },
          { label: 'TOTAL OFF',         value: recap.totalOff,             lembur: false },
          { label: 'TOTAL JAM LEMBUR',  value: recap.totalLembur > 0 ? parseFloat(recap.totalLembur.toFixed(1)) : 0, lembur: true },
          { label: 'TOTAL CUTI',        value: recap.counts['C']  || 0,   lembur: false },
          { label: 'TOTAL SAKIT',       value: recap.counts['+']  || 0,   lembur: false },
          { label: 'TOTAL IZIN',        value: recap.counts['I']  || 0,   lembur: false },
          { label: 'TOTAL ALPA',        value: recap.counts['A']  || 0,   lembur: false },
        ];

        dataRows.forEach((row, rIdx) => {
          const r = rIdx + 2;
          grid[r][colA] = { v: row.label, s: row.lembur ? styleLabelLembur : styleLabelNormal };
          grid[r][colB] = { v: row.value, t: 'n', s: row.lembur ? styleValueLembur : styleValueNormal };
        });
      });

      const ws: any = {};
      const range = { s: { r: 0, c: 0 }, e: { r: ROWS_PER_CARD - 1, c: tafts.length * BLOCK - 1 } };

      for (let r = 0; r < ROWS_PER_CARD; r++) {
        for (let c = 0; c < tafts.length * BLOCK; c++) {
          const cell = grid[r][c];
          if (cell !== null && cell !== undefined) {
            const addr = XLSX.utils.encode_cell({ r, c });
            ws[addr] = { v: cell.v ?? '', t: cell.t || 's', s: cell.s };
          }
        }
      }

      ws['!ref'] = XLSX.utils.encode_range(range);
      ws['!merges'] = [];
      tafts.forEach((_, tIdx) => {
        const colA = tIdx * BLOCK;
        const colB = tIdx * BLOCK + 1;
        ws['!merges'].push({ s: { r: 0, c: colA }, e: { r: 0, c: colB } });
      });

      const colWidths: any[] = [];
      tafts.forEach(() => {
        colWidths.push({ wch: 32 });
        colWidths.push({ wch: 10 });
        colWidths.push({ wch: 2  });
      });
      ws['!cols'] = colWidths;
      ws['!rows'] = [{ hpt: 30 }, { hpt: 20 }, ...Array(7).fill({ hpt: 18 })];

      const sheetName = storeName.replace(/[\\\/?*\[\]:']/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `recap_absen_${selectedMonth}.xlsx`);
  };

  const recapStoreGroups: { storeName: string; tafts: TaftEntry[] }[] = [];
  const seenS = new Set<string>();
  recapTafts.forEach(t => {
    if (!seenS.has(t.store_name)) {
      seenS.add(t.store_name);
      recapStoreGroups.push({ storeName: t.store_name, tafts: [] });
    }
    recapStoreGroups.find(g => g.storeName === t.store_name)!.tafts.push(t);
  });

  return (
    <div>
      {user.attendance_report && (
        <div className="flex gap-0.5 bg-white rounded-lg p-0.5 shadow border border-gray-100 mb-3 w-fit">
          {(['import','recap'] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${subTab === t ? 'bg-primary text-white shadow-sm' : 'text-gray-900 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t === 'import' ? 'Import' : 'Recap'}
            </button>
          ))}
        </div>
      )}

      {subTab === 'import' && (
        <>
          <div className="bg-white rounded-lg shadow p-2.5 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isStoreUser ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-900">Store:</span>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{toTitleCase(myStoreName)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Store</label>
                  <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); }}
                    className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Semua Store</option>
                    {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <button onClick={() => setShowDownloadModal(true)} className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90">
                ↓ Template
              </button>
              <label className="px-3 py-1 bg-green-600 text-white rounded text-[11px] hover:bg-green-700 cursor-pointer">
                {importing ? 'Importing...' : '↑ Import'}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              </label>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3">
            <p className="text-[11px] font-semibold text-gray-700 mb-1.5">Panduan</p>
            <p className="text-[11px] text-gray-900 mb-2">Download template XLSX → isi kolom <strong>clock_in</strong>, <strong>clock_out</strong>, <strong>code_time</strong>, <strong>overtime_hours</strong>, <strong>reason</strong> → Import kembali.</p>
            <p className="text-[11px] text-gray-900 mb-2">Format jam: <code className="bg-gray-100 px-1 rounded">08:30</code> atau <code className="bg-gray-100 px-1 rounded">08.30</code> (titik otomatis dikonversi ke titik dua).</p>
            <div className="flex flex-wrap gap-1.5">
              {RECAP_KEYS.map(({ key, label }) => (
                <span key={key} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CODE_COLORS[key] || 'bg-gray-100'}`}>
                  {key} = {label.replace(/\s*\(.*\)/, '')}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'recap' && user.attendance_report && (
        <div>
          <div className="bg-white rounded-lg shadow p-2.5 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Store</label>
                <select value={recapStore} onChange={e => setRecapStore(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Semua Store</option>
                  {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <button onClick={fetchRecap} className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90">
                Refresh
              </button>
              <button
                onClick={exportRecapXlsx}
                disabled={recapLoading || recapStoreGroups.length === 0}
                className="px-3 py-1 bg-emerald-600 text-white rounded text-[11px] hover:bg-emerald-700 disabled:opacity-50"
              >
                ↓ Export XLSX
              </button>
            </div>
          </div>

          {recapLoading ? (
            <div className="text-center py-10 text-gray-900 text-sm">Memuat data...</div>
          ) : recapTafts.length === 0 ? (
            <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">Tidak ada data taft</div>
          ) : (
            <div className="space-y-4">
              {recapStoreGroups.map(({ storeName, tafts }) => (
                <div key={storeName}>
                  {!recapStore && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wide">{toTitleCase(storeName)}</span>
                      <span className="text-[10px] text-gray-900">{tafts.length} taft</span>
                      <div className="flex-1 h-px bg-primary/10" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {tafts.map(taft => {
                      const recap = calcRecap(taft);
                      const sd = parseInt(taft.start_date) || 26;
                      const ed = parseInt(taft.end_date)   || 25;
                      const { from, to } = buildTaftDateRange(selectedMonth, sd, ed);

                      const MONTH_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                      const fmtTgl = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;

                      const LIST_ROWS = [
                        { label: 'TOTAL MASUK KERJA', value: recap.totalMasuk,  cls: 'text-gray-800', bg: ''           },
                        { label: 'TOTAL OFF',          value: recap.totalOff,   cls: 'text-gray-800', bg: 'bg-red-200' },
                        { label: 'TOTAL JAM LEMBUR',   value: recap.totalLembur > 0 ? `${recap.totalLembur.toFixed(1)}` : 0, cls: 'text-gray-800', bg: 'bg-cyan-200' },
                        { label: 'TOTAL CUTI',         value: recap.counts['C']  || 0, cls: 'text-gray-800', bg: '' },
                        { label: 'TOTAL SAKIT',        value: recap.counts['+']  || 0, cls: 'text-gray-800', bg: '' },
                        { label: 'TOTAL IZIN',         value: recap.counts['I']  || 0, cls: 'text-gray-800', bg: '' },
                        { label: 'TOTAL ALPA',         value: recap.counts['A']  || 0, cls: 'text-gray-800', bg: '' },
                      ];

                      return (
                        <div key={taft.id} className="rounded-lg border border-gray-700 overflow-hidden text-[10px] shadow-sm">
                          <div className="bg-yellow-300 border-b border-gray-700 px-2 py-1 text-center">
                            <p className="font-black text-gray-900 uppercase text-[8px] leading-tight">
                              REKAPAN ABSEN {fmtTgl(from).toUpperCase()} - {fmtTgl(to).toUpperCase()}
                            </p>
                          </div>
                          <div className="bg-green-400 border-b border-gray-700 px-2 py-1 flex items-center justify-between">
                            <p className="font-black text-gray-900 uppercase text-[8px] leading-tight">
                              {toTitleCase(taft.taft_name)} / {toTitleCase(storeName)}
                            </p>
                            <p className="font-black text-gray-900 text-[9px] shrink-0 ml-1">TOTAL</p>
                          </div>
                          {LIST_ROWS.map((row, i) => (
                            <div
                              key={row.label}
                              className={`flex items-center justify-between px-2 py-1 border-b border-gray-200 last:border-b-0 ${row.bg || (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`}
                            >
                              <span className={`font-semibold uppercase text-[8px] ${row.bg ? 'text-blue-700 font-black' : 'text-gray-700'}`}>
                                {row.label}
                              </span>
                              <span className={`font-black text-[11px] ${row.bg ? 'text-blue-900' : 'text-gray-900'}`}>
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-bold text-primary mb-1">Download Template XLSX</h2>
            <p className="text-[11px] text-gray-900 mb-4">1 file berisi semua TAFT dalam store yang dipilih</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                {isStoreUser
                  ? <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900">{toTitleCase(myStoreName)}</div>
                  : <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Pilih Store</option>
                      {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                    </select>
                }
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {(() => {
                const storeForPreview = isStoreUser ? myStoreName : selectedStore;
                if (!storeForPreview) return null;
                const taftsForPreview = taftList.filter(t => t.store_name?.toLowerCase() === storeForPreview.toLowerCase());
                if (taftsForPreview.length === 0) return null;
                const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
                return (
                  <div className="bg-gray-50 rounded border border-gray-200 p-3 max-h-48 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-gray-900 mb-2">{taftsForPreview.length} sheet yang akan dibuat:</p>
                    {taftsForPreview.map(t => {
                      const sd = parseInt(t.start_date) || 26;
                      const ed = parseInt(t.end_date)   || 25;
                      const dates = buildTaftDates(selectedMonth, sd, ed);
                      const first = dates[0];
                      const last  = dates[dates.length - 1];
                      return (
                        <div key={t.id} className="flex items-center justify-between py-0.5 border-b border-gray-100 last:border-0">
                          <span className="text-[11px] text-gray-700 truncate max-w-[200px]" title={t.taft_name}>{t.taft_name}</span>
                          <span className="text-[10px] text-primary ml-2 whitespace-nowrap">{fmt(first)} – {fmt(last)} ({dates.length}h)</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDownloadModal(false)} className="flex-1 px-4 py-2 bg-gray-400 text-white rounded text-sm">Batal</button>
              <button
                onClick={handleDownloadTemplate}
                disabled={!(isStoreUser ? myStoreName : selectedStore)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />
    </div>
  );
}

// ─── SalesWagesChart (GANTI SELURUH KOMPONEN LAMA) ────────────────────────────
// Letakkan tepat menggantikan komponen SalesWagesChart yang lama di page.tsx

function SalesWagesChart({
  salesData,
  storeWages,
  taftList,
  selectedMonth,
  groupedByTaft,
}: {
  salesData: SalesStat[];
  storeWages: StoreWagesEntry[];
  taftList: TaftEntry[];
  selectedMonth: string;
  groupedByTaft: Record<string, { taft_name: string; store_name: string; rows: ReportRow[] }>;
}) {
  const [activeStore, setActiveStore] = useState<string | null>(null);

  if (salesData.length === 0 && storeWages.length === 0) return null;

  // ── helpers ──────────────────────────────────────────────────────────────────
  const wagesMap: Record<string, number> = {};
  storeWages.forEach(s => {
    wagesMap[s.store_name.toLowerCase()] = parseCurrencyStr(s.store_wages);
  });

  const taftCountMap: Record<string, number> = {};
  taftList.forEach(t => {
    const k = t.store_name.toLowerCase();
    taftCountMap[k] = (taftCountMap[k] || 0) + 1;
  });

  // Lembur per store dari groupedByTaft
  const lemburByStore: Record<string, number> = {};
  Object.values(groupedByTaft).forEach(({ store_name, rows }) => {
    const k = store_name.toLowerCase();
    rows.forEach(r => {
      if (r.overtime_hours && parseFloat(r.overtime_hours) > 0) {
        lemburByStore[k] = (lemburByStore[k] || 0) + parseFloat(r.overtime_hours);
      }
    });
  });

  const allStores = [...new Set([
    ...salesData.map(s => s.store_name.toLowerCase()),
    ...Object.keys(wagesMap),
  ])].sort();

  interface StoreRow {
    store: string;
    sales: number;
    gajiPerOrang: number;
    totalGaji: number;
    biayaLembur: number;
    totalPengeluaran: number;
    taftCount: number;
    lemburJam: number;
    profit: number;
    ratio: number;
  }

  const rows: StoreRow[] = allStores.map(store => {
    const salesRow      = salesData.find(s => s.store_name.toLowerCase() === store);
    const sales         = salesRow?.sales ?? 0;
    const gajiPerOrang  = wagesMap[store] || 0;
    const taftCount     = taftCountMap[store] || 0;
    const totalGaji     = gajiPerOrang * taftCount;
    const lemburJam     = lemburByStore[store] || 0;
    const biayaLembur   = lemburJam * OVERTIME_RATE;
    const totalPengeluaran = totalGaji + biayaLembur;
    const profit        = sales - totalPengeluaran;
    const ratio         = totalPengeluaran > 0 ? sales / totalPengeluaran : 0;
    return { store, sales, gajiPerOrang, totalGaji, biayaLembur, totalPengeluaran, taftCount, lemburJam, profit, ratio };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales        = rows.reduce((s, r) => s + r.sales, 0);
  const totalGaji         = rows.reduce((s, r) => s + r.totalGaji, 0);
  const totalBiayaLembur  = rows.reduce((s, r) => s + r.biayaLembur, 0);
  const totalPengeluaran  = totalGaji + totalBiayaLembur;
  const totalProfit       = totalSales - totalPengeluaran;

  const MONTH_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  const [, mm] = selectedMonth.split('-').map(Number);
  const monthLabel = MONTH_NAMES[mm] || selectedMonth;

  const fmtJt = (n: number) => {
    if (n === 0) return '—';
    if (Math.abs(n) >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(n) >= 1_000)     return `Rp${(n / 1_000).toFixed(0)}rb`;
    return `Rp${Math.round(n).toLocaleString('id-ID')}`;
  };

  const ratioColor = (r: number) =>
    r >= 3   ? 'text-emerald-600 bg-emerald-50'  :
    r >= 1.5 ? 'text-yellow-600 bg-yellow-50'    :
    r >  0   ? 'text-red-600 bg-red-50'           : 'text-gray-900 bg-gray-50';

  const profitColor = (n: number) => n >= 0 ? 'text-emerald-600' : 'text-red-500';

  // ── popup data ────────────────────────────────────────────────────────────────
  const activeRow    = rows.find(r => r.store === activeStore);
  const activeTafts  = taftList.filter(t => t.store_name.toLowerCase() === activeStore);

  interface TaftDetail {
    taft_name: string;
    gaji: number;
    lemburJam: number;
    biayaLembur: number;
    totalPengeluaran: number;
  }

  const taftDetails: TaftDetail[] = activeTafts.map(t => {
    const key     = `${t.store_name}__${t.taft_name}`;
    const entry   = groupedByTaft[key];
    const lemJam  = entry
      ? entry.rows.reduce((s, r) => s + (parseFloat(r.overtime_hours || '0') || 0), 0)
      : 0;
    const biaya   = lemJam * OVERTIME_RATE;
    const gaji    = wagesMap[t.store_name.toLowerCase()] || 0;
    return {
      taft_name:        t.taft_name,
      gaji,
      lemburJam:        lemJam,
      biayaLembur:      biaya,
      totalPengeluaran: gaji + biaya,
    };
  });

  return (
    <>
      {/* ── Summary header ─────────────────────────────────────────────────── */}
      <div className="mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <p className="text-xs font-bold text-gray-700 tracking-wide">
              Sales vs Pengeluaran — {monthLabel}
            </p>
          </div>
          {/* Global totals */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Total Sales',     val: totalSales,       cls: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Total Gaji',      val: totalGaji,        cls: 'text-orange-600 bg-orange-50 border-orange-100' },
              { label: 'Total Lembur',    val: totalBiayaLembur, cls: 'text-purple-600 bg-purple-50 border-purple-100' },
              { label: 'Net',             val: totalProfit,      cls: `${totalProfit >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}` },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`rounded-lg border px-3 py-1.5 text-center ${cls}`}>
                <p className="text-[8px] font-semibold uppercase opacity-70">{label}</p>
                <p className="text-[13px] font-black leading-tight">{fmtJt(val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cards grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {rows.map(r => {
            const isProfit = r.profit >= 0;
            return (
              <button
                key={r.store}
                onClick={() => setActiveStore(r.store)}
                className="text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-150 overflow-hidden group"
              >
                {/* Card header */}
                <div className="px-3 pt-2.5 pb-2 border-b border-gray-50">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="text-[11px] font-bold text-gray-800 capitalize truncate">{r.store}</p>
                    {r.ratio > 0 && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${ratioColor(r.ratio)}`}>
                        {r.ratio.toFixed(1)}×
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-900">{r.taftCount} TAFT</p>
                </div>

                {/* Card body — 4 rows */}
                <div className="px-3 py-2 space-y-1.5">
                  {/* Sales */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-900 font-medium">Sales</span>
                    <span className="text-[10px] font-bold text-blue-600">{fmtJt(r.sales)}</span>
                  </div>
                  {/* Gaji */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-900 font-medium">Gaji</span>
                    <span className="text-[10px] font-bold text-orange-500">{fmtJt(r.totalGaji)}</span>
                  </div>
                  {/* Lembur */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-900 font-medium">Lembur</span>
                    <span className="text-[10px] font-bold text-purple-500">
                      {r.biayaLembur > 0 ? fmtJt(r.biayaLembur) : '—'}
                    </span>
                  </div>
                  {/* Divider */}
                  <div className="border-t border-gray-100 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-gray-900 font-semibold">Net</span>
                      <span className={`text-[11px] font-black ${profitColor(r.profit)}`}>
                        {isProfit ? '+' : ''}{fmtJt(r.profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar: sales vs total pengeluaran */}
                <div className="px-3 pb-2.5">
                  <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    {r.sales > 0 && r.totalPengeluaran > 0 && (
                      <>
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-blue-400"
                          style={{ width: `${Math.min((r.sales / Math.max(r.sales, r.totalPengeluaran)) * 100, 100)}%` }}
                        />
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-orange-400 opacity-60"
                          style={{ width: `${Math.min((r.totalPengeluaran / Math.max(r.sales, r.totalPengeluaran)) * 100, 100)}%` }}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Hover hint */}
                <div className="px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-primary font-medium text-center">Lihat detail →</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Popup modal detail per TAFT ─────────────────────────────────────── */}
      {activeStore && activeRow && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveStore(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-black text-gray-900 capitalize">{activeStore}</p>
                <p className="text-[10px] text-gray-900">{activeRow.taftCount} TAFT · {monthLabel}</p>
              </div>
              <button
                onClick={() => setActiveStore(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-[11px] font-bold transition-colors"
              >✕</button>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
              {[
                { label: 'Sales',       val: activeRow.sales,           cls: 'text-blue-600'    },
                { label: 'Total Gaji',  val: activeRow.totalGaji,       cls: 'text-orange-500'  },
                { label: 'Biaya Lembur',val: activeRow.biayaLembur,     cls: 'text-purple-500'  },
                { label: 'Net',         val: activeRow.profit,          cls: profitColor(activeRow.profit) },
              ].map(({ label, val, cls }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-[8px] text-gray-900 uppercase font-semibold mb-0.5">{label}</p>
                  <p className={`text-[12px] font-black ${cls}`}>
                    {label === 'Net' && val >= 0 ? '+' : ''}{fmtJt(val)}
                  </p>
                </div>
              ))}
            </div>

            {/* Per-TAFT table */}
            <div className="overflow-y-auto flex-1">
              {taftDetails.length === 0 ? (
                <div className="py-10 text-center text-gray-900 text-sm">Tidak ada data TAFT</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                      <th className="px-5 py-2.5 text-left font-semibold text-gray-900 text-[9px] uppercase tracking-wide">TAFT</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-orange-400 text-[9px] uppercase tracking-wide">Gaji</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-purple-400 text-[9px] uppercase tracking-wide">Jam Lembur</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-purple-400 text-[9px] uppercase tracking-wide">Biaya Lembur</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-900 text-[9px] uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taftDetails.map((t, i) => (
                      <tr key={t.taft_name} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-5 py-2.5 font-medium text-gray-800">{t.taft_name}</td>
                        <td className="px-4 py-2.5 text-right text-orange-500 font-semibold">{fmtJt(t.gaji)}</td>
                        <td className="px-4 py-2.5 text-right text-purple-500 font-semibold">
                          {t.lemburJam > 0 ? `${t.lemburJam.toFixed(1)} jam` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-purple-500 font-semibold">
                          {t.biayaLembur > 0 ? fmtJt(t.biayaLembur) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700 font-bold">{fmtJt(t.totalPengeluaran)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer total */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-5 py-2.5 text-gray-700 text-[10px]">TOTAL</td>
                      <td className="px-4 py-2.5 text-right text-orange-600 text-[10px]">{fmtJt(activeRow.totalGaji)}</td>
                      <td className="px-4 py-2.5 text-right text-purple-600 text-[10px]">
                        {activeRow.lemburJam > 0 ? `${activeRow.lemburJam.toFixed(1)} jam` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-purple-600 text-[10px]">{fmtJt(activeRow.biayaLembur)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-900 text-[10px]">{fmtJt(activeRow.totalPengeluaran)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
              <p className="text-[9px] text-gray-900">
                Gaji/orang: <span className="font-semibold text-gray-900">{fmtJt(activeRow.gajiPerOrang)}</span>
                &nbsp;·&nbsp;Rate lembur: <span className="font-semibold text-gray-900">Rp17.500/jam</span>
              </p>
              <button
                onClick={() => setActiveStore(null)}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-semibold hover:bg-primary/90 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Report Dashboard ──────────────────────────────────────────────────────────
interface TaftStat {
  taft_name: string;
  store_name: string;
  masuk: number;
  off: number;
  cuti: number;
  lembur: number;
  sakit: number;
  izin: number;
  alpa: number;
}

type ChartKey = 'masuk' | 'lembur' | 'cuti' | 'off';

const CHART_CFGS = [
  { key: 'masuk'  as ChartKey, label: 'Terbanyak Masuk',  color: '#3b82f6', unit: 'hari',  textCls: 'text-blue-600',   bgCls: 'bg-blue-500'   },
  { key: 'lembur' as ChartKey, label: 'Terbanyak Lembur', color: '#f97316', unit: 'jam',   textCls: 'text-orange-600', bgCls: 'bg-orange-500' },
  { key: 'cuti'   as ChartKey, label: 'Terbanyak Cuti',   color: '#ec4899', unit: 'hari',  textCls: 'text-pink-600',   bgCls: 'bg-pink-500'   },
  { key: 'off'    as ChartKey, label: 'Terbanyak OFF',    color: '#ef4444', unit: 'hari',  textCls: 'text-red-600',    bgCls: 'bg-red-500'    },
] as const;

const DONUT_COLORS = [
  '#f97316','#fb923c','#fdba74','#fbbf24','#f59e0b',
  '#ef4444','#ec4899','#8b5cf6','#3b82f6','#22c55e',
];

function MiniBarChart({
  data, cfg, maxRows = 43,
}: {
  data: TaftStat[];
  cfg: typeof CHART_CFGS[number];
  maxRows?: number;
}) {
  const rows   = data.filter(s => s[cfg.key] > 0).slice(0, maxRows);
  const maxVal = rows[0]?.[cfg.key] || 1;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[10px] text-gray-900">
        Tidak ada data
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: '320px' }}>
      {rows.map((s, i) => {
        const val = s[cfg.key];
        const pct = Math.round((val / maxVal) * 100);
        return (
          <div key={`${s.store_name}__${s.taft_name}`} className="flex items-center gap-1.5">
            <span className={`text-[8px] font-black w-3.5 text-right shrink-0 ${i === 0 ? cfg.textCls : 'text-gray-900'}`}>
              {i + 1}
            </span>
            <div className="w-28 shrink-0">
              <p className="text-[9px] font-medium text-gray-700 leading-tight" title={s.taft_name}>
                {truncName(s.taft_name, 15)}
              </p>
              <p className="text-[8px] text-gray-900">{toTitleCase(s.store_name)}</p>
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: cfg.color }}
              />
            </div>
            <span className={`text-[9px] font-bold shrink-0 w-6 text-right ${cfg.textCls}`}>
              {cfg.key === 'lembur' ? val.toFixed(1) : val}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReportDashboard({
  groupedByTaft,
}: {
  groupedByTaft: Record<string, { taft_name: string; store_name: string; rows: ReportRow[] }>;
}) {
  const stats: TaftStat[] = Object.values(groupedByTaft).map(({ taft_name, store_name, rows }) => {
    let masuk = 0, off = 0, cuti = 0, lembur = 0, sakit = 0, izin = 0, alpa = 0;
    rows.forEach(r => {
      const code = r.code_time?.trim();
      if (['P','S','F','MF','M'].includes(code)) masuk++;
      if (code === 'O') off++;
      if (code === 'C') cuti++;
      if (code === '+') sakit++;
      if (code === 'I') izin++;
      if (code === 'A') alpa++;
      if (r.overtime_hours && parseFloat(r.overtime_hours) > 0) lembur += parseFloat(r.overtime_hours);
    });
    return { taft_name, store_name, masuk, off, cuti, lembur, sakit, izin, alpa };
  });

  const sorted = (key: ChartKey) => [...stats].sort((a, b) => b[key] - a[key]);

  const top10Lembur = [...stats]
    .filter(s => s.lembur > 0)
    .sort((a, b) => b.lembur - a.lembur)
    .slice(0, 10);

  const totalLemburJam    = stats.reduce((s, d) => s + d.lembur, 0);
  const totalBiayaLembur  = totalLemburJam * OVERTIME_RATE;

  const donutLemburData = {
    labels: top10Lembur.map(s => truncName(s.taft_name, 15)),
    datasets: [{
      data: top10Lembur.map(s => parseFloat(s.lembur.toFixed(1))),
      backgroundColor: DONUT_COLORS,
      borderWidth: 1,
      borderColor: '#ffffff',
    }],
  };

  const allRows = Object.values(groupedByTaft).flatMap(g => g.rows);
  const codeCounts: Record<string, number> = {};
  allRows.forEach(r => {
    const c = r.code_time?.trim();
    if (c) codeCounts[c] = (codeCounts[c] || 0) + 1;
  });

  const shiftOrder = ['P','S','F','MF','M','O','C','+','I','A'];
  const shiftColors: Record<string,string> = {
    P:'#3b82f6', S:'#eab308', F:'#22c55e', MF:'#8b5cf6',
    M:'#f97316', O:'#ef4444', C:'#ec4899', '+':'#f97316',
    I:'#6366f1', A:'#b91c1c',
  };
  const shiftLabels    = shiftOrder.filter(k => codeCounts[k] > 0);
  const shiftValues    = shiftLabels.map(k => codeCounts[k]);
  const shiftBgColors  = shiftLabels.map(k => shiftColors[k] || '#9ca3af');

  const barShiftData = {
    labels: shiftLabels,
    datasets: [{ data: shiftValues, backgroundColor: shiftBgColors, borderWidth: 0 }],
  };

  const storeMap: Record<string, { masuk: number; off: number }> = {};
  stats.forEach(s => {
    if (!storeMap[s.store_name]) storeMap[s.store_name] = { masuk: 0, off: 0 };
    storeMap[s.store_name].masuk += s.masuk;
    storeMap[s.store_name].off   += s.off;
  });
  const storeEntries = Object.entries(storeMap)
    .sort((a, b) => (b[1].masuk + b[1].off) - (a[1].masuk + a[1].off))
    .slice(0, 8);

  const barStoreData = {
    labels: storeEntries.map(([name]) => toTitleCase(name)),
    datasets: [
      { label: 'Masuk', data: storeEntries.map(([,v]) => v.masuk), backgroundColor: '#3b82f6', borderWidth: 0 },
      { label: 'Off',   data: storeEntries.map(([,v]) => v.off),   backgroundColor: '#ef4444', borderWidth: 0 },
    ],
  };

  const top8Lembur = [...stats]
    .filter(s => s.lembur > 0)
    .sort((a, b) => b.lembur - a.lembur)
    .slice(0, 8);

  const barBiayaData = {
    labels: top8Lembur.map(s => truncName(s.taft_name, 13)),
    datasets: [{ data: top8Lembur.map(s => Math.round(s.lembur * OVERTIME_RATE)), backgroundColor: '#f97316', borderWidth: 0 }],
  };

  const top8Absen = [...stats]
    .filter(s => s.cuti + s.sakit + s.izin + s.alpa > 0)
    .sort((a, b) => (b.cuti + b.sakit + b.izin + b.alpa) - (a.cuti + a.sakit + a.izin + a.alpa))
    .slice(0, 8);

  const barAbsenData = {
    labels: top8Absen.map(s => truncName(s.taft_name, 13)),
    datasets: [
      { label: 'Cuti',  data: top8Absen.map(s => s.cuti),  backgroundColor: '#ec4899', borderWidth: 0 },
      { label: 'Sakit', data: top8Absen.map(s => s.sakit), backgroundColor: '#f97316', borderWidth: 0 },
      { label: 'Izin',  data: top8Absen.map(s => s.izin),  backgroundColor: '#6366f1', borderWidth: 0 },
      { label: 'Alpa',  data: top8Absen.map(s => s.alpa),  backgroundColor: '#b91c1c', borderWidth: 0 },
    ],
  };

  const chartBaseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {CHART_CFGS.map(cfg => {
          const top = sorted(cfg.key).find(s => s[cfg.key] > 0);
          return (
            <div key={cfg.key} className="bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2">
              <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${cfg.textCls}`}>{cfg.label}</p>
              {top ? (
                <>
                  <p className="text-[11px] font-bold text-gray-800 leading-tight" title={top.taft_name}>
                    {truncName(top.taft_name, 18)}
                  </p>
                  <p className="text-[9px] text-gray-900">{toTitleCase(top.store_name)}</p>
                  <p className={`text-lg font-black leading-none mt-1 ${cfg.textCls}`}>
                    {cfg.key === 'lembur' ? top[cfg.key].toFixed(1) : top[cfg.key]}
                    <span className="text-[9px] font-normal ml-0.5 text-gray-900">{cfg.unit}</span>
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-gray-900">—</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {CHART_CFGS.map(cfg => (
          <div key={cfg.key} className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-[10px] font-bold uppercase tracking-wide ${cfg.textCls}`}>{cfg.label}</h3>
              <span className="text-[9px] text-gray-900">{sorted(cfg.key).filter(s => s[cfg.key] > 0).length}</span>
            </div>
            <MiniBarChart data={sorted(cfg.key)} cfg={cfg} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-2">Distribusi lembur per TAFT</p>
          {top10Lembur.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-900">Tidak ada data lembur</div>
          ) : (
            <>
              <div style={{ position: 'relative', height: '160px' }}>
                <Doughnut
                  data={donutLemburData}
                  options={{
                    ...chartBaseOptions,
                    cutout: '60%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const jam = ctx.raw as number;
                            return [`${ctx.label}: ${jam.toFixed(1)} jam`, `Biaya: ${fmtRupiah(jam * OVERTIME_RATE)}`];
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
                {top10Lembur.map((s, i) => (
                  <span key={s.taft_name} className="flex items-center gap-1 text-[8px] text-gray-900">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    {truncName(s.taft_name, 12)} <span className="font-bold text-gray-700">{s.lembur.toFixed(1)}j</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] text-gray-900">Total jam lembur</p>
                <p className="text-[13px] font-bold text-orange-500">{totalLemburJam.toFixed(1)} jam</p>
                <p className="text-[9px] text-gray-900 mt-0.5">Estimasi biaya lembur</p>
                <p className="text-[13px] font-bold text-orange-600">{fmtRupiah(totalBiayaLembur)}</p>
                <p className="text-[8px] text-gray-900 mt-0.5">@ Rp 17.500/jam</p>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-900 mb-2">Distribusi kode shift</p>
          {shiftLabels.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-900">Tidak ada data</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 mb-2">
                {shiftLabels.map((k, i) => (
                  <span key={k} className="flex items-center gap-1 text-[8px] text-gray-900">
                    <span className="w-2 h-2 rounded-sm" style={{ background: shiftBgColors[i] }} />
                    {k}
                  </span>
                ))}
              </div>
              <div style={{ position: 'relative', height: '160px' }}>
                <Bar data={barShiftData} options={{ ...chartBaseOptions, scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 9 }, stepSize: 1 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} hari` } } } }} />
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-900 mb-2">Masuk vs Off per toko</p>
          <div className="flex gap-3 mb-2">
            <span className="flex items-center gap-1 text-[8px] text-gray-900"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Masuk</span>
            <span className="flex items-center gap-1 text-[8px] text-gray-900"><span className="w-2 h-2 rounded-sm bg-red-500" /> Off</span>
          </div>
          <div style={{ position: 'relative', height: '160px' }}>
            <Bar data={barStoreData} options={{ ...chartBaseOptions, scales: { x: { ticks: { font: { size: 8 }, maxRotation: 30 } }, y: { ticks: { font: { size: 9 }, stepSize: 5 } } }, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1">Top 8 biaya lembur</p>
          <p className="text-[8px] text-gray-900 mb-2">@ Rp 17.500/jam</p>
          {top8Lembur.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-900">Tidak ada data</div>
          ) : (
            <div style={{ position: 'relative', height: `${top8Lembur.length * 30 + 20}px` }}>
              <Bar
                data={barBiayaData}
                options={{
                  ...chartBaseOptions,
                  indexAxis: 'y' as const,
                  scales: {
                    x: { ticks: { font: { size: 8 }, callback: (v: number | string) => { const n = Number(v); return n >= 1000000 ? `Rp ${(n/1000000).toFixed(1)}jt` : `Rp ${(n/1000).toFixed(0)}rb`; } } },
                    y: { ticks: { font: { size: 9 } } },
                  },
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmtRupiah(ctx.raw as number) } } },
                }}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-900 mb-1">Ketidakhadiran per TAFT</p>
          <div className="flex gap-3 mb-2">
            {[{ label:'Cuti',color:'#ec4899'},{ label:'Sakit',color:'#f97316'},{ label:'Izin',color:'#6366f1'},{ label:'Alpa',color:'#b91c1c'}].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1 text-[8px] text-gray-900">
                <span className="w-2 h-2 rounded-sm" style={{ background: color }} />{label}
              </span>
            ))}
          </div>
          {top8Absen.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-900">Tidak ada data absensi</div>
          ) : (
            <div style={{ position: 'relative', height: `${top8Absen.length * 30 + 20}px` }}>
              <Bar data={barAbsenData} options={{ ...chartBaseOptions, indexAxis: 'y' as const, scales: { x: { stacked: true, ticks: { font: { size: 9 }, stepSize: 1 } }, y: { stacked: true, ticks: { font: { size: 9 } } } }, plugins: { legend: { display: false } } }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Full Report ───────────────────────────────────────────────────────────────
function FullReport({ user }: { user: any }) {
  const [taftList,      setTaftList]      = useState<TaftEntry[]>([]);
  const [allStores,     setAllStores]     = useState<string[]>([]);
  const [dateList,      setDateList]      = useState<DateEntry[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedTaft,  setSelectedTaft]  = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [selectedDateRange, setSelectedDateRange] = useState('');
  const [reports,       setReports]       = useState<ReportRow[]>([]);
  const [schedules,     setSchedules]     = useState<ScheduleRow[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [viewMode,      setViewMode]      = useState<'monthly'|'weekly'>('monthly');
  const [expandedTafts, setExpandedTafts] = useState<Set<string>>(new Set());

  // ── NEW: sales & wages state ──────────────────────────────────────────────
  const [storeWages, setStoreWages] = useState<StoreWagesEntry[]>([]);
  const [salesData,  setSalesData]  = useState<SalesStat[]>([]);

  useEffect(() => {
    fetch('/api/attendance/meta?type=all').then(r => r.json()).then(data => {
      setTaftList(data.taftList || []);
      setDateList(data.dateList || []);
      setStoreWages(data.storeList || []); // storeList now includes store_wages column
      const stores = [...new Set((data.taftList || []).map((t: TaftEntry) => t.store_name))] as string[];
      setAllStores(stores);
    });
  }, []);

  useEffect(() => {
    if (selectedMonth && viewMode === 'monthly') fetchReports();
  }, [selectedStore, selectedTaft, selectedMonth, viewMode]);

  useEffect(() => {
    if (selectedDateRange && viewMode === 'weekly') fetchSchedules();
  }, [selectedDateRange, viewMode]);

  const fetchReports = async () => {
    setLoading(true);
    const storeParam = selectedStore ? `&store_name=${encodeURIComponent(selectedStore)}` : '';
    const taftParam  = selectedTaft  ? `&taft_name=${encodeURIComponent(selectedTaft)}`   : '';
    const [reportRes, salesRes] = await Promise.all([
      fetch(`/api/attendance/report?month=${selectedMonth}${storeParam}${taftParam}`),
      fetch(`/api/attendance/sales?month=${selectedMonth}`),
    ]);
    setReports(await reportRes.json());
    setSalesData(await salesRes.json());
    setLoading(false);
  };

  const fetchSchedules = async () => {
    setLoading(true);
    const storeParam = selectedStore ? `&store_name=${encodeURIComponent(selectedStore)}` : '';
    const res = await fetch(`/api/attendance/schedule?date_range=${encodeURIComponent(selectedDateRange)}${storeParam}`);
    setSchedules(await res.json());
    setLoading(false);
  };

  const filteredTafts = selectedStore
    ? taftList.filter(t => t.store_name?.toLowerCase() === selectedStore.toLowerCase())
    : taftList;

  const groupedByTaft = filteredTafts.reduce((acc, taft) => {
    if (selectedTaft && taft.taft_name !== selectedTaft) return acc;
    const key = `${taft.store_name}__${taft.taft_name}`;
    const sd = parseInt(taft.start_date) || 26;
    const ed = parseInt(taft.end_date)   || 25;
    const { from, to } = buildTaftDateRange(selectedMonth, sd, ed);
    const rows = reports.filter(r => {
      if (r.taft_name !== taft.taft_name || r.store_name !== taft.store_name) return false;
      const d = parseDateSafe(r.date);
      return d && d >= from && d <= to;
    });
    acc[key] = { taft_name: taft.taft_name, store_name: taft.store_name, rows };
    return acc;
  }, {} as Record<string, { taft_name: string; store_name: string; rows: ReportRow[] }>);

  const toggleTaft   = (key: string) => {
    setExpandedTafts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll   = () => setExpandedTafts(new Set(Object.keys(groupedByTaft)));
  const collapseAll = () => setExpandedTafts(new Set());

  const exportReportXlsx = () => {
    if (Object.keys(groupedByTaft).length === 0) return;
    const wb = XLSX.utils.book_new();

    const borderAll = {
      top:    { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left:   { style: 'thin', color: { rgb: '000000' } },
      right:  { style: 'thin', color: { rgb: '000000' } },
    };

    const sTitle = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sHeader = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'D9D9D9' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: borderAll };
    const sDataCenter = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sDataLeft = { font: { sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryLabel = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryValue = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sSummaryLabelLembur = { font: { bold: true, sz: 10, color: { rgb: '0070C0' } }, fill: { fgColor: { rgb: '00B0F0' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryValueLembur = { font: { bold: true, sz: 10, color: { rgb: '0070C0' } }, fill: { fgColor: { rgb: '00B0F0' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sTotalLabel = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'FFC000' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sTotalValue = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'FFC000' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };

    const mkCell = (v: any, s: any, t?: string) => ({ v, t: t || (typeof v === 'number' ? 'n' : 's'), s });
    const emptyBorder = { v: '', s: { border: borderAll } };

    for (const [, { taft_name, store_name, rows }] of Object.entries(groupedByTaft)) {
      const sortedRows = [...rows].sort((a, b) => {
        const da = parseDateSafe(a.date);
        const db = parseDateSafe(b.date);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
      });

      const taftInfo = taftList.find(t => t.taft_name === taft_name && t.store_name === store_name);
      const sd = parseInt(taftInfo?.start_date || '26');
      const ed = parseInt(taftInfo?.end_date   || '25');
      const { from, to } = buildTaftDateRange(selectedMonth, sd, ed);
      const fmtTglLong = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${MONTH_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;

      const ws: any = {};
      let r = 0;

      const setRow = (cols: any[]) => {
        cols.forEach((cell, c) => { if (cell !== null) ws[XLSX.utils.encode_cell({ r, c })] = cell; });
        r++;
      };

      setRow([mkCell(`ABSEN IN OUT ${taft_name.toUpperCase()}`, sTitle), mkCell('', sTitle), mkCell('', sTitle), mkCell('', sTitle), mkCell('', sTitle), mkCell('', sTitle)]);
      r++;
      setRow([mkCell('TGL', sHeader), mkCell('IN', sHeader), mkCell('OUT', sHeader), mkCell('SHIFT', sHeader), mkCell('OVERTIME / LEMBUR BERAPA JAM', sHeader), mkCell('KETERANGAN', sHeader)]);

      for (const row of sortedRows) {
        const d = parseDateSafe(row.date);
        const tglStr = d ? `${String(d.getDate()).padStart(2,'0')}-${MONTH_SHORT_ID[d.getMonth()]}-${String(d.getFullYear()).slice(2)}` : row.date;
        const code  = row.code_time?.trim() || '';
        const isOff = code === 'O';
        const ot    = row.overtime_hours && parseFloat(row.overtime_hours) > 0 ? parseFloat(row.overtime_hours) : '';
        setRow([
          mkCell(tglStr, sDataCenter),
          mkCell(isOff ? '-' : (row.clock_in  || '-'), sDataCenter),
          mkCell(isOff ? '-' : (row.clock_out || '-'), sDataCenter),
          mkCell(code, sDataCenter),
          ot !== '' ? mkCell(ot, sDataCenter, 'n') : mkCell('', sDataCenter),
          mkCell(row.reason || '', sDataLeft),
        ]);
      }

      r++; r++;

      const codeCounts: Record<string, number> = {};
      let totalMasuk = 0, totalOff = 0, totalLembur = 0;
      sortedRows.forEach(row => {
        const c = row.code_time?.trim();
        if (c) codeCounts[c] = (codeCounts[c] || 0) + 1;
        if (['P','S','F','MF','M'].includes(c)) totalMasuk++;
        if (c === 'O') totalOff++;
        if (row.overtime_hours && parseFloat(row.overtime_hours) > 0) totalLembur += parseFloat(row.overtime_hours);
      });

      const summaryRows = [
        { label: 'PAGI ( P )',        value: codeCounts['P']  || 0 },
        { label: 'SIANG ( S )',       value: codeCounts['S']  || 0 },
        { label: 'OFF ( O )',         value: codeCounts['O']  || 0 },
        { label: 'FULL ( F )',        value: codeCounts['F']  || 0 },
        { label: 'MIDLE ( M )',       value: codeCounts['M']  || 0 },
        { label: 'MIDLE FULL ( MF )', value: codeCounts['MF'] || 0 },
        { label: 'CUTI ( C )',        value: codeCounts['C']  || 0 },
        { label: 'SAKIT ( + )',       value: codeCounts['+']  || 0 },
        { label: 'IZIN ( I )',        value: codeCounts['I']  || 0 },
        { label: 'ALPA ( A )',        value: codeCounts['A']  || 0 },
      ];

      summaryRows.forEach(({ label, value }) => {
        setRow([mkCell(label, sSummaryLabel), mkCell('', emptyBorder.s), mkCell('', emptyBorder.s), mkCell(value, sSummaryValue, 'n'), mkCell('', { border: borderAll }), mkCell('', { border: borderAll })]);
      });

      r++;

      const totalRows = [
        { label: 'TOTAL MASUK KERJA', value: totalMasuk,                         lembur: false },
        { label: 'TOTAL OFF',         value: totalOff,                           lembur: false },
        { label: 'TOTAL JAM LEMBUR',  value: parseFloat(totalLembur.toFixed(1)), lembur: true  },
        { label: 'TOTAL CUTI',        value: codeCounts['C']  || 0,              lembur: false },
        { label: 'TOTAL SAKIT',       value: codeCounts['+']  || 0,              lembur: false },
        { label: 'TOTAL IZIN',        value: codeCounts['I']  || 0,              lembur: false },
        { label: 'TOTAL ALPA',        value: codeCounts['A']  || 0,              lembur: false },
      ];

      totalRows.forEach(({ label, value, lembur }) => {
        setRow([mkCell(label, lembur ? sSummaryLabelLembur : sTotalLabel), mkCell('', lembur ? sSummaryLabelLembur : sTotalLabel), mkCell('', lembur ? sSummaryLabelLembur : sTotalLabel), mkCell(value, lembur ? sSummaryValueLembur : sTotalValue, 'n'), mkCell('', { border: borderAll }), mkCell('', { border: borderAll })]);
      });

      r++;
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: `Periode: ${fmtTglLong(from)} - ${fmtTglLong(to)}`, s: { font: { italic: true, sz: 9 }, alignment: { horizontal: 'left' } } };
      r++;
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: `${taft_name} / ${store_name}`, s: { font: { bold: true, sz: 9 } } };

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r, c: 5 } });
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

      const summaryStartRow = sortedRows.length + 5;
      for (let i = 0; i < summaryRows.length; i++) {
        ws['!merges'].push({ s: { r: summaryStartRow + i, c: 0 }, e: { r: summaryStartRow + i, c: 2 } });
      }
      const totalStartRow = summaryStartRow + summaryRows.length + 1;
      for (let i = 0; i < totalRows.length; i++) {
        ws['!merges'].push({ s: { r: totalStartRow + i, c: 0 }, e: { r: totalStartRow + i, c: 2 } });
      }

      ws['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 40 }];
      ws['!rows'] = [{ hpt: 22 }];

      const rawName   = `${taft_name} - ${store_name}`;
      const sheetName = rawName.replace(/[\\\/?*\[\]:']/g, '_').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `report_absen_${selectedMonth}.xlsx`);
  };

  const todayDay    = new Date().getDay();
  const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];
  const weeklyTafts = filteredTafts;

  return (
    <div>
      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
              Tampilan
            </label>
            <div className="flex gap-0.5 bg-gray-100 rounded p-0.5 ml-1">
              {(["monthly", "weekly"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setViewMode(m);
                    setReports([]);
                    setSchedules([]);
                    setExpandedTafts(new Set());
                    setSalesData([]);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === m ? "bg-white text-primary shadow-sm" : "text-gray-900 hover:text-gray-700"}`}
                >
                  {m === "monthly" ? "Monthly" : "Weekly"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
              Store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                setSelectedTaft("");
                setExpandedTafts(new Set());
              }}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Semua Store</option>
              {allStores.map((s) => (
                <option key={s} value={s}>
                  {toTitleCase(s)}
                </option>
              ))}
            </select>
          </div>

          {viewMode === "monthly" && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
                  TAFT
                </label>
                <select
                  value={selectedTaft}
                  onChange={(e) => {
                    setSelectedTaft(e.target.value);
                    setExpandedTafts(new Set());
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Semua TAFT</option>
                  {filteredTafts.map((t) => (
                    <option key={t.id} value={t.taft_name}>
                      {t.taft_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
                  Bulan
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}

          {viewMode === "weekly" && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">
                Periode
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Pilih Periode</option>
                {dateList.map((d) => (
                  <option key={d.id} value={d.date_range}>
                    {d.date_range}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={viewMode === "monthly" ? fetchReports : fetchSchedules}
            className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90"
          >
            Tampilkan
          </button>

          {viewMode === "monthly" && Object.keys(groupedByTaft).length > 0 && (
            <button
              onClick={exportReportXlsx}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-[11px] hover:bg-emerald-700"
            >
              ↓ Export XLSX
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-900 text-sm">
          Memuat data...
        </div>
      )}

      {/* Sales vs Wages Chart — tampil di monthly view */}
      {!loading &&
        viewMode === "monthly" &&
        (salesData.length > 0 || storeWages.length > 0) && (
          <SalesWagesChart
            salesData={salesData}
            storeWages={storeWages}
            taftList={filteredTafts.length > 0 ? filteredTafts : taftList}
            selectedMonth={selectedMonth}
            groupedByTaft={groupedByTaft}
          />
        )}

      {/* Dashboard analitik */}
      {!loading &&
        viewMode === "monthly" &&
        Object.keys(groupedByTaft).length > 0 && (
          <ReportDashboard groupedByTaft={groupedByTaft} />
        )}

      {/* Monthly View — detail per TAFT */}
      {!loading &&
        viewMode === "monthly" &&
        Object.keys(groupedByTaft).length > 0 &&
        (() => {
          const DAY_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
          const MONTH_SHORT = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "Mei",
            "Jun",
            "Jul",
            "Agu",
            "Sep",
            "Okt",
            "Nov",
            "Des",
          ];
          const fmtDate = (iso: string) => {
            const d = parseDateSafe(iso);
            if (!d) return iso;
            return `${DAY_ID[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTH_SHORT[d.getMonth()]}`;
          };
          const isWeekend = (iso: string) => {
            const d = parseDateSafe(iso);
            return d ? d.getDay() === 0 || d.getDay() === 6 : false;
          };
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-900 font-medium">
                  {Object.keys(groupedByTaft).length} TAFT
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={expandAll}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors font-medium"
                  >
                    Buka Semua
                  </button>
                  <button
                    onClick={collapseAll}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors font-medium"
                  >
                    Tutup Semua
                  </button>
                </div>
              </div>

              {Object.entries(groupedByTaft).map(
                ([key, { taft_name, store_name, rows }]) => {
                  const isExpanded = expandedTafts.has(key);
                  const codeCounts: Record<string, number> = {};
                  let totalMasuk = 0,
                    totalLembur = 0;
                  rows.forEach((r) => {
                    const c = r.code_time?.trim();
                    if (c) codeCounts[c] = (codeCounts[c] || 0) + 1;
                    if (["P", "S", "F", "MF", "M"].includes(c)) totalMasuk++;
                    if (r.overtime_hours && parseFloat(r.overtime_hours) > 0)
                      totalLembur += parseFloat(r.overtime_hours);
                  });

                  return (
                    <div
                      key={key}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleTaft(key)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isExpanded ? "bg-primary text-white" : "bg-gray-100 text-gray-900"}`}
                          >
                            <span
                              className={`text-[9px] font-black transition-transform duration-200 inline-block ${isExpanded ? "rotate-180" : ""}`}
                            >
                              ▼
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-900">
                                {taft_name}
                              </span>
                              {!selectedStore && (
                                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                  {toTitleCase(store_name)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-gray-900">
                                {rows.length} hari data
                              </span>
                              {totalMasuk > 0 && (
                                <span className="text-[10px] text-blue-600 font-semibold">
                                  {totalMasuk} masuk
                                </span>
                              )}
                              {totalLembur > 0 && (
                                <span className="text-[10px] text-orange-500 font-semibold">
                                  {totalLembur.toFixed(1)}j lembur
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                            {RECAP_KEYS.map(({ key: k }) => {
                              const cnt = codeCounts[k] || 0;
                              if (!cnt) return null;
                              return (
                                <span
                                  key={k}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${CODE_COLORS[k] || "bg-gray-100 text-gray-900"}`}
                                >
                                  {k} {cnt}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {rows.length === 0 ? (
                            <div className="px-6 py-6 text-center text-[11px] text-gray-900">
                              Belum ada data untuk periode ini
                            </div>
                          ) : (
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-36">
                                    Tanggal
                                  </th>
                                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">
                                    Kode
                                  </th>
                                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">
                                    Masuk
                                  </th>
                                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">
                                    Keluar
                                  </th>
                                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-16">
                                    Lembur
                                  </th>
                                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-900 uppercase tracking-wide">
                                    Keterangan
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r, i) => {
                                  const weekend = isWeekend(r.date);
                                  const code = r.code_time?.trim();
                                  const isOff = code === "O";
                                  const hasOT =
                                    r.overtime_hours &&
                                    parseFloat(r.overtime_hours) > 0;
                                  return (
                                    <tr
                                      key={i}
                                      className={`border-b border-gray-50 last:border-0 transition-colors ${weekend ? "bg-blue-50/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} hover:bg-primary/5`}
                                    >
                                      <td className="px-4 py-2">
                                        <span
                                          className={`text-[11px] font-medium ${weekend ? "text-blue-600" : "text-gray-700"}`}
                                        >
                                          {fmtDate(r.date)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {code ? (
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${CODE_COLORS[code] || "bg-gray-100 text-gray-900"}`}
                                          >
                                            {code}
                                          </span>
                                        ) : (
                                          <span className="text-gray-900 text-xs">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span
                                          className={`text-[11px] font-mono font-medium ${isOff ? "text-gray-900" : "text-gray-700"}`}
                                        >
                                          {displayTime(r.clock_in) ||
                                            (isOff ? "—" : "-")}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span
                                          className={`text-[11px] font-mono font-medium ${isOff ? "text-gray-900" : "text-gray-700"}`}
                                        >
                                          {displayTime(r.clock_out) ||
                                            (isOff ? "—" : "-")}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {hasOT ? (
                                          <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                                            {r.overtime_hours}j
                                          </span>
                                        ) : (
                                          <span className="text-gray-900 text-xs">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="text-[11px] text-gray-900 truncate block max-w-[220px]">
                                          {r.reason || ""}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          );
        })()}

      {!loading &&
        viewMode === "monthly" &&
        Object.keys(groupedByTaft).length === 0 &&
        salesData.length === 0 &&
        storeWages.length === 0 && (
          <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">
            Pilih bulan untuk melihat data
          </div>
        )}

      {/* Weekly View */}
      {!loading &&
        viewMode === "weekly" &&
        (selectedDateRange ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-[11px] min-w-[150px]">
                    Nama TAFT
                  </th>
                  {!selectedStore && (
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 text-[11px] min-w-[110px]">
                      Store
                    </th>
                  )}
                  {DAY_LABELS_FULL.map((label, i) => (
                    <th
                      key={label}
                      className={`px-2 py-2 text-center font-semibold text-gray-700 text-[11px] min-w-[56px] ${DAYS[i] === todayDayKey ? "bg-blue-50" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyTafts.map((taft) => {
                  const sched = schedules.find(
                    (s) =>
                      s.taft_name === taft.taft_name &&
                      s.store_name === taft.store_name &&
                      s.date_range === selectedDateRange,
                  );
                  return (
                    <tr key={taft.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium text-gray-800 text-[11px]">
                        {taft.taft_name}
                      </td>
                      {!selectedStore && (
                        <td className="px-3 py-1.5 text-gray-900 text-[10px]">
                          {toTitleCase(taft.store_name)}
                        </td>
                      )}
                      {DAYS.map((d, i) => {
                        const code =
                          (sched?.[d as keyof ScheduleRow] as string) || "";
                        return (
                          <td
                            key={d}
                            className={`px-2 py-1.5 text-center ${DAYS[i] === todayDayKey ? "bg-blue-50" : ""}`}
                          >
                            {code ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${CODE_COLORS[code] || "bg-gray-100 text-gray-700"}`}
                              >
                                {code}
                              </span>
                            ) : (
                              <span className="text-gray-900 text-[10px]">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {weeklyTafts.length === 0 && (
                  <tr>
                    <td
                      colSpan={!selectedStore ? 9 : 8}
                      className="px-3 py-8 text-center text-gray-900 text-sm"
                    >
                      Tidak ada data taft
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">
            Pilih periode minggu untuk melihat jadwal
          </div>
        ))}
    </div>
  );
}