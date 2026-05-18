"use client";

import React from "react";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useMemo, useCallback } from "react";
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

function fmtRpExact(v: number): string {
  return `Rp${v.toLocaleString("id-ID")}`;
}

function fmtRpShort(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}Bn`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}Jt`;
  return v.toLocaleString("id-ID");
}

function fmtRpCell(v: number): string {
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

const ID_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  january: 0, february: 1, march: 2, may: 4, june: 5,
  july: 6, august: 7, october: 9, december: 11,
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  const idMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (idMatch) {
    const day = parseInt(idMatch[1]);
    const monthKey = idMatch[2].toLowerCase();
    const year = parseInt(idMatch[3]);
    const month = ID_MONTHS[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) return new Date(year, month, day);
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getYear(dateStr: string): number { const d = parseDate(dateStr); return d ? d.getFullYear() : 0; }
function getMonth(dateStr: string): number { const d = parseDate(dateStr); return d ? d.getMonth() : -1; }
function getDay(dateStr: string): number { const d = parseDate(dateStr); return d ? d.getDate() : 0; }

// ─── Donut Progress Card ───────────────────────────────────────────────────────
function GaugeChart({ pct, value, label, color = "#0ea5e9", targetValue, actualValue, gaugeTrack = "#e2e8f0", labelColor = "#1e3a5f", valueColor: valueTxtColor = "#64748b" }: {
  pct: number; value: string; label: string; color?: string;
  targetValue?: string; actualValue?: string;
  gaugeTrack?: string; labelColor?: string; valueColor?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const clamped = Math.min(Math.max(pct, 0), 100);
  const size    = 116;
  const strokeW = 12;
  const r       = (size - strokeW) / 2;
  const circ    = 2 * Math.PI * r;
  const dash    = (clamped / 100) * circ;
  const gap     = circ - dash;
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, padding: "14px 8px 8px", position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, padding: "8px 12px", fontSize: 10,
          zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 4, fontSize: 10 }}>{label}</div>
          {actualValue && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
              <span style={{ color: "#94a3b8" }}>Aktual</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{actualValue}</span>
            </div>
          )}
          {targetValue && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
              <span style={{ color: "#94a3b8" }}>Target</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{targetValue}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ color: "#94a3b8" }}>Pencapaian</span>
            <span style={{ color: pct >= 100 ? "#4ade80" : color, fontWeight: 700 }}>{pct.toFixed(2)}%</span>
          </div>
        </div>
      )}
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ display: "block" }}>
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={gaugeTrack} strokeWidth={strokeW} />
          {clamped > 0.1 && (
            <circle cx={size/2} cy={size/2} r={r}
              fill="none" stroke={color} strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={circ / 4}
            />
          )}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", lineHeight: 1.25,
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{pct.toFixed(2)}%</span>
          <span style={{ fontSize: 8, color: valueTxtColor, fontWeight: 500, marginTop: 2 }}>{value}</span>
        </div>
      </div>
      <p style={{
        fontSize: 9, fontWeight: 700, color: labelColor,
        textAlign: "center", margin: "6px 0 0", lineHeight: 1.3, paddingInline: 4,
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── Trend Tooltip ─────────────────────────────────────────────────────────────
const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  // fullDate is carried in the data point; label is just the day number
  const fullDate = payload[0]?.payload?.fullDate || `Tanggal ${label}`;
  return (
    <div style={{
      background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8, padding: "10px 14px", fontSize: 11,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 6px" }}>{fullDate}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 3 }}>
          <span style={{ color: p.color, fontWeight: 500 }}>{p.name}</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>
            {typeof p.value === "number" ? fmtRpExact(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Calendar Cell Tooltip ──────────────────────────────────────────────────────
interface CellTooltipData {
  day: number;
  sales: number;
  target: number;
  traffic: number;
  showConditional: boolean;
}

function CellTooltip({ data, x, y }: { data: CellTooltipData; x: number; y: number }) {
  const pct = data.target > 0 ? (data.sales / data.target) * 100 : 0;
  const isRight = x > window.innerWidth / 2;

  return (
    <div style={{
      position: "fixed",
      left: isRight ? x - 200 : x + 12,
      top: Math.min(y - 10, window.innerHeight - 180),
      background: "#0f172a",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 11,
      zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      minWidth: 180,
      pointerEvents: "none",
    }}>
      <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 8px", fontSize: 12 }}>
        Tanggal {data.day}
      </p>
      {data.showConditional ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Net Sales</span>
            <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(data.sales)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Target</span>
            <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(data.target)}</span>
          </div>
          {data.target > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <span style={{ color: "#94a3b8" }}>Pencapaian</span>
              <span style={{ color: pct >= 100 ? "#4ade80" : "#f59e0b", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
            </div>
          )}
          {data.traffic > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>Traffic</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{data.traffic.toLocaleString("id-ID")}</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#94a3b8" }}>Target</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(data.target)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({
  year, month, title, cellData, targetData, trafficData, showConditional, css,
}: {
  year: number;
  month: number;
  title: string;
  cellData: Record<number, number>;
  targetData: Record<number, number>;
  trafficData?: Record<number, number>;
  showConditional: boolean;
  css: Record<string, string>;
}) {
  const [tooltip, setTooltip] = useState<{ data: CellTooltipData; x: number; y: number } | null>(null);

  const totalDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div
      style={{ background: css.calBg, borderRadius: 10, overflow: "visible", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: "100%", transition: "background 0.2s" }}
      onMouseLeave={() => setTooltip(null)}
    >
      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x > (typeof window !== "undefined" ? window.innerWidth / 2 : 700) ? tooltip.x - 200 : tooltip.x + 12,
          top: Math.min(tooltip.y - 10, typeof window !== "undefined" ? window.innerHeight - 180 : 600),
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 11,
          zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          minWidth: 180,
          pointerEvents: "none",
        }}>
          <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 8px", fontSize: 12 }}>
            Tanggal {tooltip.data.day}
          </p>
          {tooltip.data.showConditional ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <span style={{ color: "#94a3b8" }}>Net Sales</span>
                <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.sales)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <span style={{ color: "#94a3b8" }}>Target</span>
                <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.target)}</span>
              </div>
              {tooltip.data.target > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <span style={{ color: "#94a3b8" }}>Pencapaian</span>
                  <span style={{
                    color: (tooltip.data.sales / tooltip.data.target) * 100 >= 100 ? "#4ade80" : "#f59e0b",
                    fontWeight: 700,
                  }}>
                    {((tooltip.data.sales / tooltip.data.target) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {tooltip.data.traffic > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#94a3b8" }}>Traffic</span>
                  <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{tooltip.data.traffic.toLocaleString("id-ID")}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#94a3b8" }}>Target</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.target)}</span>
            </div>
          )}
        </div>
      )}

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
                      background: css.cellBgEmpty,
                      height: 68,
                    }} />
                  );
                }

                const val = cellData[day] || 0;
                const tgt = targetData[day] || 0;
                const traffic = trafficData?.[day] || 0;
                const isAboveTarget = showConditional && val > 0 && tgt > 0 && val >= tgt;
                // For left calendar: val IS the target amount (cellData=calendarTarget)
                // For right calendar: val is actual sales
                const hasValue = val > 0;

                const isDarkMode = css.cellBg !== "white";
                let bg = css.cellBg;
                let dayNumColor = "#9ca3af";
                let valueColor = isDarkMode ? "#e2e8f0" : "#374151";
                let trafficColor = isDarkMode ? "#64748b" : "#6b7280";

                if (showConditional) {
                  if (isAboveTarget) {
                    bg = "#4ade80"; dayNumColor = "#14532d"; valueColor = "#14532d"; trafficColor = "#166534";
                  } else if (hasValue) {
                    bg = css.cellBg; dayNumColor = "#9ca3af";
                    valueColor = isDarkMode ? "#e2e8f0" : "#1e293b";
                    trafficColor = isDarkMode ? "#64748b" : "#64748b";
                  } else {
                    bg = css.cellBg; dayNumColor = isDarkMode ? "#4b5563" : "#9ca3af";
                  }
                } else {
                  if (hasValue) {
                    bg = css.cellBgVal;
                    dayNumColor = isDarkMode ? "#93c5fd" : "#334155";
                    valueColor = isDarkMode ? "#e2e8f0" : "#0f172a";
                  } else {
                    bg = css.cellBg; dayNumColor = isDarkMode ? "#4b5563" : "#9ca3af";
                  }
                }

                const handleMouseEnter = (e: React.MouseEvent) => {
                  const rect = (e.target as HTMLElement).closest("td")?.getBoundingClientRect();
                  if (!rect) return;
                  if (val === 0 && tgt === 0 && traffic === 0) return;
                  setTooltip({
                    data: {
                      day,
                      // For left calendar (showConditional=false): cellData IS the target
                      sales: showConditional ? val : 0,
                      target: showConditional ? tgt : val,
                      traffic,
                      showConditional,
                    },
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                };

                return (
                  <td
                    key={di}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: bg,
                      verticalAlign: "top",
                      padding: "5px 7px",
                      height: 68,
                      overflow: "hidden",
                      cursor: hasValue || (tgt > 0) ? "pointer" : "default",
                      transition: "filter 0.1s",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: dayNumColor, marginBottom: 2 }}>{day}</div>
                    {hasValue && (
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: valueColor, lineHeight: 1.2 }}>
                        {fmtRpCell(val)}
                      </div>
                    )}
                    {showConditional && traffic > 0 && (
                      <div style={{
                        fontSize: 8, fontWeight: 500, color: trafficColor,
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

// ─── Select style ──────────────────────────────────────────────────────────────
// selectStyle is now built dynamically inside the component using css vars
const selectStyle = (css: any): React.CSSProperties => ({
  padding: "4px 8px", border: `1px solid ${css.selectBorder}`, borderRadius: 6,
  fontSize: 11, background: css.selectBg, color: css.selectColor, outline: "none", cursor: "pointer",
});

// ─── Main Page ─────────────────────────────────────────────────────────────────
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

  // ── Stats ──────────────────────────────────────────────────────────────────
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

  // ── Trend chart — correct date sort + full date label for tooltip ──────────
  const trendData = useMemo(() => {
    // Build a map keyed by day-of-month (1..31) for the selected month
    const totalDaysInMonth = daysInMonth(selYear, selMonth);
    const result = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dRow = filteredDaily.find((r) => getDay(r.sales_date) === day) || {};
      const tRow = filteredTarget.find((r) => getDay(r.sales_date) === day) || {};
      const sales  = activeStores.reduce((s, st) => s + parseVal((dRow as any)[st]), 0);
      const target = activeStores.reduce((s, st) => s + parseVal((tRow as any)[st]), 0);
      // Full date string for tooltip: "1 Mei 2026"
      const fullDate = `${day} ${MONTHS[selMonth]} ${selYear}`;
      result.push({ label: String(day), fullDate, sales, target });
    }
    return result;
  }, [filteredDaily, filteredTarget, activeStores, selYear, selMonth]);

  // ── Calendar maps ──────────────────────────────────────────────────────────
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

  // Detect Tailwind dark mode (html.dark class set by next-themes / system)
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const DM = isDark;
  const css = {
    pageBg:      DM ? "#0f1724" : "#eef2f7",
    cardBg:      DM ? "#1e293b" : "white",
    cardShadow:  DM ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.07)",
    textHeading: DM ? "#e2e8f0" : "#1e3a5c",
    textSub:     DM ? "#94a3b8" : "#64748b",
    textValue:   DM ? "#f1f5f9" : "#1e293b",
    textMuted:   DM ? "#64748b" : "#94a3b8",
    divider:     DM ? "rgba(255,255,255,0.08)" : "#f8fafc",
    dividerLine: DM ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    gaugeTrack:  DM ? "#334155" : "#e2e8f0",
    selectBg:    DM ? "#1e293b" : "white",
    selectColor: DM ? "#e2e8f0" : "#374151",
    selectBorder:DM ? "#334155" : "#cbd5e1",
    calBg:       DM ? "#0f1e35" : "#1a3a5c",
    cellBg:      DM ? "#1e293b" : "white",
    cellBgVal:   DM ? "#243447" : "#e8f4f8",
    cellBgEmpty: DM ? "#111827" : "rgba(0,0,0,0.25)",
  };

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ background: css.pageBg, width: "100%", minWidth: 0, transition: "background 0.2s" }}
    >
      <div style={{ padding: "16px 18px", width: "100%", boxSizing: "border-box" }}>

        {/* ── Header & Filters ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: css.textHeading, margin: 0, letterSpacing: "-0.02em" }}>
              Daily Target vs Achievement
            </h1>
            {lockedStore && (
              <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>
                {STORE_LABELS[lockedStore] || lockedStore} · {MONTHS[selMonth]} {selYear}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))} style={selectStyle(css)}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))} style={selectStyle(css)}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            {!isLocked && (
              <select value={selStore} onChange={(e) => setSelStore(e.target.value)} style={selectStyle(css)}>
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
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.7fr)",
              gap: 12,
              marginBottom: 12,
              width: "100%",
            }}>

              {/* Left panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

                {/* Gauges — fixed height, centered, no overflow */}
                <div style={{
                  background: css.cardBg, borderRadius: 10,
                  boxShadow: css.cardShadow,
                  padding: "12px 12px 4px",
                  overflow: "hidden",
                  transition: "background 0.2s",
                }}>
                  <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                    <GaugeChart
                      pct={stats.salesPct}
                      value={fmtRp(stats.totalSales)}
                      label="Net Sales MTD vs Target MTD"
                      color="#0ea5e9"
                      actualValue={fmtRpExact(stats.totalSales)}
                      targetValue={fmtRpExact(stats.totalTarget)}
                      gaugeTrack={css.gaugeTrack}
                      labelColor={css.textHeading}
                      valueColor={css.textMuted}
                    />
                    <div style={{ width: 1, background: css.dividerLine, margin: "8px 0" }} />
                    <GaugeChart
                      pct={stats.forecastPct}
                      value={fmtRp(Math.round(stats.forecast))}
                      label="Est Net Sales vs Target MTD"
                      color="#0ea5e9"
                      actualValue={fmtRpExact(Math.round(stats.forecast))}
                      targetValue={fmtRpExact(stats.totalTarget)}
                      gaugeTrack={css.gaugeTrack}
                      labelColor={css.textHeading}
                      valueColor={css.textMuted}
                    />
                  </div>
                </div>

                {/* Stat grid */}
                <div style={{
                  background: css.cardBg, borderRadius: 10, padding: "12px 16px",
                  boxShadow: css.cardShadow, transition: "background 0.2s",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                    {[
                      { label: "Avg Net Daily", value: fmtRp(Math.round(stats.avgDaily)) },
                      { label: "Net Sales MTD", value: fmtRp(stats.totalSales) },
                      { label: "Est Net Sales", value: fmtRp(Math.round(stats.forecast)) },
                      { label: "% Est Net Sales", value: `${stats.forecastPct.toFixed(2)}%` },
                      { label: "Total Traffic", value: stats.totalTraffic.toLocaleString("id-ID") },
                    ].map((item) => (
                      <div key={item.label} style={{ borderBottom: `1px solid ${css.divider}`, paddingBottom: 5 }}>
                        <p style={{ fontSize: 9.5, color: css.textMuted, margin: 0, fontWeight: 500 }}>{item.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: css.textValue, margin: 0 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Trend chart */}
              <div style={{
                background: css.cardBg, borderRadius: 10, padding: "14px 16px",
                boxShadow: css.cardShadow, minWidth: 0, transition: "background 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: css.textValue, margin: 0 }}>Net Sales Trend</p>
                  <div style={{ display: "flex", gap: 14, fontSize: 10, color: css.textSub }}>
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
                    <YAxis
                      tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => fmtRpShort(v)} width={54}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Area type="monotone" dataKey="target" name="Target" stroke="#eab308" strokeWidth={1.5}
                      fill="url(#gradT)" dot={false} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="sales" name="Net Sales" stroke="#0ea5e9" strokeWidth={2.5}
                      fill="url(#gradS)" dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── BOTTOM: Calendar grids — equal width, full width ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              width: "100%",
              alignItems: "start",
            }}>
              <CalendarGrid
                year={selYear}
                month={selMonth}
                title="Target Net Sales by Date"
                cellData={calendarTarget}
                targetData={{}}
                showConditional={false}
                css={css}
              />
              <CalendarGrid
                year={selYear}
                month={selMonth}
                title="Net Sales by Date"
                cellData={calendarSales}
                targetData={calendarTarget}
                trafficData={calendarTraffic}
                showConditional={true}
                css={css}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}