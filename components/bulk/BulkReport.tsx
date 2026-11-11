"use client";

import { useMemo, useState } from "react";
import { Boxes, Percent, Receipt, Users, Wallet } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { CHART_PALETTE, chartAxisTick, chartGridStroke, chartTooltipStyle } from "@/components/shared/chartStyles";
import { buildBulkReport, fmtCompactRp, type BulkGroup } from "@/lib/bulkOrder";
import { parseIdDateTime } from "@/lib/idDate";

const PIE_COLORS = ["#0f766e", "#be123c", "#f59e0b", "#a855f7", "#22c55e", "#1f2937", "#ef4444", "#64748b", "#0ea5e9", "#84cc16"];
const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const num = (n: number) => n.toLocaleString("id-ID");
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const PERIODS: { key: string; label: string; days: number }[] = [
  { key: "7", label: "7 hari", days: 7 },
  { key: "30", label: "30 hari", days: 30 },
  { key: "60", label: "60 hari", days: 60 },
  { key: "90", label: "90 hari", days: 90 },
  { key: "all", label: "Semua data dimuat", days: 0 },
];

function ChartCard({ title, subtitle, actions, children, className = "" }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

const NoData = () => <p className="py-12 text-center text-xs text-gray-400">Belum ada data</p>;

// Donut + daftar legenda (nama, jumlah, persen) di sampingnya — lebih terbaca daripada legenda bawaan untuk nama panjang.
function Donut({ data, nameKey, valueKey, valueLabel }: { data: any[]; nameKey: string; valueKey: string; valueLabel: (n: number) => string }) {
  const total = data.reduce((a, d) => a + d[valueKey], 0);
  if (!data.length) return <NoData />;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [valueLabel(Number(v)), n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {data.slice(0, 8).map((d, i) => (
          <li key={d[nameKey]} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-gray-700" title={d[nameKey]}>{d[nameKey]}</span>
            <span className="shrink-0 font-semibold text-gray-900">{valueLabel(d[valueKey])}</span>
            <span className="w-9 shrink-0 text-right text-gray-400">{total ? Math.round((d[valueKey] / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulkReport({ groups, showAll, onShowAll }: { groups: BulkGroup[]; showAll: boolean; onShowAll: (v: boolean) => void }) {
  const [period, setPeriod] = useState("30");
  const [store, setStore] = useState("");
  const [storeMetric, setStoreMetric] = useState<"value" | "inputs" | "qty">("value");

  const stores = useMemo(() => [...new Set(groups.map((g) => g.source_store))].sort(), [groups]);
  const filtered = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? 0;
    const since = days ? Date.now() - days * 86400000 : 0;
    return groups.filter((g) => (!store || g.source_store === store) && (!since || parseIdDateTime(g.created_at) >= since));
  }, [groups, period, store]);
  const r = useMemo(() => buildBulkReport(filtered), [filtered]);

  const fieldCls = "h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20";
  const metricLabel = { value: "Nilai", inputs: "Jumlah input", qty: "Qty" } as const;
  const fmtMetric = (v: number) => (storeMetric === "value" ? fmtCompactRp(v) : num(v));
  const storeData = r.byStore.slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={fieldCls} aria-label="Periode">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={store} onChange={(e) => setStore(e.target.value)} className={fieldCls} aria-label="Toko">
          <option value="">Semua toko</option>
          {stores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600" title="Secara bawaan hanya 120 hari terakhir yang dimuat">
          <input type="checkbox" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} /> Muat semua riwayat
        </label>
        <span className="ml-auto text-[11px] text-gray-400">{r.totals.inputs} input dianalisis</span>
      </div>

      {r.totals.inputs === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><EmptyState title="Belum ada data untuk periode ini" description="Ubah periode atau toko di atas." /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={Receipt} label="Total Input" value={num(r.totals.inputs)} sublabel={`${num(r.totals.customers)} customer unik`} />
            <StatCard icon={Boxes} label="Total Qty" value={num(r.totals.qty)} sublabel="pcs semua item" tone="info" />
            <StatCard icon={Wallet} label="Total Nilai (Gross)" value={fmtCompactRp(r.totals.value)} sublabel={`Net ${fmtCompactRp(r.totals.net)}`} tone="positive" />
            <StatCard icon={Percent} label="Closing Rate" value={`${r.totals.closingRate}%`} sublabel={`${r.totals.buy} buy · ${r.totals.notBuy} not buy`} tone={r.totals.closingRate >= 50 ? "positive" : "warning"} />
            <StatCard icon={Users} label="Rata-rata / Input" value={fmtCompactRp(r.totals.avgValue)} sublabel={rupiah(r.totals.avgValue)} />
          </div>

          <ChartCard title="Tren" subtitle={`Nilai (batang) dan jumlah input (garis) per ${r.trendUnit === "week" ? "minggu" : "hari"}`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={r.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.25} vertical={false} />
                  <XAxis dataKey="label" tick={chartAxisTick} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis yAxisId="v" tick={chartAxisTick} tickFormatter={(v) => fmtCompactRp(v).replace("Rp ", "")} width={46} />
                  <YAxis yAxisId="i" orientation="right" tick={chartAxisTick} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [n === "Nilai" ? rupiah(Number(v)) : num(Number(v)), n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="v" dataKey="value" name="Nilai" fill={CHART_PALETTE[2]} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="i" dataKey="inputs" name="Input" stroke={CHART_PALETTE[1]} strokeWidth={2} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard
              title="Per Toko"
              subtitle="10 toko teratas"
              actions={
                <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-[10px] font-medium">
                  {(Object.keys(metricLabel) as (keyof typeof metricLabel)[]).map((k) => (
                    <button key={k} onClick={() => setStoreMetric(k)} className={`rounded-md px-2 py-1 ${storeMetric === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{metricLabel[k]}</button>
                  ))}
                </div>
              }
            >
              <div style={{ height: Math.max(180, storeData.length * 28 + 20) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...storeData].sort((a, b) => b[storeMetric] - a[storeMetric])} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.25} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="store" tick={chartAxisTick} width={124} tickFormatter={(v) => cut(String(v), 20)} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => [storeMetric === "value" ? rupiah(Number(v)) : num(Number(v)), metricLabel[storeMetric]]} />
                    <Bar dataKey={storeMetric} fill={CHART_PALETTE[2]} radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 10, fill: "#334155", formatter: (v: any) => fmtMetric(Number(v)) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Top 10 Produk" subtitle="Berdasarkan qty">
              {r.topProducts.length === 0 ? <NoData /> : (
                <div style={{ height: Math.max(180, r.topProducts.length * 28 + 20) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.topProducts} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} strokeOpacity={0.25} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={chartAxisTick} width={128} tickFormatter={(v) => cut(String(v), 20)} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, _n: any, p: any) => [`${num(Number(v))} pcs · ${rupiah(p?.payload?.value ?? 0)}`, p?.payload?.code]} />
                      <Bar dataKey="qty" fill={CHART_PALETTE[1]} radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 10, fill: "#334155" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard title="Reason Buy" subtitle="Alasan customer jadi membeli (jumlah input)">
              <Donut data={r.reasonBuy} nameKey="name" valueKey="count" valueLabel={num} />
            </ChartCard>

            <ChartCard title="Reason Not Buy" subtitle="Alasan customer tidak membeli (jumlah input)">
              <Donut data={r.reasonNotBuy} nameKey="name" valueKey="count" valueLabel={num} />
            </ChartCard>

            <ChartCard title="Kategori" subtitle="Berdasarkan qty">
              <Donut data={r.byCategory} nameKey="category" valueKey="qty" valueLabel={num} />
            </ChartCard>

            <ChartCard title="Customer Terbesar" subtitle="5 teratas berdasarkan nilai">
              <table className="w-full text-[11px]" data-stack="off">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="py-1 pr-2 font-semibold">Customer</th>
                    <th className="px-2 py-1 text-right font-semibold">Input</th>
                    <th className="px-2 py-1 text-right font-semibold">Qty</th>
                    <th className="py-1 pl-2 text-right font-semibold">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {r.topCustomers.map((c, i) => (
                    <tr key={i}>
                      <td className="max-w-[180px] py-1.5 pr-2"><span className="block truncate font-medium text-gray-900" title={c.name}>{c.name}</span><span className="block truncate text-[10px] text-gray-400">{[c.institution, c.store].filter(Boolean).join(" · ")}</span></td>
                      <td className="px-2 py-1.5 text-right">{c.inputs}</td>
                      <td className="px-2 py-1.5 text-right">{num(c.qty)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{fmtCompactRp(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
