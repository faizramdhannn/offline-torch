"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import type { TaftEntry, DateEntry, ReportRow, ScheduleRow, SalesStat, StoreWagesEntry, GroupedByTaft } from "./types";
import { DAYS, DAY_LABELS_FULL, CODE_COLORS, RECAP_KEYS, OVERTIME_RATE, MONTH_SHORT_ID } from "./constants";
import {
  toTitleCase, parseDateSafe, buildTaftDateRange,
} from "./utils";
import { SalesWagesChart } from "./SalesWagesChart";
import { ReportDashboard } from "./ReportDashboard";

interface FullReportProps {
  user: any;
}

export function FullReport({ user }: FullReportProps) {
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

  const [storeWages, setStoreWages] = useState<StoreWagesEntry[]>([]);
  const [salesData,  setSalesData]  = useState<SalesStat[]>([]);

  useEffect(() => {
    fetch('/api/attendance/meta?type=all').then(r => r.json()).then(data => {
      setTaftList(data.taftList || []);
      setDateList(data.dateList || []);
      setStoreWages(data.storeList || []);
      const stores = [...new Set((data.taftList || []).map((t: TaftEntry) => t.store_name))] as string[];
      setAllStores(stores);
    });
  }, []);

  useEffect(() => {
    if (selectedMonth && viewMode === 'monthly') fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, selectedTaft, selectedMonth, viewMode]);

  useEffect(() => {
    if (selectedDateRange && viewMode === 'weekly') fetchSchedules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const groupedByTaft: GroupedByTaft = filteredTafts.reduce((acc, taft) => {
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
  }, {} as GroupedByTaft);

  const toggleTaft   = (key: string) => {
    setExpandedTafts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll   = () => setExpandedTafts(new Set(Object.keys(groupedByTaft)));
  const collapseAll = () => setExpandedTafts(new Set());

  // ── XLSX Export ───────────────────────────────────────────────────────────
  const exportReportXlsx = () => {
    if (Object.keys(groupedByTaft).length === 0) return;
    const wb = XLSX.utils.book_new();

    const borderAll = {
      top:    { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left:   { style: 'thin', color: { rgb: '000000' } },
      right:  { style: 'thin', color: { rgb: '000000' } },
    };

    const sTitle              = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sHeader             = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'D9D9D9' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: borderAll };
    const sDataCenter         = { font: { sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sDataLeft           = { font: { sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryLabel       = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryValue       = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sSummaryLabelLembur = { font: { bold: true, sz: 10, color: { rgb: '0070C0' } }, fill: { fgColor: { rgb: '00B0F0' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sSummaryValueLembur = { font: { bold: true, sz: 10, color: { rgb: '0070C0' } }, fill: { fgColor: { rgb: '00B0F0' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };
    const sTotalLabel         = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'FFC000' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: borderAll };
    const sTotalValue         = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'FFC000' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderAll };

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

      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 5 } });
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

  // ── render helpers ────────────────────────────────────────────────────────
  const todayDay    = new Date().getDay();
  const todayDayKey = DAYS[todayDay === 0 ? 6 : todayDay - 1];
  const weeklyTafts = filteredTafts;

  const DAY_ID    = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const MONTH_SH  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const fmtDate   = (iso: string) => {
    const d = parseDateSafe(iso);
    if (!d) return iso;
    return `${DAY_ID[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${MONTH_SH[d.getMonth()]}`;
  };
  const isWeekend = (iso: string) => {
    const d = parseDateSafe(iso);
    return d ? d.getDay() === 0 || d.getDay() === 6 : false;
  };
  const displayTime = (val: string | number | undefined | null) => {
    if (val === null || val === undefined || val === '') return '-';
    return String(val);
  };

  return (
    <div>
      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow p-2.5 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode toggle */}
          <div className="flex items-center gap-1">
            <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Tampilan</label>
            <div className="flex gap-0.5 bg-gray-100 rounded p-0.5 ml-1">
              {(["monthly","weekly"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setViewMode(m);
                    setReports([]);
                    setSchedules([]);
                    setExpandedTafts(new Set());
                    setSalesData([]);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === m ? 'bg-white text-primary shadow-sm' : 'text-gray-900 hover:text-gray-700'}`}
                >
                  {m === 'monthly' ? 'Monthly' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>

          {/* Store filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Store</label>
            <select
              value={selectedStore}
              onChange={e => { setSelectedStore(e.target.value); setSelectedTaft(''); setExpandedTafts(new Set()); }}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Semua Store</option>
              {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
            </select>
          </div>

          {/* Monthly-specific filters */}
          {viewMode === 'monthly' && (
            <>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">TAFT</label>
                <select
                  value={selectedTaft}
                  onChange={e => { setSelectedTaft(e.target.value); setExpandedTafts(new Set()); }}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Semua TAFT</option>
                  {filteredTafts.map(t => <option key={t.id} value={t.taft_name}>{t.taft_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Bulan</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}

          {/* Weekly-specific filters */}
          {viewMode === 'weekly' && (
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-medium text-gray-900 whitespace-nowrap">Periode</label>
              <select
                value={selectedDateRange}
                onChange={e => setSelectedDateRange(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Pilih Periode</option>
                {dateList.map(d => <option key={d.id} value={d.date_range}>{d.date_range}</option>)}
              </select>
            </div>
          )}

          <button
            onClick={viewMode === 'monthly' ? fetchReports : fetchSchedules}
            className="px-3 py-1 bg-primary text-white rounded text-[11px] hover:bg-primary/90"
          >
            Tampilkan
          </button>

          {viewMode === 'monthly' && Object.keys(groupedByTaft).length > 0 && (
            <button
              onClick={exportReportXlsx}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-[11px] hover:bg-emerald-700"
            >
              ↓ Export XLSX
            </button>
          )}
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="text-center py-10 text-gray-900 text-sm">Memuat data...</div>
      )}

      {/* ── Sales vs Wages Chart ────────────────────────────────────────────── */}
      {!loading && viewMode === 'monthly' && (salesData.length > 0 || storeWages.length > 0) && (
        <SalesWagesChart
          salesData={salesData}
          storeWages={storeWages}
          taftList={filteredTafts.length > 0 ? filteredTafts : taftList}
          selectedMonth={selectedMonth}
          groupedByTaft={groupedByTaft}
        />
      )}

      {/* ── Analytics dashboard ─────────────────────────────────────────────── */}
      {!loading && viewMode === 'monthly' && Object.keys(groupedByTaft).length > 0 && (
        <ReportDashboard groupedByTaft={groupedByTaft} />
      )}

      {/* ── Monthly View — TAFT detail cards ──────────────────────────────── */}
      {!loading && viewMode === 'monthly' && Object.keys(groupedByTaft).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-900 font-medium">{Object.keys(groupedByTaft).length} TAFT</span>
            <div className="flex gap-1.5">
              <button onClick={expandAll} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors font-medium">
                Buka Semua
              </button>
              <button onClick={collapseAll} className="text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors font-medium">
                Tutup Semua
              </button>
            </div>
          </div>

          {Object.entries(groupedByTaft).map(([key, { taft_name, store_name, rows }]) => {
            const isExpanded = expandedTafts.has(key);
            const codeCounts: Record<string, number> = {};
            let totalMasuk = 0, totalLembur = 0;
            rows.forEach(r => {
              const c = r.code_time?.trim();
              if (c) codeCounts[c] = (codeCounts[c] || 0) + 1;
              if (['P','S','F','MF','M'].includes(c)) totalMasuk++;
              if (r.overtime_hours && parseFloat(r.overtime_hours) > 0) totalLembur += parseFloat(r.overtime_hours);
            });

            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button onClick={() => toggleTaft(key)} className="w-full text-left">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <span className={`text-[9px] font-black transition-transform duration-200 inline-block ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{taft_name}</span>
                        {!selectedStore && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {toTitleCase(store_name)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-900">{rows.length} hari data</span>
                        {totalMasuk > 0 && <span className="text-[10px] text-blue-600 font-semibold">{totalMasuk} masuk</span>}
                        {totalLembur > 0 && <span className="text-[10px] text-orange-500 font-semibold">{totalLembur.toFixed(1)}j lembur</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                      {RECAP_KEYS.map(({ key: k }) => {
                        const cnt = codeCounts[k] || 0;
                        if (!cnt) return null;
                        return (
                          <span key={k} className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${CODE_COLORS[k] || 'bg-gray-100 text-gray-900'}`}>
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
                      <div className="px-6 py-6 text-center text-[11px] text-gray-900">Belum ada data untuk periode ini</div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-36">Tanggal</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">Kode</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">Masuk</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-20">Keluar</th>
                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-900 uppercase tracking-wide w-16">Lembur</th>
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-900 uppercase tracking-wide">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const weekend = isWeekend(r.date);
                            const code    = r.code_time?.trim();
                            const isOff   = code === 'O';
                            const hasOT   = r.overtime_hours && parseFloat(r.overtime_hours) > 0;
                            return (
                              <tr
                                key={i}
                                className={`border-b border-gray-50 last:border-0 transition-colors ${weekend ? 'bg-blue-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-primary/5`}
                              >
                                <td className="px-4 py-2">
                                  <span className={`text-[11px] font-medium ${weekend ? 'text-blue-600' : 'text-gray-700'}`}>
                                    {fmtDate(r.date)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {code ? (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${CODE_COLORS[code] || 'bg-gray-100 text-gray-900'}`}>
                                      {code}
                                    </span>
                                  ) : (
                                    <span className="text-gray-900 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-[11px] font-mono font-medium ${isOff ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {displayTime(r.clock_in) || (isOff ? '—' : '-')}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-[11px] font-mono font-medium ${isOff ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {displayTime(r.clock_out) || (isOff ? '—' : '-')}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {hasOT ? (
                                    <span className="text-[11px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">
                                      {r.overtime_hours}j
                                    </span>
                                  ) : (
                                    <span className="text-gray-900 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-[11px] text-gray-900 truncate block max-w-[220px]">{r.reason || ''}</span>
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
          })}
        </div>
      )}

      {/* ── Monthly empty state ─────────────────────────────────────────────── */}
      {!loading && viewMode === 'monthly' && Object.keys(groupedByTaft).length === 0 && salesData.length === 0 && storeWages.length === 0 && (
        <div className="bg-white rounded-lg shadow px-4 py-10 text-center text-gray-900 text-sm">
          Pilih bulan untuk melihat data
        </div>
      )}

      {/* ── Weekly View ─────────────────────────────────────────────────────── */}
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
                    <th
                      key={label}
                      className={`px-2 py-2 text-center font-semibold text-gray-700 text-[11px] min-w-[56px] ${DAYS[i] === todayDayKey ? 'bg-blue-50' : ''}`}
                    >
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
                        <td className="px-3 py-1.5 text-gray-900 text-[10px]">{toTitleCase(taft.store_name)}</td>
                      )}
                      {DAYS.map((d, i) => {
                        const code = (sched?.[d as keyof ScheduleRow] as string) || '';
                        return (
                          <td
                            key={d}
                            className={`px-2 py-1.5 text-center ${DAYS[i] === todayDayKey ? 'bg-blue-50' : ''}`}
                          >
                            {code ? (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${CODE_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>
                                {code}
                              </span>
                            ) : (
                              <span className="text-gray-900 text-[10px]">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {weeklyTafts.length === 0 && (
                  <tr>
                    <td colSpan={!selectedStore ? 9 : 8} className="px-3 py-8 text-center text-gray-900 text-sm">
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
        )
      )}
    </div>
  );
}
