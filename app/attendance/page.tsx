"use client";

import { useState, useEffect, useRef } from "react";
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

interface DateEntry { id: string; date_range: string; week_start: string; week_end: string; }
interface TaftEntry { id: string; store_name: string; taft_name: string; start_date: string; end_date: string; }
interface TimeCode  { id: string; code_time: string; definition_code: string; }
interface ReportRow {
  date: string; store_name: string; taft_name: string;
  clock_in: string; clock_out: string; code_time: string;
  overtime_hours: string; reason: string;
}

const DAYS       = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DAY_LABELS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

const CODE_COLORS: Record<string, string> = {
  P:   'bg-blue-100 text-blue-800',
  S:   'bg-yellow-100 text-yellow-800',
  F:   'bg-green-100 text-green-800',
  MF:  'bg-purple-100 text-purple-800',
  M:   'bg-orange-100 text-orange-800',
  O:   'bg-gray-100 text-gray-600',
  C:   'bg-pink-100 text-pink-800',
  '+': 'bg-red-100 text-red-700',
  I:   'bg-indigo-100 text-indigo-700',
  A:   'bg-red-200 text-red-900',
};

const RECAP_KEYS = [
  { key:'P',   label:'PAGI (P)'        },
  { key:'S',   label:'SIANG (S)'       },
  { key:'O',   label:'OFF (O)'         },
  { key:'F',   label:'FULL (F)'        },
  { key:'M',   label:'MIDLE (M)'       },
  { key:'MF',  label:'MIDLE FULL (MF)' },
  { key:'C',   label:'CUTI (C)'        },
  { key:'+',   label:'SAKIT (+)'       },
  { key:'I',   label:'IZIN (I)'        },
  { key:'A',   label:'ALPA (A)'        },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const router = useRouter();
  const [user, setUser]           = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'weekly'|'monthly'|'recap'>('weekly');

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance) { router.push("/dashboard"); return; }
    setUser(parsed);
  }, []);

  if (!user) return null;

  // Tab recap hanya muncul jika punya permission attendance_recap
  const tabs = [
    { key: 'weekly',  label: 'Weekly Schedule' },
    { key: 'monthly', label: 'Monthly Report'  },
    ...(user.attendance_recap ? [{ key: 'recap', label: 'Recap Monthly' }] : []),
  ] as { key: 'weekly'|'monthly'|'recap'; label: string }[];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-4">Attendance</h1>

          <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow w-fit">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'weekly'  && <WeeklySchedule user={user} />}
          {activeTab === 'monthly' && <MonthlyReport  user={user} />}
          {activeTab === 'recap'   && user.attendance_recap && <RecapMonthly user={user} />}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Schedule ───────────────────────────────────────────────────────────
