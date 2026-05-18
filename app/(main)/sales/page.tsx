"use client";

import React from "react";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_STORES = [
  "lembong", "margonda", "karawaci", "jogja", "makassar",
  "cirebon", "purwokerto", "karawang", "pekalongan", "lampung",
  "surabaya", "malang", "tambun", "medan",
];

const STORE_LABELS: Record<string, string> = {
  lembong: "Lembong", margonda: "Margonda", karawaci: "Karawaci",
  jogja: "Jogja", makassar: "Makassar", cirebon: "Cirebon",
  purwokerto: "Purwokerto", karawang: "Karawang", pekalongan: "Pekalongan",
  lampung: "Lampung", surabaya: "Surabaya", malang: "Malang",
  tambun: "Tambun", medan: "Medan",
};

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

const MONTHS_SHORT = [
  "Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des",
];

const DAYS = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseVal(v: string | null | undefined): number {
  if (!v) return 0;
  return parseInt(String(v).replace(/[^0-9]/g, "")) || 0;
}

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return `Rp${(v / 1_000_000_000).toFixed(2)}Bn`;
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(1)}Jt`;
  if (v > 0) return `Rp${v.toLocaleString("id-ID")}`;
  return "";
}

function fmtRpShort(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}Bn`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}Jt`;
  return v.toLocaleString("id-ID");
}

function fmtRpCell(v: number): string {
  // Compact format for calendar cells
  if (v >= 1_000_000_000) return `Rp${(v / 1_000_000_000).toFixed(3)}Bn`;
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(3)}Jt`;
  return `Rp${v.toLocaleString("id-ID")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// Indonesian month name → 0-indexed
const ID_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  // English fallback
  january: 0, february: 1, march: 2, may: 4, june: 5,
  july: 6, august: 7, october: 9, december: 11,
};

/**
 * Parse date string supporting multiple formats:
 * - "1 April 2026"  (Indonesian full)
 * - "1 Mei 2026"
 * - "2026-04-01"    (ISO)
 * - "01/04/2026"    (DD/MM/YYYY)
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // Try "D Month YYYY" or "D Month YYYY" with Indonesian/English month names
  const idMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (idMatch) {
    const day = parseInt(idMatch[1]);
    const monthKey = idMatch[2].toLowerCase();
    const year = parseInt(idMatch[3]);
    const month = ID_MONTHS[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }

  // Try ISO "YYYY-MM-DD"
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // Try "DD/MM/YYYY"
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  }

  // Native fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getYear(dateStr: string): number {
  const d = parseDate(dateStr);
  return d ? d.getFullYear() : 0;
}

function getMonth(dateStr: string): number {
  const d = parseDate(dateStr);
  return d ? d.getMonth() : -1;
}

function getDay(dateStr: string): number {
  const d = parseDate(dateStr);
  return d ? d.getDate() : 0;
}

// ─── Gauge SVG ────────────────────────────────────────────────────────────────
function GaugeChart({ pct, value, label, color = "#0ea5e9" }: {
  pct: number; value: string; label: string; color?: string;
}) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  // Semicircle: center at (100, 90), radius 72
  const r = 72;
  const cx = 100;
  const cy = 88;

  function polar(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Arc from -180° (left) to 0° (right) = top semicircle
  const bgStart = polar(-180);
  const bgEnd = polar(0);
  const angle = -180 + (clamped / 100) * 180;
  const fgEnd = polar(angle);
  const fgLarge = clamped > 50;

  function arcPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    large: boolean
  ) {
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large ? 1 : 0} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, padding: "0 4px" }}>
      <svg width="100%" viewBox="0 0 200 100" style={{ overflow: "visible" }}>
        {/* Background track */}
        <path
          d={arcPath(bgStart, bgEnd, true)}
          fill="none" stroke="#e2e8f0" strokeWidth={14} strokeLinecap="round"
        />
        {/* Value arc */}
        {clamped > 0.5 && (
          <path
            d={arcPath(bgStart, fgEnd, fgLarge)}
            fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
          />
        )}
        {/* Percentage */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize={17} fontWeight="800">
          {pct.toFixed(2)}%
        </text>
        {/* Value below pct */}
        <text x={cx} y={cy + 7} textAnchor="middle" fill="#64748b" fontSize={9.5} fontWeight="500">
          {value}
        </text>
        {/* Min/Max labels */}
        <text x={bgStart.x - 2} y={cy + 18} textAnchor="end" fill="#94a3b8" fontSize={8}>0</text>
        <text x={bgEnd.x + 2} y={cy + 18} textAnchor="start" fill="#94a3b8" fontSize={8}>Target</text>
      </svg>
      <p style={{
        fontSize: 9.5, fontWeight: 700, color: "#1e3a5f",
        textAlign: "center", margin: "2px 0 0", lineHeight: 1.3,
        paddingInline: 2,
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── Trend Tooltip ────────────────────────────────────────────────────────────
const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, padding: "8px 12px", fontSize: 11,
    }}>
      <p style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 4 }}>Tgl {label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
            {typeof p.value === "number" ? fmtRp(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Calendar Grid ────────────────────────────────────────────────────────────
function CalendarGrid({
  year, month, title, cellData, targetData, trafficData, showConditional,
}: {
  year: number;
  month: number;
  title: string;
  cellData: Record<number, number>;
  targetData: Record<number, number>;
  trafficData?: Record<number, number>;
  showConditional: boolean;
}) {
  const totalDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const cellHeight = showConditional ? 70 : 60;

  return (
    <div style={{ background: "#1a3a5c", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
      {/* Title */}
      <div style={{ padding: "10px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ color: "white", fontWeight: 800, fontSize: 13, margin: 0 }}>{title}</p>
        <p style={{ color: "#93c5fd", fontSize: 10, margin: 0 }}>{MONTHS_SHORT[month]} {year}</p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {DAYS.map((d) => (
              <th key={d} style={{
                padding: "5px 4px", textAlign: "center",
                color: "#93c5fd", fontSize: 9, fontWeight: 600,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.15)",
              }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) {
                  return (
                    <td key={di} style={{
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "rgba(0,0,0,0.25)",
                      height: cellHeight,
                    }} />
                  );
                }

                const val = cellData[day] || 0;
                const tgt = targetData[day] || 0;
                const traffic = trafficData?.[day] || 0;
                const isAboveTarget = showConditional && val > 0 && tgt > 0 && val >= tgt;
                const hasValue = val > 0;

                let bg = "white";
                let dayNumColor = "#9ca3af";
                let valueColor = "#374151";
                let trafficColor = "#6b7280";

                if (showConditional) {
                  if (isAboveTarget) {
                    bg = "#4ade80";
                    dayNumColor = "#14532d";
                    valueColor = "#14532d";
                    trafficColor = "#166534";
                  } else if (hasValue) {
                    bg = "white";
                    dayNumColor = "#9ca3af";
                    valueColor = "#1e293b";
                    trafficColor = "#64748b";
                  } else {
                    bg = "white";
                    dayNumColor = "#9ca3af";
                  }
                } else {
                  if (hasValue) {
                    bg = "#e8f4f8";
                    dayNumColor = "#334155";
                    valueColor = "#0f172a";
                  } else {
                    bg = "white";
                    dayNumColor = "#9ca3af";
                  }
                }

                return (
                  <td key={di} style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: bg,
                    verticalAlign: "top",
                    padding: "5px 7px",
                    height: cellHeight,
                    overflow: "hidden",
                  }}>
                    {/* Day number */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: dayNumColor, marginBottom: 3 }}>{day}</div>
                    {/* Sales value — bigger */}
                    {hasValue && (
                      <div style={{ fontSize: 10, fontWeight: 800, color: valueColor, lineHeight: 1.25 }}>
                        {fmtRpCell(val)}
                      </div>
                    )}
                    {/* Traffic — smaller, only on right calendar */}
                    {showConditional && traffic > 0 && (
                      <div style={{
                        fontSize: 8.5, fontWeight: 500, color: trafficColor,
                        marginTop: 2, lineHeight: 1.2,
                        display: "flex", alignItems: "center", gap: 2,
                      }}>
                        <span style={{ opacity: 0.7 }}>👤</span>
                        {traffic.toLocaleString("id-ID")}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Select style ─────────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 6,
  fontSize: 11, background: "white", color: "#374151", outline: "none", cursor: "pointer",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<Record<string, any>[]>([]);
  const [targetSales, setTargetSales] = useState<Record<string, any>[]>([]);
  const [channelTraffic, setChannelTraffic] = useState<Record<string, any>[]>([]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selStore, setSelStore] = useState<string>("all");

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    [...dailySales, ...targetSales].forEach((r) => {
      const y = getYear(r.sales_date || "");
      if (y > 0) ys.add(y);
    });
    if (ys.size === 0) ys.add(currentYear);
    return [...ys].sort((a, b) => b - a);
  }, [dailySales, targetSales]);

  const detectedStores = useMemo(() => {
    const all = [...dailySales, ...targetSales, ...channelTraffic];
    if (all.length === 0) return ALL_STORES;
    const cols = new Set<string>();
    all.forEach((r) => {
      Object.keys(r).forEach((k) => {
        if (k !== "sales_date" && k !== "traffic_date" && k.trim() !== "") cols.add(k.trim());
      });
    });
    return ALL_STORES.filter((s) => cols.has(s)).concat(
      [...cols].filter((c) => !ALL_STORES.includes(c) && c !== "sales_date" && c !== "traffic_date")
    );
  }, [dailySales, targetSales, channelTraffic]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.sales_view && !parsed.sales_view_all) { router.push("/dashboard"); return; }
    setUser(parsed);
    if (parsed.sales_view && !parsed.sales_view_all) {
      setSelStore(parsed.user_name?.toLowerCase() || "all");
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales?type=all");
      const json = await res.json();
      setDailySales(json.dailySales || []);
      setTargetSales(json.targetSales || []);
      setChannelTraffic(json.channelTraffic || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isLocked = user && user.sales_view && !user.sales_view_all;

  const activeStores = useMemo(() => {
    if (isLocked) {
      const uname = user?.user_name?.toLowerCase() || "";
      return detectedStores.filter((s) => s === uname);
    }
    if (selStore === "all") return detectedStores;
    return [selStore];
  }, [isLocked, selStore, detectedStores, user]);

  function filterRows(rows: Record<string, any>[], dateKey: string) {
    return rows.filter((r) => getYear(r[dateKey] || "") === selYear && getMonth(r[dateKey] || "") === selMonth);
  }

  const filteredDaily = useMemo(() => filterRows(dailySales, "sales_date"), [dailySales, selYear, selMonth]);
  const filteredTarget = useMemo(() => filterRows(targetSales, "sales_date"), [targetSales, selYear, selMonth]);
  const filteredTraffic = useMemo(() => filterRows(channelTraffic, "traffic_date"), [channelTraffic, selYear, selMonth]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSales = filteredDaily.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalTarget = filteredTarget.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalTraffic = filteredTraffic.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const daysWithSales = filteredDaily.filter((r) => activeStores.some((st) => parseVal(r[st]) > 0)).length;
    const avgDaily = daysWithSales > 0 ? totalSales / daysWithSales : 0;
    const aov = totalTraffic > 0 ? totalSales / totalTraffic : 0;
    const salesPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

    const totalDays = daysInMonth(selYear, selMonth);
    const today = new Date();
    const isCurrentMonth = selYear === today.getFullYear() && selMonth === today.getMonth();
    const remainingDays = isCurrentMonth ? Math.max(0, totalDays - today.getDate()) : 0;
    const forecast = totalSales + remainingDays * avgDaily;
    const forecastPct = totalTarget > 0 ? (forecast / totalTarget) * 100 : 0;

    return { totalSales, totalTarget, totalTraffic, avgDaily, aov, salesPct, forecast, forecastPct, daysWithSales, isCurrentMonth };
  }, [filteredDaily, filteredTarget, filteredTraffic, activeStores, selYear, selMonth]);

  // ── Trend chart ───────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const allDates = new Set<string>();
    filteredDaily.forEach((r) => allDates.add(r.sales_date));
    filteredTarget.forEach((r) => allDates.add(r.sales_date));
    return [...allDates].sort().map((date) => {
      const dRow = filteredDaily.find((r) => r.sales_date === date) || {};
      const tRow = filteredTarget.find((r) => r.sales_date === date) || {};
      const sales = activeStores.reduce((s, st) => s + parseVal(dRow[st]), 0);
      const target = activeStores.reduce((s, st) => s + parseVal(tRow[st]), 0);
      return { label: String(getDay(date)), sales, target };
    });
  }, [filteredDaily, filteredTarget, activeStores]);

  // ── Calendar maps ─────────────────────────────────────────────────────────
  const calendarSales = useMemo(() => {
    const map: Record<number, number> = {};
    filteredDaily.forEach((r) => {
      const day = getDay(r.sales_date);
      if (day > 0) map[day] = (map[day] || 0) + activeStores.reduce((s, st) => s + parseVal(r[st]), 0);
    });
    return map;
  }, [filteredDaily, activeStores]);

  const calendarTarget = useMemo(() => {
    const map: Record<number, number> = {};
    filteredTarget.forEach((r) => {
      const day = getDay(r.sales_date);
      if (day > 0) map[day] = (map[day] || 0) + activeStores.reduce((s, st) => s + parseVal(r[st]), 0);
    });
    return map;
  }, [filteredTarget, activeStores]);

  const calendarTraffic = useMemo(() => {
    const map: Record<number, number> = {};
    filteredTraffic.forEach((r) => {
      const day = getDay(r.traffic_date);
      if (day > 0) map[day] = (map[day] || 0) + activeStores.reduce((s, st) => s + parseVal(r[st]), 0);
    });
    return map;
  }, [filteredTraffic, activeStores]);

  if (!user) return null;
  const lockedStore = isLocked ? (user.user_name?.toLowerCase() || "") : null;

  return (
    <div className="flex-1 overflow-auto" style={{ background: "#eef2f7" }}>
      <div style={{ padding: "16px 18px" }}>

        {/* ── Header & Filters ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#1e3a5c", margin: 0, letterSpacing: "-0.02em" }}>
              Daily Target vs Achievement
            </h1>
            {lockedStore && (
              <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                {STORE_LABELS[lockedStore] || lockedStore} · {MONTHS[selMonth]} {selYear}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} style={selectStyle}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} style={selectStyle}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            {!isLocked && (
              <select value={selStore} onChange={(e) => setSelStore(e.target.value)} style={selectStyle}>
                <option value="all">All Stores</option>
                {detectedStores.map((s) => <option key={s} value={s}>{STORE_LABELS[s] || s}</option>)}
              </select>
            )}
            <button onClick={fetchData} style={{
              padding: "4px 12px", background: "#1e3a5c", color: "white",
              border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer",
            }}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
            <p style={{ color: "#64748b" }}>Loading data...</p>
          </div>
        ) : (
          <>
            {/* ── TOP: Gauges + Stats + Trend ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 12, marginBottom: 12 }}>

              {/* Left panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Gauges — 2 only */}
                <div style={{
                  background: "white", borderRadius: 10, padding: "12px 8px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <GaugeChart pct={stats.salesPct} value={fmtRp(stats.totalSales)} label="Net Sales MTD vs Target MTD" color="#0ea5e9" />
                    <div style={{ width: 1, background: "#e2e8f0", alignSelf: "stretch", margin: "8px 0" }} />
                    <GaugeChart pct={stats.forecastPct} value={fmtRp(Math.round(stats.forecast))} label="Est Net Sales vs Target MTD" color="#0ea5e9" />
                  </div>
                </div>

                {/* Stat grid */}
                <div style={{
                  background: "white", borderRadius: 10, padding: "12px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                    {[
                      { label: "Avg Net Daily", value: fmtRp(Math.round(stats.avgDaily)) },
                      { label: "Net Sales MTD", value: fmtRp(stats.totalSales) },
                      { label: "Est Net Sales", value: fmtRp(Math.round(stats.forecast)) },
                      { label: "% Est Net Sales", value: `${stats.forecastPct.toFixed(2)}%` },
                      { label: "AOV per Transaksi", value: fmtRp(Math.round(stats.aov)) },
                      { label: "Total Traffic", value: stats.totalTraffic.toLocaleString("id-ID") },
                    ].map((item) => (
                      <div key={item.label} style={{ borderBottom: "1px solid #f8fafc", paddingBottom: 5 }}>
                        <p style={{ fontSize: 9.5, color: "#94a3b8", margin: 0, fontWeight: 500 }}>{item.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Trend chart */}
              <div style={{
                background: "white", borderRadius: 10, padding: "14px 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", margin: 0 }}>Net Sales Trend</p>
                  <div style={{ display: "flex", gap: 14, fontSize: 10, color: "#64748b" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", display: "inline-block" }} />
                      Net Sales
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
                      Target Net Sales Daily
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={215}>
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradT" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmtRpShort(v)} width={54} />
                    <Tooltip content={<TrendTooltip />} />
                    <Area type="monotone" dataKey="target" name="Target" stroke="#eab308" strokeWidth={1.5}
                      fill="url(#gradT)" dot={false} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="sales" name="Net Sales" stroke="#0ea5e9" strokeWidth={2.5}
                      fill="url(#gradS)" dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── BOTTOM: Calendar grids ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <CalendarGrid
                year={selYear}
                month={selMonth}
                title="Target Net Sales by Date"
                cellData={calendarTarget}
                targetData={{}}
                showConditional={false}
              />
              <CalendarGrid
                year={selYear}
                month={selMonth}
                title="Net Sales by Date"
                cellData={calendarSales}
                targetData={calendarTarget}
                trafficData={calendarTraffic}
                showConditional={true}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}