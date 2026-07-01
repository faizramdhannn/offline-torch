"use client";

import { useState } from "react";
import type { SalesStat, StoreWagesEntry, TaftEntry, GroupedByTaft } from "./types";
import { OVERTIME_RATE } from "./constants";
import { parseCurrencyStr, fmtRupiah } from "./utils";

interface SalesWagesChartProps {
  salesData: SalesStat[];
  storeWages: StoreWagesEntry[];
  taftList: TaftEntry[];
  selectedMonth: string;
  groupedByTaft: GroupedByTaft;
}

export function SalesWagesChart({
  salesData,
  storeWages,
  taftList,
  selectedMonth,
  groupedByTaft,
}: SalesWagesChartProps) {
  const [activeStore, setActiveStore] = useState<string | null>(null);

  if (salesData.length === 0 && storeWages.length === 0) return null;

  // ── helpers ───────────────────────────────────────────────────────────────
  const wagesMap: Record<string, number> = {};
  storeWages.forEach(s => {
    wagesMap[s.store_name.toLowerCase()] = parseCurrencyStr(s.store_wages);
  });

  const taftCountMap: Record<string, number> = {};
  taftList.forEach(t => {
    const k = t.store_name.toLowerCase();
    taftCountMap[k] = (taftCountMap[k] || 0) + 1;
  });

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
    const salesRow         = salesData.find(s => s.store_name.toLowerCase() === store);
    const sales            = salesRow?.sales ?? 0;
    const gajiPerOrang     = wagesMap[store] || 0;
    const taftCount        = taftCountMap[store] || 0;
    const totalGaji        = gajiPerOrang * taftCount;
    const lemburJam        = lemburByStore[store] || 0;
    const biayaLembur      = lemburJam * OVERTIME_RATE;
    const totalPengeluaran = totalGaji + biayaLembur;
    const profit           = sales - totalPengeluaran;
    const ratio            = totalPengeluaran > 0 ? sales / totalPengeluaran : 0;
    return { store, sales, gajiPerOrang, totalGaji, biayaLembur, totalPengeluaran, taftCount, lemburJam, profit, ratio };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales       = rows.reduce((s, r) => s + r.sales, 0);
  const totalGaji        = rows.reduce((s, r) => s + r.totalGaji, 0);
  const totalBiayaLembur = rows.reduce((s, r) => s + r.biayaLembur, 0);
  const totalPengeluaran = totalGaji + totalBiayaLembur;
  const totalProfit      = totalSales - totalPengeluaran;

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
    r >  0   ? 'text-red-600 bg-red-50'           : 'text-gray-500 bg-gray-50';

  const profitColor = (n: number) => n >= 0 ? 'text-emerald-600' : 'text-red-500';

  // ── popup data ────────────────────────────────────────────────────────────
  const activeRow   = rows.find(r => r.store === activeStore);
  const activeTafts = taftList.filter(t => t.store_name.toLowerCase() === activeStore);

  interface TaftDetail {
    taft_name: string;
    gaji: number;
    lemburJam: number;
    biayaLembur: number;
    totalPengeluaran: number;
  }

  const taftDetails: TaftDetail[] = activeTafts.map(t => {
    const key    = `${t.store_name}__${t.taft_name}`;
    const entry  = groupedByTaft[key];
    const lemJam = entry
      ? entry.rows.reduce((s, r) => s + (parseFloat(r.overtime_hours || '0') || 0), 0)
      : 0;
    const biaya  = lemJam * OVERTIME_RATE;
    const gaji   = wagesMap[t.store_name.toLowerCase()] || 0;
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
          <p className="text-xs font-bold text-gray-700 tracking-wide">
            Sales vs Pengeluaran — {monthLabel}
          </p>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Total Sales',  val: totalSales,       cls: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Total Gaji',   val: totalGaji,        cls: 'text-orange-600 bg-orange-50 border-orange-100' },
              { label: 'Total Lembur', val: totalBiayaLembur, cls: 'text-purple-600 bg-purple-50 border-purple-100' },
              { label: 'Net',          val: totalProfit,      cls: `${totalProfit >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}` },
            ].map(({ label, val, cls }) => (
              <div key={label} className={`rounded-lg border px-3 py-1.5 text-center ${cls}`}>
                <p className="text-[8px] font-semibold uppercase opacity-70">{label}</p>
                <p className="text-[13px] font-black leading-tight">{fmtJt(val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Store cards grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {rows.map(r => {
            const isProfit = r.profit >= 0;
            return (
              <button
                key={r.store}
                onClick={() => setActiveStore(r.store)}
                className="text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-150 overflow-hidden group"
              >
                <div className="px-3 pt-2.5 pb-2 border-b border-gray-50">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="text-[11px] font-bold text-gray-800 capitalize truncate">{r.store}</p>
                    {r.ratio > 0 && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${ratioColor(r.ratio)}`}>
                        {r.ratio.toFixed(1)}×
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-500">{r.taftCount} TAFT</p>
                </div>

                <div className="px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 font-medium">Sales</span>
                    <span className="text-[10px] font-bold text-blue-600">{fmtJt(r.sales)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 font-medium">Gaji</span>
                    <span className="text-[10px] font-bold text-orange-500">{fmtJt(r.totalGaji)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 font-medium">Lembur</span>
                    <span className="text-[10px] font-bold text-purple-500">
                      {r.biayaLembur > 0 ? fmtJt(r.biayaLembur) : '—'}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-gray-500 font-semibold">Net</span>
                      <span className={`text-[11px] font-black ${profitColor(r.profit)}`}>
                        {isProfit ? '+' : ''}{fmtJt(r.profit)}
                      </span>
                    </div>
                  </div>
                </div>

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

                <div className="px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-primary font-medium text-center">Lihat detail →</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail modal per store ────────────────────────────────────────── */}
      {activeStore && activeRow && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveStore(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-black text-gray-800 capitalize">{activeStore}</p>
                <p className="text-[10px] text-gray-500">{activeRow.taftCount} TAFT · {monthLabel}</p>
              </div>
              <button
                onClick={() => setActiveStore(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-[11px] font-bold transition-colors"
              >✕</button>
            </div>

            <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
              {[
                { label: 'Sales',        val: activeRow.sales,      cls: 'text-blue-600'   },
                { label: 'Total Gaji',   val: activeRow.totalGaji,  cls: 'text-orange-500' },
                { label: 'Biaya Lembur', val: activeRow.biayaLembur,cls: 'text-purple-500' },
                { label: 'Net',          val: activeRow.profit,     cls: profitColor(activeRow.profit) },
              ].map(({ label, val, cls }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-[8px] text-gray-400 uppercase font-semibold mb-0.5">{label}</p>
                  <p className={`text-[12px] font-black ${cls}`}>
                    {label === 'Net' && val >= 0 ? '+' : ''}{fmtJt(val)}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {taftDetails.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Tidak ada data TAFT</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                      <th className="px-5 py-2.5 text-left font-semibold text-gray-500 text-[9px] uppercase tracking-wide">TAFT</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-orange-400 text-[9px] uppercase tracking-wide">Gaji</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-purple-400 text-[9px] uppercase tracking-wide">Jam Lembur</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-purple-400 text-[9px] uppercase tracking-wide">Biaya Lembur</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-500 text-[9px] uppercase tracking-wide">Total</th>
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
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-5 py-2.5 text-gray-700 text-[10px]">TOTAL</td>
                      <td className="px-4 py-2.5 text-right text-orange-600 text-[10px]">{fmtJt(activeRow.totalGaji)}</td>
                      <td className="px-4 py-2.5 text-right text-purple-600 text-[10px]">
                        {activeRow.lemburJam > 0 ? `${activeRow.lemburJam.toFixed(1)} jam` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-purple-600 text-[10px]">{fmtJt(activeRow.biayaLembur)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 text-[10px]">{fmtJt(activeRow.totalPengeluaran)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
              <p className="text-[9px] text-gray-400">
                Gaji/orang: <span className="font-semibold text-gray-700">{fmtJt(activeRow.gajiPerOrang)}</span>
                &nbsp;·&nbsp;Rate lembur: <span className="font-semibold text-gray-700">Rp17.500/jam</span>
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
