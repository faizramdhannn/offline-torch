"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import { Download, Upload, RefreshCw, FileSpreadsheet } from "lucide-react";
import Popup from "@/components/Popup";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TaftEntry, ReportRow, StoreWagesEntry } from "./types";
import { CODE_COLORS, RECAP_KEYS, OVERTIME_RATE } from "./constants";
import {
  toTitleCase, buildTaftDates, buildTaftDateRange, fmtISO, parseDateSafe,
} from "./utils";

interface MonthlyReportProps {
  user: any;
  isStoreUser: boolean;
  myStoreName: string;
}

export function MonthlyReport({ user, isStoreUser, myStoreName }: MonthlyReportProps) {
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

  // ── Template Download ────────────────────────────────────────────────────
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

  // ── Import ───────────────────────────────────────────────────────────────
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

  // ── Recap ────────────────────────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Export Recap XLSX ────────────────────────────────────────────────────
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

  // Build recap store groups
  const recapStoreGroups: { storeName: string; tafts: TaftEntry[] }[] = [];
  const seenS = new Set<string>();
  recapTafts.forEach(t => {
    if (!seenS.has(t.store_name)) {
      seenS.add(t.store_name);
      recapStoreGroups.push({ storeName: t.store_name, tafts: [] });
    }
    recapStoreGroups.find(g => g.storeName === t.store_name)!.tafts.push(t);
  });

  const MONTH_ID_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const fmtTglRecap = (d: Date) => `${String(d.getDate()).padStart(2,'0')} ${MONTH_ID_FULL[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div className="space-y-3">
      {/* ── Sub-tabs (import / recap) ──────────────────────────────────────── */}
      {user.attendance_report && (
        <div className="flex w-fit gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {(['import','recap'] as const).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${subTab === t ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              {t === 'import' ? 'Import' : 'Recap'}
            </button>
          ))}
        </div>
      )}

      {/* ── Import Sub-tab ────────────────────────────────────────────────── */}
      {subTab === 'import' && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            {isStoreUser ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500">Store:</span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{toTitleCase(myStoreName)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Store</label>
                <select value={selectedStore} onChange={e => { setSelectedStore(e.target.value); }}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20">
                  <option value="">Semua Store</option>
                  {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Bulan</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <Button variant="outline" size="sm" icon={Download} onClick={() => setShowDownloadModal(true)}>
              Template
            </Button>
            <label>
              <Button variant="outline" size="sm" icon={Upload} loading={importing} className="cursor-pointer">
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-1.5 text-[11px] font-semibold text-gray-700">Panduan</p>
            <p className="mb-2 text-[11px] text-gray-500">Download template XLSX → isi kolom <strong>clock_in</strong>, <strong>clock_out</strong>, <strong>code_time</strong>, <strong>overtime_hours</strong>, <strong>reason</strong> → Import kembali.</p>
            <p className="mb-2 text-[11px] text-gray-500">Format jam: <code className="rounded bg-gray-100 px-1">08:30</code> atau <code className="rounded bg-gray-100 px-1">08.30</code> (titik otomatis dikonversi ke titik dua).</p>
            <div className="flex flex-wrap gap-1.5">
              {RECAP_KEYS.map(({ key, label }) => (
                <span key={key} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CODE_COLORS[key] || 'bg-gray-100'}`}>
                  {key} = {label.replace(/\s*\(.*\)/, '')}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Recap Sub-tab ─────────────────────────────────────────────────── */}
      {subTab === 'recap' && user.attendance_report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Store</label>
              <select value={recapStore} onChange={e => setRecapStore(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20">
                <option value="">Semua Store</option>
                {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="whitespace-nowrap text-[11px] font-medium text-gray-500">Bulan</label>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchRecap}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              disabled={recapLoading || recapStoreGroups.length === 0}
              onClick={exportRecapXlsx}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Export XLSX
            </Button>
          </div>

          {recapLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">Memuat data...</div>
          ) : recapTafts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <EmptyState icon={FileSpreadsheet} title="Tidak ada data taft" />
            </div>
          ) : (
            <div className="space-y-4">
              {recapStoreGroups.map(({ storeName, tafts }) => (
                <div key={storeName}>
                  {!recapStore && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wide">{toTitleCase(storeName)}</span>
                      <span className="text-[10px] text-gray-400">{tafts.length} taft</span>
                      <div className="flex-1 h-px bg-primary/10" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {tafts.map(taft => {
                      const recap = calcRecap(taft);
                      const sd = parseInt(taft.start_date) || 26;
                      const ed = parseInt(taft.end_date)   || 25;
                      const { from, to } = buildTaftDateRange(selectedMonth, sd, ed);

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
                        <div key={taft.id} className="overflow-hidden rounded-xl border border-gray-200 text-[10px] shadow-sm">
                          <div className="border-b border-gray-200 bg-yellow-300 px-2 py-1 text-center">
                            <p className="font-black text-gray-900 uppercase text-[8px] leading-tight">
                              REKAPAN ABSEN {fmtTglRecap(from).toUpperCase()} - {fmtTglRecap(to).toUpperCase()}
                            </p>
                          </div>
                          <div className="flex items-center justify-between border-b border-gray-200 bg-green-400 px-2 py-1">
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

      {/* ── Download Template Modal ────────────────────────────────────────── */}
      <Modal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        icon={Download}
        title="Download Template XLSX"
        description="1 file berisi semua TAFT dalam store yang dipilih"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDownloadModal(false)}>Batal</Button>
            <Button
              variant="primary"
              className="ml-auto"
              disabled={!(isStoreUser ? myStoreName : selectedStore)}
              onClick={handleDownloadTemplate}
            >
              Download
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Store</label>
            {isStoreUser
              ? <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{toTitleCase(myStoreName)}</div>
              : <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20">
                  <option value="">Pilih Store</option>
                  {allStores.map(s => <option key={s} value={s}>{toTitleCase(s)}</option>)}
                </select>
            }
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bulan</label>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20" />
          </div>
          {(() => {
            const storeForPreview = isStoreUser ? myStoreName : selectedStore;
            if (!storeForPreview) return null;
            const taftsForPreview = taftList.filter(t => t.store_name?.toLowerCase() === storeForPreview.toLowerCase());
            if (taftsForPreview.length === 0) return null;
            const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
            return (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-[10px] font-semibold text-gray-600">{taftsForPreview.length} sheet yang akan dibuat:</p>
                {taftsForPreview.map(t => {
                  const sd = parseInt(t.start_date) || 26;
                  const ed = parseInt(t.end_date)   || 25;
                  const dates = buildTaftDates(selectedMonth, sd, ed);
                  const first = dates[0];
                  const last  = dates[dates.length - 1];
                  return (
                    <div key={t.id} className="flex items-center justify-between border-b border-gray-100 py-0.5 last:border-0">
                      <span className="truncate max-w-[200px] text-[11px] text-gray-700" title={t.taft_name}>{t.taft_name}</span>
                      <span className="ml-2 whitespace-nowrap text-[10px] text-primary">{fmt(first)} – {fmt(last)} ({dates.length}h)</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Modal>

      <Popup show={popup.show} message={popup.message} type={popup.type} onClose={() => setPopup(p => ({ ...p, show: false }))} />
    </div>
  );
}

// ── inline helper (normalizeTime used inside handleImport) ─────────────────
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
