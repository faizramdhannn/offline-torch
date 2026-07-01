"use client";

import React, { useState, useEffect } from "react";
import { CalendarX2 } from "lucide-react";
import Popup from "@/components/Popup";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DateEntry, TaftEntry, TimeCode, ScheduleRow } from "./types";
import {
  DAYS, DAY_LABELS, CODE_COLORS, CODE_BG_CELL,
} from "./constants";
import { toTitleCase, getWeekDates, fmtDDMM, findCurrentDateRange } from "./utils";

interface WeeklyScheduleProps {
  user: any;
  isStoreUser: boolean;
  myStoreName: string;
}

export function WeeklySchedule({ user, isStoreUser, myStoreName }: WeeklyScheduleProps) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="space-y-3">
      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {isStoreUser ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Store:</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{toTitleCase(myStoreName)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Store</label>
            <select
              value={selectedStore}
              onChange={e => { setSelectedStore(e.target.value); setSchedules([]); setEditingRow(null); }}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
            >
              <option value="">Semua Store</option>
              {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Periode</label>
          <select
            value={selectedDateRange}
            onChange={e => { setSelectedDateRange(e.target.value); setEditingRow(null); }}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
          >
            <option value="">Pilih Periode</option>
            {dateList.map(d => (
              <option key={d.id} value={d.date_range}>{d.date_range}</option>
            ))}
          </select>
        </div>

        {selectedDateRange && (
          <span className="rounded-md bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
            {selectedDateRange}
          </span>
        )}
      </div>

      {/* ── Schedule Table ─────────────────────────────────────────────────── */}
      {!selectedDateRange ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <EmptyState icon={CalendarX2} title="Pilih periode" description="Pilih periode untuk melihat jadwal" />
        </div>
      ) : storeGroups.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <EmptyState icon={CalendarX2} title="Tidak ada data taft" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[140px] max-w-[160px] w-40 border-r border-gray-200">
                    Nama TAFT
                  </th>
                  {DAYS.map((day, i) => (
                    <th
                      key={day}
                      className={`px-1 py-2 text-center font-semibold text-gray-500 w-16 ${
                        day === todayDayKey ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="text-[11px]">{DAY_LABELS[i]}</div>
                      {weekDates?.[i] && (
                        <div className="text-[9px] font-normal text-gray-400 mt-0.5">
                          {fmtDDMM(weekDates[i])}
                        </div>
                      )}
                      {day === todayDayKey && (
                        <div className="text-[9px] text-blue-500 font-normal">Hari ini</div>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-500 w-24 sticky right-0 bg-gray-50 z-10 border-l border-gray-200">
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
                          <span className="text-[10px] text-gray-500">{tafts.length} taft</span>
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
                                    <span className="text-gray-300 text-[10px]">—</span>
                                  )
                                )}
                              </td>
                            );
                          })}

                          <td className={`px-2 py-1 text-center sticky right-0 z-10 border-l border-gray-100 ${isEdit ? 'bg-amber-50/60' : 'bg-white'}`}>
                            {isEdit ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => saveRow(taft)} disabled={isSaving} className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap transition-colors hover:bg-primary/90 disabled:opacity-50">
                                  {isSaving ? '...' : 'Simpan'}
                                </button>
                                <button onClick={cancelEdit} disabled={isSaving} className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50">✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(taft)}
                                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${hasEntry ? 'bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
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

          {/* Code Legend */}
          <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2">
            {Object.entries(CODE_COLORS).map(([code, cls]) => (
              <span key={code} className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{code}</span>
            ))}
          </div>
        </div>
      )}

      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />
    </div>
  );
}
