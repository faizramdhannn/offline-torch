"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";

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
interface ReportRow {
  date: string; store_name: string; taft_name: string;
  clock_in: string; clock_out: string; code_time: string;
  overtime_hours: string; reason: string;
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

// ── Parse DD/MM/YYYY or YYYY-MM-DD safely ─────────────────────────────────────
function parseDateSafe(str: string): Date | null {
  if (!str) return null;
  // DD/MM/YYYY
  const dmY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  // fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: find current date_range from dateList
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

  // Fallback: use last entry
  if (dateList.length > 0) return dateList[dateList.length - 1].date_range;
  return '';
}

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
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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

      // Auto-select current period — uses safe date parser
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

  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

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
      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isStoreUser ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">Store:</span>
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{toTitleCase(myStoreName)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Store</label>
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
            <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Periode</label>
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

      {/* Main Table */}
      {!selectedDateRange ? (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-400 text-sm">
          Pilih periode untuk melihat jadwal
        </div>
      ) : storeGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-400 text-sm">
          Tidak ada data taft
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[140px] max-w-[160px] w-40 border-r border-gray-200">
                    Nama TAFT
                  </th>
                  {DAYS.map((day, i) => (
                    <th
                      key={day}
                      className={`px-1 py-2 text-center font-semibold text-gray-600 w-16 ${
                        day === todayDayKey ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="text-[11px]">{DAY_LABELS[i]}</div>
                      {day === todayDayKey && (
                        <div className="text-[9px] text-blue-500 font-normal">Hari ini</div>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-24 sticky right-0 bg-gray-50 z-10 border-l border-gray-200">
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
                          <span className="text-[10px] text-gray-400">{tafts.length} taft</span>
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
                                    <span className="text-gray-200 text-[10px]">—</span>
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
                                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${hasEntry ? 'bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
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

          {/* Legend */}
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

// ─── Monthly Report (+ Recap for attendance_report users) ─────────────────────
function MonthlyReport({
  user, isStoreUser, myStoreName,
}: { user: any; isStoreUser: boolean; myStoreName: string }) {
  const [taftList,          setTaftList]          = useState<TaftEntry[]>([]);
  const [allStores,         setAllStores]         = useState<string[]>([]);
  const [selectedStore,     setSelectedStore]     = useState('');
  const [selectedTaft,      setSelectedTaft]      = useState('');
  const [selectedMonth,     setSelectedMonth]     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [importing,         setImporting]         = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' as 'success'|'error' });
  const fileRef = useRef<HTMLInputElement>(null);

  // Recap sub-tab — only for attendance_report users
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
    if (!selectedTaft || !selectedMonth) return;
    const storeForTemplate = selectedStore || (filteredTafts.find(t => t.taft_name === selectedTaft)?.store_name || '');
    const taftInfo = taftList.find(t => t.taft_name === selectedTaft && (selectedStore ? t.store_name?.toLowerCase() === selectedStore.toLowerCase() : true));
    const startDay = parseInt(taftInfo?.start_date || '26');
    const endDay   = parseInt(taftInfo?.end_date   || '25');
    const [year, mon] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, mon - 2, startDay);
    const endDate   = new Date(year, mon - 1, endDay);
    const dates: Date[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const wb      = XLSX.utils.book_new();
    const headers = ['date','store_name','taft_name','clock_in','clock_out','code_time','overtime_hours','reason'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dates.map(d => [fmtISO(d), storeForTemplate, selectedTaft, '', '', '', '', ''])]);
    ws['!cols'] = [{ wch:14 },{ wch:16 },{ wch:28 },{ wch:10 },{ wch:10 },{ wch:12 },{ wch:14 },{ wch:20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const refWs = XLSX.utils.aoa_to_sheet([['Kode','Keterangan'],['P','Pagi'],['S','Siang'],['F','Full'],['MF','Midle Full'],['O','OFF'],['C','Cuti'],['+','Sakit'],['I','Izin'],['A','Alpa']]);
    refWs['!cols'] = [{ wch:8 },{ wch:16 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Kode Referensi');
    XLSX.writeFile(wb, `attendance_${storeForTemplate}_${selectedTaft.replace(/ /g,'_')}_${selectedMonth}.xlsx`);
    setShowDownloadModal(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer  = await file.arrayBuffer();
      const wb      = XLSX.read(buffer, { type: 'array' });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
      const rows = rawRows.filter((r: any) => r.date).map((r: any) => ({
        date: String(r.date||''), store_name: String(r.store_name||''), taft_name: String(r.taft_name||''),
        clock_in: String(r.clock_in||''), clock_out: String(r.clock_out||''), code_time: String(r.code_time||''),
        overtime_hours: String(r.overtime_hours||''), reason: String(r.reason||''),
      }));
      if (rows.length === 0) { setPopup({ show: true, message: 'Tidak ada data yang valid di file', type: 'error' }); return; }
      const res = await fetch('/api/attendance/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const result = await res.json();
      setPopup({ show: true, message: result.success ? `${result.imported} baris berhasil diimport` : (result.error || 'Import gagal'), type: result.success ? 'success' : 'error' });
    } catch {
      setPopup({ show: true, message: 'Gagal membaca file XLSX', type: 'error' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Recap logic ──────────────────────────────────────────────────────────────
  const fetchRecap = async () => {
    setRecapLoading(true);
    const storeParam = recapStore ? `&store_name=${encodeURIComponent(recapStore)}` : '';
    const res = await fetch(`/api/attendance/report?month=${selectedMonth}${storeParam}`);
    setRecapReports(await res.json());
    setRecapLoading(false);
  };

  useEffect(() => {
    if (subTab === 'recap' && selectedMonth) fetchRecap();
  }, [subTab, recapStore, selectedMonth]);

  const recapTafts = recapStore
    ? taftList.filter(t => t.store_name?.toLowerCase() === recapStore.toLowerCase())
    : taftList;

  const calcRecap = (taftName: string, storeName: string) => {
    const rows = recapReports.filter(r => r.taft_name === taftName && r.store_name === storeName);
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
      {/* Sub-tab for attendance_report users */}
      {user.attendance_report && (
        <div className="flex gap-0.5 bg-white rounded-lg p-0.5 shadow border border-gray-100 mb-3 w-fit">
          {(['import','recap'] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${subTab === t ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t === 'import' ? 'Import' : 'Recap'}
            </button>
          ))}
        </div>
      )}

      {/* ── Import Panel ── */}
      {subTab === 'import' && (
        <>
          <div className="bg-white rounded-lg shadow p-2.5 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {isStoreUser ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500">Store:</span>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{myStoreName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Store</label>
                  <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); }}
                    className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Semua Store</option>
                    {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Bulan</label>
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
            <p className="text-[11px] text-gray-500 mb-2">Download template XLSX → isi kolom <strong>clock_in</strong>, <strong>clock_out</strong>, <strong>code_time</strong>, <strong>overtime_hours</strong>, <strong>reason</strong> → Import kembali.</p>
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

      {/* ── Recap Panel ── */}
      {subTab === 'recap' && user.attendance_report && (
        <div>
          <div className="bg-white rounded-lg shadow p-2.5 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Store</label>
                <select value={recapStore} onChange={e => setRecapStore(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Semua Store</option>
                  {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <button onClick={fetchRecap} className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90">
                Refresh
              </button>
            </div>
          </div>

          {recapLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Memuat data...</div>
          ) : recapTafts.length === 0 ? (
            <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-400 text-sm">Tidak ada data taft</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {!recapStore && (
                        <th className="px-2 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[100px] w-24 border-r border-gray-200 text-[10px]">Store</th>
                      )}
                      <th className="px-2 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[130px] max-w-[150px] w-36 border-r border-gray-200 text-[10px]">Nama TAFT</th>
                      {RECAP_KEYS.map(({ key }) => (
                        <th key={key} className="px-1 py-2 text-center font-semibold text-gray-600 w-10 text-[10px]">
                          <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-bold ${CODE_COLORS[key] || 'bg-gray-100 text-gray-600'}`}>{key}</span>
                        </th>
                      ))}
                      <th className="px-1 py-2 text-center font-semibold text-gray-600 w-10 text-[10px]">Msk</th>
                      <th className="px-1 py-2 text-center font-semibold text-gray-600 w-10 text-[10px]">OFF</th>
                      <th className="px-1 py-2 text-center font-semibold text-gray-600 w-12 text-[10px]">Lembur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapStoreGroups.map(({ storeName, tafts }) => (
                      <React.Fragment key={storeName}>
                        {!recapStore && (
                          <tr className="bg-primary/5 border-y border-primary/10">
                            <td colSpan={13} className="px-2 py-1 sticky left-0 bg-primary/5 z-10">
                              <span className="text-[10px] font-bold text-primary">{storeName}</span>
                            </td>
                          </tr>
                        )}
                        {tafts.map(taft => {
                          const recap = calcRecap(taft.taft_name, taft.store_name);
                          return (
                            <tr key={taft.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                              {!recapStore && (
                                <td className="px-2 py-1 sticky left-0 bg-white z-10 border-r border-gray-100 text-[10px] text-gray-500 min-w-[100px] w-24 truncate" title={storeName}>{storeName}</td>
                              )}
                              <td className="px-2 py-1 sticky left-0 bg-white z-10 border-r border-gray-100 min-w-[130px] max-w-[150px] w-36">
                                <span className="font-medium text-gray-800 text-[10px] truncate block" title={taft.taft_name}>{taft.taft_name}</span>
                              </td>
                              {RECAP_KEYS.map(({ key }) => (
                                <td key={key} className="px-1 py-1 text-center w-10">
                                  {(recap.counts[key] || 0) > 0
                                    ? <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-bold ${CODE_COLORS[key] || 'bg-gray-100 text-gray-700'}`}>{recap.counts[key]}</span>
                                    : <span className="text-gray-200 text-[9px]">—</span>
                                  }
                                </td>
                              ))}
                              <td className="px-1 py-1 text-center w-10">
                                <span className="text-[10px] font-bold text-green-700">{recap.totalMasuk}</span>
                              </td>
                              <td className="px-1 py-1 text-center w-10">
                                <span className="text-[10px] font-bold text-gray-500">{recap.totalOff}</span>
                              </td>
                              <td className="px-1 py-1 text-center w-12">
                                {recap.totalLembur > 0
                                  ? <span className="text-[10px] font-bold text-orange-600">{recap.totalLembur.toFixed(1)}j</span>
                                  : <span className="text-gray-200 text-[9px]">—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2">
                {RECAP_KEYS.map(({ key, label }) => (
                  <span key={key} className="text-[9px] text-gray-500">
                    <span className={`inline-block px-1 py-0.5 rounded font-bold mr-0.5 ${CODE_COLORS[key] || 'bg-gray-100 text-gray-600'}`}>{key}</span>
                    {label.replace(/\s*\(.*\)/, '')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download Template Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-bold text-primary mb-4">Download Template XLSX</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                {isStoreUser
                  ? <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">{myStoreName}</div>
                  : <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Semua Store</option>
                      {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                }
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">TAFT</label>
                <select value={selectedTaft} onChange={e => setSelectedTaft(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Pilih TAFT</option>
                  {filteredTafts.map(t => <option key={t.id} value={t.taft_name}>{t.taft_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDownloadModal(false)} className="flex-1 px-4 py-2 bg-gray-400 text-white rounded text-sm">Batal</button>
              <button onClick={handleDownloadTemplate} disabled={!selectedTaft} className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50">Download</button>
            </div>
          </div>
        </div>
      )}

      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />
    </div>
  );
}

// ─── Full Report ──────────────────────────────────────────────────────────────
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
  const [reports,   setReports]   = useState<ReportRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [viewMode,  setViewMode]  = useState<'monthly'|'weekly'>('monthly');

  // Track which tafts are expanded (showing detail)
  const [expandedTafts, setExpandedTafts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/attendance/meta?type=all').then(r => r.json()).then(data => {
      setTaftList(data.taftList || []);
      setDateList(data.dateList || []);
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
    const res = await fetch(`/api/attendance/report?month=${selectedMonth}${storeParam}${taftParam}`);
    setReports(await res.json());
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
    acc[key] = {
      taft_name: taft.taft_name,
      store_name: taft.store_name,
      rows: reports.filter(r => r.taft_name === taft.taft_name && r.store_name === taft.store_name),
    };
    return acc;
  }, {} as Record<string, { taft_name: string; store_name: string; rows: ReportRow[] }>);

  const toggleTaft = (key: string) => {
    setExpandedTafts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll   = () => setExpandedTafts(new Set(Object.keys(groupedByTaft)));
  const collapseAll = () => setExpandedTafts(new Set());

  const todayDay    = new Date().getDay();
  const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];
  const weeklyTafts = filteredTafts;

  return (
    <div>
      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Tampilan</label>
            <div className="flex gap-0.5 bg-gray-100 rounded p-0.5 ml-1">
              {(['monthly','weekly'] as const).map(m => (
                <button key={m} onClick={() => { setViewMode(m); setReports([]); setSchedules([]); setExpandedTafts(new Set()); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {m === 'monthly' ? 'Monthly' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Store</label>
            <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); setExpandedTafts(new Set()); }}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">Semua Store</option>
              {allStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {viewMode === 'monthly' && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">TAFT</label>
                <select value={selectedTaft} onChange={e => { setSelectedTaft(e.target.value); setExpandedTafts(new Set()); }}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Semua TAFT</option>
                  {filteredTafts.map(t => <option key={t.id} value={t.taft_name}>{t.taft_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Bulan</label>
                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </>
          )}

          {viewMode === 'weekly' && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-600 whitespace-nowrap">Periode</label>
              <select value={selectedDateRange} onChange={e => setSelectedDateRange(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Pilih Periode</option>
                {dateList.map(d => <option key={d.id} value={d.date_range}>{d.date_range}</option>)}
              </select>
            </div>
          )}

          <button onClick={viewMode === 'monthly' ? fetchReports : fetchSchedules}
            className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90">
            Tampilkan
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-10 text-gray-400 text-sm">Memuat data...</div>}

      {/* Monthly View */}
      {!loading && viewMode === 'monthly' && Object.keys(groupedByTaft).length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-[11px] font-semibold text-gray-700">
              {Object.keys(groupedByTaft).length} TAFT
            </span>
            <div className="flex gap-1.5">
              <button onClick={expandAll} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                Buka Semua
              </button>
              <button onClick={collapseAll} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                Tutup Semua
              </button>
            </div>
          </div>

          {Object.entries(groupedByTaft).map(([key, { taft_name, store_name, rows }]) => {
            const isExpanded = expandedTafts.has(key);
            return (
              <div key={key} className="border-b border-gray-100 last:border-0">
                {/* Taft header — arrow on RIGHT, no sendPrompt */}
                <button
                  onClick={() => toggleTaft(key)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-800">{taft_name}</span>
                    {!selectedStore && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{store_name}</span>
                    )}
                    <span className="text-[10px] text-gray-400">{rows.length} hari</span>
                    {rows.length > 0 && (
                      <div className="flex gap-1">
                        {RECAP_KEYS.slice(0,5).map(({ key: k }) => {
                          const count = rows.filter(r => r.code_time?.trim() === k).length;
                          if (!count) return null;
                          return (
                            <span key={k} className={`text-[9px] px-1 py-0.5 rounded font-bold ${CODE_COLORS[k] || 'bg-gray-100'}`}>
                              {k}:{count}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Arrow on the right */}
                  <span className={`text-gray-400 text-[10px] transition-transform duration-200 ml-2 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Detail rows */}
                {isExpanded && (
                  <div className="border-t border-gray-50">
                    {rows.length === 0 ? (
                      <div className="px-8 py-3 text-[11px] text-gray-400">Belum ada data untuk bulan ini</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50/80">
                            <tr>
                              <th className="px-3 py-1.5 text-left font-medium text-gray-500 text-[10px]">Tanggal</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-500 text-[10px]">Clock In</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-500 text-[10px]">Clock Out</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-500 text-[10px]">Kode</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-500 text-[10px]">Lembur</th>
                              <th className="px-3 py-1.5 text-left font-medium text-gray-500 text-[10px]">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
                                <td className="px-3 py-1 text-gray-600 text-[10px] whitespace-nowrap">{r.date}</td>
                                <td className="px-3 py-1 text-center text-gray-500 text-[10px]">{r.clock_in || '-'}</td>
                                <td className="px-3 py-1 text-center text-gray-500 text-[10px]">{r.clock_out || '-'}</td>
                                <td className="px-3 py-1 text-center">
                                  {r.code_time
                                    ? <span className={`px-1 py-0.5 rounded font-bold text-[9px] ${CODE_COLORS[r.code_time] || 'bg-gray-100 text-gray-700'}`}>{r.code_time}</span>
                                    : <span className="text-gray-300 text-[10px]">-</span>
                                  }
                                </td>
                                <td className="px-3 py-1 text-center text-orange-600 text-[10px]">
                                  {r.overtime_hours && parseFloat(r.overtime_hours) > 0 ? `${r.overtime_hours}j` : '-'}
                                </td>
                                <td className="px-3 py-1 text-gray-500 text-[10px] max-w-[200px] truncate">{r.reason || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && viewMode === 'monthly' && Object.keys(groupedByTaft).length === 0 && (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-400 text-sm">
          Pilih bulan untuk melihat data
        </div>
      )}

      {/* Weekly View */}
      {!loading && viewMode === 'weekly' && (
        selectedDateRange ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-[11px] min-w-[150px]">Nama TAFT</th>
                  {!selectedStore && (
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 text-[11px] min-w-[110px]">Store</th>
                  )}
                  {DAY_LABELS_FULL.map((label, i) => (
                    <th key={label} className={`px-2 py-2 text-center font-semibold text-gray-700 text-[11px] min-w-[56px] ${DAYS[i] === todayDayKey ? 'bg-blue-50' : ''}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyTafts.map(taft => {
                  const sched = schedules.find(
                    s => s.taft_name === taft.taft_name &&
                         s.store_name === taft.store_name &&
                         s.date_range === selectedDateRange
                  );
                  return (
                    <tr key={taft.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium text-gray-800 text-[11px]">{taft.taft_name}</td>
                      {!selectedStore && (
                        <td className="px-3 py-1.5 text-gray-500 text-[10px]">{taft.store_name}</td>
                      )}
                      {DAYS.map((d, i) => {
                        const code = sched?.[d as keyof ScheduleRow] as string || '';
                        return (
                          <td key={d} className={`px-2 py-1.5 text-center ${DAYS[i] === todayDayKey ? 'bg-blue-50' : ''}`}>
                            {code
                              ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${CODE_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>{code}</span>
                              : <span className="text-gray-300 text-[10px]">-</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {weeklyTafts.length === 0 && (
                  <tr>
                    <td colSpan={!selectedStore ? 9 : 8} className="px-3 py-8 text-center text-gray-400 text-sm">
                      Tidak ada data taft
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-400 text-sm">
            Pilih periode minggu untuk melihat jadwal
          </div>
        )
      )}
    </div>
  );
}