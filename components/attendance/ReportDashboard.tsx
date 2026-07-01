"use client";

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
import type { TaftStat, ChartKey, GroupedByTaft } from "./types";
import { CHART_CFGS, DONUT_COLORS, OVERTIME_RATE } from "./constants";
import { toTitleCase, truncName, fmtRupiah } from "./utils";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// ─── MiniBarChart ───────────────────────────────────────────────────────────
interface MiniBarChartProps {
  data: TaftStat[];
  cfg: typeof CHART_CFGS[number];
  maxRows?: number;
}

export function MiniBarChart({ data, cfg, maxRows = 43 }: MiniBarChartProps) {
  const rows   = data.filter(s => s[cfg.key] > 0).slice(0, maxRows);
  const maxVal = rows[0]?.[cfg.key] || 1;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-[10px] text-gray-400">
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
            <span className={`text-[8px] font-black w-3.5 text-right shrink-0 ${i === 0 ? cfg.textCls : 'text-gray-400'}`}>
              {i + 1}
            </span>
            <div className="w-28 shrink-0">
              <p className="text-[9px] font-medium text-gray-700 leading-tight" title={s.taft_name}>
                {truncName(s.taft_name, 15)}
              </p>
              <p className="text-[8px] text-gray-400">{toTitleCase(s.store_name)}</p>
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

// ─── ReportDashboard ────────────────────────────────────────────────────────
interface ReportDashboardProps {
  groupedByTaft: GroupedByTaft;
}

export function ReportDashboard({ groupedByTaft }: ReportDashboardProps) {
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

  const totalLemburJam   = stats.reduce((s, d) => s + d.lembur, 0);
  const totalBiayaLembur = totalLemburJam * OVERTIME_RATE;

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
  const shiftLabels   = shiftOrder.filter(k => codeCounts[k] > 0);
  const shiftValues   = shiftLabels.map(k => codeCounts[k]);
  const shiftBgColors = shiftLabels.map(k => shiftColors[k] || '#9ca3af');

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
      {/* ── KPI top cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {CHART_CFGS.map(cfg => {
          const top = sorted(cfg.key).find(s => s[cfg.key] > 0);
          return (
            <div key={cfg.key} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5">
              <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${cfg.textCls}`}>{cfg.label}</p>
              {top ? (
                <>
                  <p className="text-[11px] font-bold text-gray-800 leading-tight" title={top.taft_name}>
                    {truncName(top.taft_name, 18)}
                  </p>
                  <p className="text-[9px] text-gray-400">{toTitleCase(top.store_name)}</p>
                  <p className={`text-lg font-black leading-none mt-1 ${cfg.textCls}`}>
                    {cfg.key === 'lembur' ? top[cfg.key].toFixed(1) : top[cfg.key]}
                    <span className="text-[9px] font-normal ml-0.5 text-gray-400">{cfg.unit}</span>
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-gray-400">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mini bar charts per KPI ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {CHART_CFGS.map(cfg => (
          <div key={cfg.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-[10px] font-bold uppercase tracking-wide ${cfg.textCls}`}>{cfg.label}</h3>
              <span className="text-[9px] text-gray-400">{sorted(cfg.key).filter(s => s[cfg.key] > 0).length}</span>
            </div>
            <MiniBarChart data={sorted(cfg.key)} cfg={cfg} />
          </div>
        ))}
      </div>

      {/* ── Bottom charts row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Donut: lembur distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-2">Distribusi lembur per TAFT</p>
          {top10Lembur.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-400">Tidak ada data lembur</div>
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
                  <span key={s.taft_name} className="flex items-center gap-1 text-[8px] text-gray-500">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    {truncName(s.taft_name, 12)} <span className="font-bold text-gray-700">{s.lembur.toFixed(1)}j</span>
                  </span>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] text-gray-400">Total jam lembur</p>
                <p className="text-[13px] font-bold text-orange-500">{totalLemburJam.toFixed(1)} jam</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Estimasi biaya lembur</p>
                <p className="text-[13px] font-bold text-orange-600">{fmtRupiah(totalBiayaLembur)}</p>
                <p className="text-[8px] text-gray-400 mt-0.5">@ Rp 17.500/jam</p>
              </div>
            </>
          )}
        </div>

        {/* Bar: shift distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Distribusi kode shift</p>
          {shiftLabels.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-400">Tidak ada data</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 mb-2">
                {shiftLabels.map((k, i) => (
                  <span key={k} className="flex items-center gap-1 text-[8px] text-gray-500">
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

        {/* Bar: masuk vs off per store */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Masuk vs Off per toko</p>
          <div className="flex gap-3 mb-2">
            <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Masuk</span>
            <span className="flex items-center gap-1 text-[8px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-red-500" /> Off</span>
          </div>
          <div style={{ position: 'relative', height: '160px' }}>
            <Bar data={barStoreData} options={{ ...chartBaseOptions, scales: { x: { ticks: { font: { size: 8 }, maxRotation: 30 } }, y: { ticks: { font: { size: 9 }, stepSize: 5 } } }, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>

      {/* ── Second row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Top 8 biaya lembur */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1">Top 8 biaya lembur</p>
          <p className="text-[8px] text-gray-400 mb-2">@ Rp 17.500/jam</p>
          {top8Lembur.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-400">Tidak ada data</div>
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

        {/* Ketidakhadiran per TAFT */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Ketidakhadiran per TAFT</p>
          <div className="flex gap-3 mb-2">
            {[{ label:'Cuti',color:'#ec4899'},{ label:'Sakit',color:'#f97316'},{ label:'Izin',color:'#6366f1'},{ label:'Alpa',color:'#b91c1c'}].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1 text-[8px] text-gray-500">
                <span className="w-2 h-2 rounded-sm" style={{ background: color }} />{label}
              </span>
            ))}
          </div>
          {top8Absen.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-gray-400">Tidak ada data absensi</div>
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
