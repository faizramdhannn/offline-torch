"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { CHART_PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";
import { thClass, tdClass, tableWrapClass, tableClass, theadClass, trHoverClass } from "@/components/shared/tableStyles";
import { cn } from "@/lib/utils";

interface StoReport {
  id: string;
  store: string;
  date_sto: string;
  variance_qty: string;
  variance_value: string;
  inventory_accuracy_qty_percent: string;
  inventory_accuracy_value_percent: string;
  matched_skus: string;
  total_sku: string;
}

interface OpnameChartsProps {
  reports: StoReport[];
  isDark: boolean;
  css: Record<string, string>;
}

function parsePercent(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(",", ".").replace("%", "").trim()) || 0;
}

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  const s = String(val).trim();
  // Accounting notation: "(4.000)" means -4000 — not handled by a plain numeric strip.
  const isNegParen = s.startsWith("(") && s.endsWith(")");
  const cleaned = s.replace(/[()]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned) || 0;
  return isNegParen ? -Math.abs(n) : n;
}

function fmtRp(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `Rp${(v / 1_000_000_000).toFixed(2)}Bn`;
  if (Math.abs(v) >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(1)}Jt`;
  return `Rp${v.toLocaleString("id-ID")}`;
}

function StatTile({ label, value, sub, css }: { label: string; value: string; sub?: string; css: Record<string, string> }) {
  return (
    <div
      style={{
        background: css.cardBg,
        border: `1px solid ${css.cardBorder}`,
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: css.cardShadow,
      }}
    >
      <p style={{ fontSize: 10, color: css.textMuted, margin: 0, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 800, color: css.textHeading, margin: "2px 0 0" }}>{value}</p>
      {sub && <p style={{ fontSize: 9.5, color: css.textMuted, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

export function OpnameCharts({ reports, isDark, css }: OpnameChartsProps) {
  const stats = useMemo(() => {
    if (reports.length === 0) {
      return { avgAccQty: 0, avgAccValue: 0, totalVarianceValue: 0, totalSku: 0, matchedSkus: 0 };
    }
    const avgAccQty = reports.reduce((s, r) => s + parsePercent(r.inventory_accuracy_qty_percent), 0) / reports.length;
    const avgAccValue = reports.reduce((s, r) => s + parsePercent(r.inventory_accuracy_value_percent), 0) / reports.length;
    const totalVarianceValue = reports.reduce((s, r) => s + Math.abs(parseNum(r.variance_value)), 0);
    const totalSku = reports.reduce((s, r) => s + parseNum(r.total_sku), 0);
    const matchedSkus = reports.reduce((s, r) => s + parseNum(r.matched_skus), 0);
    return { avgAccQty, avgAccValue, totalVarianceValue, totalSku, matchedSkus };
  }, [reports]);

  const trendData = useMemo(() => {
    const byDate = new Map<string, { date: string; sum: number; count: number }>();
    for (const r of reports) {
      const date = r.date_sto || "-";
      const entry = byDate.get(date) || { date, sum: 0, count: 0 };
      entry.sum += parsePercent(r.inventory_accuracy_qty_percent);
      entry.count += 1;
      byDate.set(date, entry);
    }
    return [...byDate.values()]
      .map((e) => ({ date: e.date, accuracy: +(e.sum / e.count).toFixed(1) }))
      .slice(-30);
  }, [reports]);

  const varianceByStore = useMemo(() => {
    const byStore = new Map<string, number>();
    for (const r of reports) {
      const key = r.store || "Unknown";
      byStore.set(key, (byStore.get(key) || 0) + Math.abs(parseNum(r.variance_value)));
    }
    return [...byStore.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [reports]);

  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : chartGridStroke;
  const axisTick = isDark ? { ...chartAxisTick, fill: "#64748b" } : chartAxisTick;
  const tooltipStyle = isDark
    ? { ...chartTooltipStyle, background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", color: "#f1f5f9" }
    : chartTooltipStyle;

  if (reports.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <StatTile label="Avg Accuracy (Qty)" value={`${stats.avgAccQty.toFixed(1)}%`} css={css} />
        <StatTile label="Avg Accuracy (Value)" value={`${stats.avgAccValue.toFixed(1)}%`} css={css} />
        <StatTile label="Total Variance Value" value={fmtRp(stats.totalVarianceValue)} css={css} />
        <StatTile label="Total SKU" value={stats.totalSku.toLocaleString("id-ID")} css={css} />
        <StatTile
          label="Matched SKU"
          value={stats.matchedSkus.toLocaleString("id-ID")}
          sub={stats.totalSku > 0 ? `${((stats.matchedSkus / stats.totalSku) * 100).toFixed(1)}% dari total` : undefined}
          css={css}
        />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: css.cardBg, border: `1px solid ${css.cardBorder}`, borderRadius: 10, padding: "12px 14px", boxShadow: css.cardShadow }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: css.textHeading, margin: "0 0 8px" }}>Inventory Accuracy Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={{ ...axisTick, fontSize: 9 }} />
              <YAxis tick={axisTick} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="accuracy" name="Accuracy Qty %" stroke="#0d334d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: css.cardBg, border: `1px solid ${css.cardBorder}`, borderRadius: 10, padding: "12px 14px", boxShadow: css.cardShadow }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: css.textHeading, margin: "0 0 8px" }}>Top Variance Value by Store</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={varianceByStore} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={axisTick} tickFormatter={fmtRp} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v?: number) => fmtRp(v ?? 0)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {varianceByStore.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compact data table */}
      <div className={tableWrapClass} style={{ borderColor: css.cardBorder }}>
        <table className={tableClass}>
          <thead className={theadClass} style={{ background: isDark ? "rgba(255,255,255,0.03)" : undefined }}>
            <tr>
              <th className={thClass} style={{ color: css.textMuted }}>Tanggal</th>
              <th className={thClass} style={{ color: css.textMuted }}>Store</th>
              <th className={cn(thClass, "text-right")} style={{ color: css.textMuted }}>Accuracy Qty</th>
              <th className={cn(thClass, "text-right")} style={{ color: css.textMuted }}>Accuracy Value</th>
              <th className={cn(thClass, "text-right")} style={{ color: css.textMuted }}>Variance Qty</th>
              <th className={cn(thClass, "text-right")} style={{ color: css.textMuted }}>Variance Value</th>
            </tr>
          </thead>
          <tbody>
            {reports.slice(0, 50).map((r) => (
              <tr key={r.id} className={trHoverClass} style={{ borderTop: `1px solid ${css.cardBorder}` }}>
                <td className={tdClass} style={{ color: css.textHeading }}>{r.date_sto}</td>
                <td className={tdClass} style={{ color: css.textHeading, textTransform: "capitalize" }}>{r.store}</td>
                <td className={cn(tdClass, "text-right")} style={{ color: css.textHeading }}>{parsePercent(r.inventory_accuracy_qty_percent).toFixed(1)}%</td>
                <td className={cn(tdClass, "text-right")} style={{ color: css.textHeading }}>{parsePercent(r.inventory_accuracy_value_percent).toFixed(1)}%</td>
                <td className={cn(tdClass, "text-right")} style={{ color: css.textHeading }}>{parseNum(r.variance_qty).toLocaleString("id-ID")}</td>
                <td className={cn(tdClass, "text-right")} style={{ color: css.textHeading }}>{fmtRp(parseNum(r.variance_value))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length > 50 && (
          <div style={{ padding: "8px 12px", fontSize: 10.5, color: css.textMuted, textAlign: "center" }}>
            Menampilkan 50 dari {reports.length} laporan — gunakan filter untuk mempersempit.
          </div>
        )}
      </div>
    </div>
  );
}