function WeeklySchedule({ user }: { user: any }) {
  const [dateList,          setDateList]          = useState<DateEntry[]>([]);
  const [taftList,          setTaftList]          = useState<TaftEntry[]>([]);
  const [timeCodes,         setTimeCodes]         = useState<TimeCode[]>([]);
  const [schedules,         setSchedules]         = useState<ScheduleRow[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState('');
  const [showModal,         setShowModal]         = useState(false);
  const [editingTaft,       setEditingTaft]       = useState<TaftEntry | null>(null);
  const [formData,          setFormData]          = useState<Record<string,string>>({});
  const [saving,            setSaving]            = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' as 'success'|'error' });

  const storeName = user.user_name;

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { if (selectedDateRange) fetchSchedules(); }, [selectedDateRange]);

  const fetchMeta = async () => {
    const res = await fetch('/api/attendance/meta?type=all');
    const d   = await res.json();
    setDateList(d.dateList || []);
    setTaftList((d.taftList || []).filter((t: TaftEntry) =>
      t.store_name?.toLowerCase() === storeName.toLowerCase()
    ));
    const seen  = new Set<string>();
    const codes = (d.timeSchedule || []).filter((t: TimeCode) => {
      if (seen.has(t.code_time)) return false;
      seen.add(t.code_time);
      return true;
    });
    setTimeCodes(codes);
  };

  const fetchSchedules = async () => {
    const res = await fetch(
      `/api/attendance/schedule?store_name=${encodeURIComponent(storeName)}&date_range=${encodeURIComponent(selectedDateRange)}`
    );
    setSchedules(await res.json());
  };

  const getSchedule = (taftName: string) =>
    schedules.find(s => s.taft_name === taftName && s.date_range === selectedDateRange);

  const openModal = (taft: TaftEntry) => {
    setEditingTaft(taft);
    const existing = getSchedule(taft.taft_name);
    const init: Record<string,string> = {};
    DAYS.forEach(d => { init[d] = existing?.[d as keyof ScheduleRow] as string || ''; });
    setFormData(init);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingTaft || !selectedDateRange) return;
    setSaving(true);
    try {
      const res = await fetch('/api/attendance/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_range: selectedDateRange,
          taft_name:  editingTaft.taft_name,
          store_name: storeName,
          ...formData,
          created_by: user.user_name,
        }),
      });
      if (res.ok) {
        setPopup({ show: true, message: 'Jadwal berhasil disimpan!', type: 'success' });
        setShowModal(false);
        fetchSchedules();
      } else {
        setPopup({ show: true, message: 'Gagal menyimpan jadwal', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const todayDay    = new Date().getDay();
  const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];

  return (
    <div>
      {/* Filter periode */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Periode Minggu</label>
            <select
              value={selectedDateRange}
              onChange={e => setSelectedDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Pilih Periode --</option>
              {dateList.map(d => (
                <option key={d.id} value={d.date_range}>{d.date_range}</option>
              ))}
            </select>
          </div>
          {selectedDateRange && (
            <p className="text-xs text-gray-500 mt-4">
              Store: <strong>{storeName}</strong> &nbsp;|&nbsp; {taftList.length} taft
            </p>
          )}
        </div>
      </div>

      {/* Highlight hari ini */}
      {selectedDateRange && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-blue-800 mb-2">
            Jadwal Hari Ini ({DAY_LABELS[todayDay === 0 ? 6 : todayDay - 1]})
          </p>
          <div className="flex flex-wrap gap-2">
            {taftList.length === 0 && (
              <span className="text-xs text-gray-400">Belum ada taft</span>
            )}
            {taftList.map(t => {
              const sched = getSchedule(t.taft_name);
              const code  = sched?.[todayDayKey as keyof ScheduleRow] as string || '';
              return (
                <span
                  key={t.taft_name}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    code ? (CODE_COLORS[code] || 'bg-gray-100 text-gray-700') : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {t.taft_name}: {code || '-'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabel */}
      {selectedDateRange && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[160px]">Nama TAFT</th>
                {DAY_LABELS.map((label, i) => (
                  <th
                    key={label}
                    className={`px-2 py-2 text-center font-semibold text-gray-700 min-w-[64px] ${
                      DAYS[i] === todayDayKey ? 'bg-blue-50' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {taftList.map(taft => {
                const sched    = getSchedule(taft.taft_name);
                const hasEntry = sched && DAYS.some(d => sched[d as keyof ScheduleRow]);
                return (
                  <tr key={taft.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{taft.taft_name}</td>
                    {DAYS.map((d, i) => {
                      const code = sched?.[d as keyof ScheduleRow] as string || '';
                      return (
                        <td
                          key={d}
                          className={`px-2 py-2 text-center ${DAYS[i] === todayDayKey ? 'bg-blue-50' : ''}`}
                        >
                          {code
                            ? <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${CODE_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>{code}</span>
                            : <span className="text-gray-300">-</span>
                          }
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => openModal(taft)}
                        className="px-2 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                      >
                        {hasEntry ? 'Edit' : 'Input'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {taftList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                    Tidak ada taft untuk store ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal input jadwal */}
      {showModal && editingTaft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-primary mb-1">Input Jadwal Mingguan</h2>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{editingTaft.taft_name}</strong> &mdash; {selectedDateRange}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DAYS.map((day, i) => (
                <div key={day}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {DAY_LABELS[i]}
                  </label>
                  <select
                    value={formData[day] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [day]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Pilih --</option>
                    {timeCodes.map(t => (
                      <option key={`${t.id}-${t.code_time}`} value={t.code_time}>
                        {t.code_time} &mdash; {t.definition_code}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup
        show={popup.show}
        message={popup.message}
        type={popup.type}
        onClose={() => setPopup(p => ({ ...p, show: false }))}
      />
    </div>
  );
}

// ─── Monthly Report ────────────────────────────────────────────────────────────
function MonthlyReport({ user }: { user: any }) {
  const [taftList,          setTaftList]          = useState<TaftEntry[]>([]);
  const [allStores,         setAllStores]         = useState<string[]>([]);
  const [selectedStore,     setSelectedStore]     = useState(user.user_name);
  const [selectedTaft,      setSelectedTaft]      = useState('');
  const [selectedMonth,     setSelectedMonth]     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [importing,         setImporting]         = useState(false);
  const [popup, setPopup] = useState({ show: false, message: '', type: 'success' as 'success'|'error' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/attendance/meta?type=taft_list').then(r => r.json()).then(data => {
      setTaftList(data);
      const stores = [...new Set(data.map((t: TaftEntry) => t.store_name))] as string[];
      setAllStores(stores);
    });
  }, []);

  const filteredTafts = taftList.filter(
    t => t.store_name?.toLowerCase() === selectedStore.toLowerCase()
  );

  // ── Download template XLSX ──────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    if (!selectedStore || !selectedTaft || !selectedMonth) return;

    const taftInfo = taftList.find(
      t => t.store_name?.toLowerCase() === selectedStore.toLowerCase() && t.taft_name === selectedTaft
    );
    const startDay = parseInt(taftInfo?.start_date || '26');
    const endDay   = parseInt(taftInfo?.end_date   || '25');

    const [year, mon] = selectedMonth.split('-').map(Number);
    const startDate   = new Date(year, mon - 2, startDay);
    const endDate     = new Date(year, mon - 1, endDay);

    const dates: Date[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

    const fmtISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const wb      = XLSX.utils.book_new();
    const headers = ['date','store_name','taft_name','clock_in','clock_out','code_time','overtime_hours','reason'];
    const rows    = dates.map(d => [fmtISO(d), selectedStore, selectedTaft, '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 28 },
      { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 14 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    // Sheet referensi kode
    const refWs = XLSX.utils.aoa_to_sheet([
      ['Kode', 'Keterangan'],
      ['P',  'Pagi'],    ['S', 'Siang'], ['F', 'Full'],
      ['MF', 'Midle Full'], ['M', 'Midle'], ['O', 'OFF'],
      ['C',  'Cuti'],    ['+', 'Sakit'], ['I', 'Izin'], ['A', 'Alpa'],
    ]);
    refWs['!cols'] = [{ wch: 8 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Kode Referensi');

    XLSX.writeFile(wb, `attendance_${selectedStore}_${selectedTaft.replace(/ /g,'_')}_${selectedMonth}.xlsx`);
    setShowDownloadModal(false);
  };

  // ── Import XLSX ─────────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer  = await file.arrayBuffer();
      const wb      = XLSX.read(buffer, { type: 'array' });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

      const rows = rawRows
        .filter((r: any) => r.date)
        .map((r: any) => ({
          date:           String(r.date            || ''),
          store_name:     String(r.store_name      || ''),
          taft_name:      String(r.taft_name       || ''),
          clock_in:       String(r.clock_in        || ''),
          clock_out:      String(r.clock_out       || ''),
          code_time:      String(r.code_time       || ''),
          overtime_hours: String(r.overtime_hours  || ''),
          reason:         String(r.reason          || ''),
        }));

      if (rows.length === 0) {
        setPopup({ show: true, message: 'Tidak ada data yang valid di file', type: 'error' });
        return;
      }

      const res    = await fetch('/api/attendance/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows }),
      });
      const result = await res.json();
      if (result.success) {
        setPopup({ show: true, message: `${result.imported} baris berhasil diimport`, type: 'success' });
      } else {
        setPopup({ show: true, message: result.error || 'Import gagal', type: 'error' });
      }
    } catch {
      setPopup({ show: true, message: 'Gagal membaca file XLSX', type: 'error' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedStore}
              onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); }}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {allStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDownloadModal(true)}
              className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
            >
              ↓ Download Template
            </button>
            <label className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 cursor-pointer">
              {importing ? 'Importing...' : '↑ Import XLSX'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">Panduan Penggunaan</p>
        <p className="text-xs text-gray-500 mb-3">
          Download template XLSX &rarr; isi kolom <strong>clock_in</strong>, <strong>clock_out</strong>,{' '}
          <strong>code_time</strong>, <strong>overtime_hours</strong>, <strong>reason</strong> &rarr; Import kembali.
        </p>
        <div className="flex flex-wrap gap-2">
          {RECAP_KEYS.map(({ key, label }) => (
            <span key={key} className={`px-2 py-1 rounded text-xs font-medium ${CODE_COLORS[key] || 'bg-gray-100'}`}>
              {key} = {label.replace(/\s*\(.*\)/, '')}
            </span>
          ))}
        </div>
      </div>

      {/* Modal download */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-bold text-primary mb-4">Download Template XLSX</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
                <select
                  value={selectedStore}
                  onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">TAFT</label>
                <select
                  value={selectedTaft}
                  onChange={e => setSelectedTaft(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Pilih TAFT --</option>
                  {filteredTafts.map(t => (
                    <option key={t.id} value={t.taft_name}>{t.taft_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="flex-1 px-4 py-2 bg-gray-400 text-white rounded text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleDownloadTemplate}
                disabled={!selectedTaft}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup
        show={popup.show}
        message={popup.message}
        type={popup.type}
        onClose={() => setPopup(p => ({ ...p, show: false }))}
      />
    </div>
  );
}

// ─── Recap Monthly ─────────────────────────────────────────────────────────────
function RecapMonthly({ user }: { user: any }) {
  const [taftList,          setTaftList]          = useState<TaftEntry[]>([]);
  const [allStores,         setAllStores]         = useState<string[]>([]);
  const [selectedStore,     setSelectedStore]     = useState(user.user_name);
  const [selectedMonth,     setSelectedMonth]     = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  });
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/meta?type=taft_list').then(r => r.json()).then(data => {
      setTaftList(data);
      const stores = [...new Set(data.map((t: TaftEntry) => t.store_name))] as string[];
      setAllStores(stores);
    });
  }, []);

  useEffect(() => {
    if (selectedStore && selectedMonth) fetchReports();
  }, [selectedStore, selectedMonth]);

  const fetchReports = async () => {
    setLoading(true);
    const res  = await fetch(
      `/api/attendance/report?store_name=${encodeURIComponent(selectedStore)}&month=${selectedMonth}`
    );
    setReports(await res.json());
    setLoading(false);
  };

  const storeTafts = taftList.filter(
    t => t.store_name?.toLowerCase() === selectedStore.toLowerCase()
  );

  const calcRecap = (taftName: string) => {
    const rows   = reports.filter(r => r.taft_name === taftName);
    const counts: Record<string,number> = {};
    let totalMasuk = 0, totalOff = 0, totalLembur = 0;

    rows.forEach(r => {
      const code = r.code_time?.trim();
      if (code) counts[code] = (counts[code] || 0) + 1;
      if (['P','S','F','MF','M'].includes(code)) totalMasuk++;
      if (code === 'O') totalOff++;
      if (r.overtime_hours && parseFloat(r.overtime_hours) > 0)
        totalLembur += parseFloat(r.overtime_hours);
    });

    return {
      counts, totalMasuk, totalOff, totalLembur,
      totalCuti:  counts['C'] || 0,
      totalSakit: counts['+'] || 0,
      totalIzin:  counts['I'] || 0,
      totalAlpa:  counts['A'] || 0,
    };
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {allStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bulan</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={fetchReports}
            className="mt-5 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Memuat data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {storeTafts.map(taft => {
            const recap = calcRecap(taft.taft_name);
            return (
              <div key={taft.id} className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-bold text-primary mb-3 pb-2 border-b border-gray-100">
                  {taft.taft_name}
                </h3>

                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs mb-3">
                  {RECAP_KEYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-1">
                      <span className={`px-1.5 py-0.5 rounded font-medium whitespace-nowrap text-[10px] ${CODE_COLORS[key] || 'bg-gray-100 text-gray-600'}`}>
                        {label}
                      </span>
                      <span className="font-bold text-gray-800 min-w-[20px] text-right">
                        {recap.counts[key] || 0}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-2 space-y-1 text-xs">
                  {[
                    { label: 'Total Masuk Kerja', value: recap.totalMasuk,                     cls: 'text-green-700 font-bold' },
                    { label: 'Total OFF',          value: recap.totalOff,                        cls: 'text-gray-500 font-bold' },
                    { label: 'Total Jam Lembur',   value: `${recap.totalLembur.toFixed(1)} jam`, cls: 'text-orange-600 font-bold' },
                    { label: 'Total Cuti',         value: recap.totalCuti,                       cls: 'text-pink-700 font-bold' },
                    { label: 'Total Sakit',        value: recap.totalSakit,                      cls: 'text-red-600 font-bold' },
                    { label: 'Total Izin',         value: recap.totalIzin,                       cls: 'text-indigo-600 font-bold' },
                    { label: 'Total Alpa',         value: recap.totalAlpa,                       cls: 'text-red-900 font-bold' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-gray-600">{row.label}</span>
                      <span className={row.cls}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {storeTafts.length === 0 && (
            <div className="col-span-3 text-center py-10 text-gray-400 text-sm">
              Tidak ada data taft untuk store ini
            </div>
          )}
        </div>
      )}
    </div>
  );
}