"use client";

import React from "react";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { Button } from "@/components/shared/Button";
import { chartAxisTick } from "@/components/shared/chartStyles";

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

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}Jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("id-ID");
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

// ─── Spreadsheet icon SVG ──────────────────────────────────────────────────────
function SpreadsheetIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#1a7a4a"/>
      <rect x="8" y="12" width="32" height="24" rx="2" fill="white" fillOpacity="0.15"/>
      <rect x="8" y="12" width="32" height="6" fill="white" fillOpacity="0.25"/>
      <line x1="8" y1="24" x2="40" y2="24" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="8" y1="30" x2="40" y2="30" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="20" y1="12" x2="20" y2="36" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="30" y1="12" x2="30" y2="36" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <text x="24" y="10" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="sans-serif">S</text>
    </svg>
  );
}

// ─── Spreadsheet List/Card Views ───────────────────────────────────────────────
interface SpreadsheetEntry {
  id: string;
  month: string;
  year: string;
  store: string;
  spreadsheet_link_url: string;
  spreadsheet_id: string;
}

const MONTH_ORDER: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function getMonthOrder(month: string): number {
  return MONTH_ORDER[month.toLowerCase()] ?? 99;
}

function SpreadsheetCard({ entry, isDark }: { entry: SpreadsheetEntry; isDark: boolean }) {
  const [hovered, setHovered] = useState(false);
  const storeName = STORE_LABELS[entry.store.toLowerCase()] || entry.store;

  return (
    <a
      href={entry.spreadsheet_link_url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "16px 12px 12px", borderRadius: 10,
        background: isDark ? hovered ? "#243447" : "#1e293b" : hovered ? "#f0f7ff" : "white",
        border: `1px solid ${isDark ? hovered ? "#3b82f6" : "rgba(255,255,255,0.08)" : hovered ? "#3b82f6" : "#e2e8f0"}`,
        boxShadow: hovered ? "0 4px 16px rgba(59,130,246,0.2)" : isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer", textDecoration: "none", transition: "all 0.15s ease",
        gap: 10, userSelect: "none",
      }}
    >
      <SpreadsheetIcon size={40} />
      <div style={{ textAlign: "center", width: "100%", minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#e2e8f0" : "#1e293b", margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {storeName}
        </p>
        <p style={{ fontSize: 9.5, color: isDark ? "#64748b" : "#94a3b8", margin: "2px 0 0", fontWeight: 500 }}>
          {entry.month} {entry.year}
        </p>
      </div>
    </a>
  );
}

function SpreadsheetListItem({ entry, isDark, index }: { entry: SpreadsheetEntry; isDark: boolean; index: number }) {
  const [hovered, setHovered] = useState(false);
  const storeName = STORE_LABELS[entry.store.toLowerCase()] || entry.store;

  return (
    <a
      href={entry.spreadsheet_link_url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "auto 1fr 1fr auto",
        alignItems: "center", gap: 12, padding: "9px 14px", borderRadius: 8,
        background: isDark ? hovered ? "#243447" : index % 2 === 0 ? "#1e293b" : "transparent" : hovered ? "#f0f7ff" : index % 2 === 0 ? "#f8fafc" : "white",
        border: `1px solid ${isDark ? hovered ? "#3b82f6" : "transparent" : hovered ? "#3b82f6" : "transparent"}`,
        cursor: "pointer", textDecoration: "none", transition: "all 0.12s ease", userSelect: "none",
      }}
    >
      <SpreadsheetIcon size={28} />
      <p style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#e2e8f0" : "#1e293b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {storeName}
      </p>
      <p style={{ fontSize: 11, color: isDark ? "#94a3b8" : "#64748b", margin: 0, fontWeight: 500 }}>
        {entry.month} {entry.year}
      </p>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke={hovered ? "#3b82f6" : isDark ? "#475569" : "#cbd5e1"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transition: "stroke 0.12s" }}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  );
}

function SpreadsheetListSection({
  entries, isDark, css, isLocked, userStore,
}: {
  entries: SpreadsheetEntry[]; isDark: boolean; css: Record<string, string>; isLocked: boolean; userStore: string;
}) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterStore, setFilterStore] = useState<string>("all");

  const visibleEntries = useMemo(() => {
    if (isLocked) return entries.filter(e => e.store.toLowerCase() === userStore.toLowerCase());
    return entries;
  }, [entries, isLocked, userStore]);

  const availableMonths = useMemo(() => {
    const set = new Set(visibleEntries.map(e => e.month));
    return [...set].sort((a, b) => getMonthOrder(a) - getMonthOrder(b));
  }, [visibleEntries]);

  const availableYears = useMemo(() => {
    const set = new Set(visibleEntries.map(e => e.year));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [visibleEntries]);

  const availableStores = useMemo(() => {
    const set = new Set(visibleEntries.map(e => e.store.toLowerCase()));
    return [...set].sort();
  }, [visibleEntries]);

  const filtered = useMemo(() => {
    return visibleEntries.filter(e => {
      if (filterMonth !== "all" && e.month.toLowerCase() !== filterMonth.toLowerCase()) return false;
      if (filterYear !== "all" && e.year !== filterYear) return false;
      if (!isLocked && filterStore !== "all" && e.store.toLowerCase() !== filterStore) return false;
      return true;
    });
  }, [visibleEntries, filterMonth, filterYear, filterStore, isLocked]);

  const grouped = useMemo(() => {
    const map = new Map<string, SpreadsheetEntry[]>();
    filtered.forEach(e => {
      const key = `${e.month} ${e.year}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return [...map.entries()].sort(([a], [b]) => {
      const [am, ay] = a.split(" ");
      const [bm, by] = b.split(" ");
      if (ay !== by) return Number(ay) - Number(by);
      return getMonthOrder(am) - getMonthOrder(bm);
    });
  }, [filtered]);

  const selectSty: React.CSSProperties = {
    padding: "4px 8px", border: `1px solid ${css.selectBorder}`, borderRadius: 6,
    fontSize: 11, background: css.selectBg, color: css.selectColor, outline: "none", cursor: "pointer",
  };

  const iconBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 8px",
    border: `1px solid ${active ? "#3b82f6" : isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 6,
    background: active ? (isDark ? "#1e3a5c" : "#eff6ff") : "transparent",
    color: active ? "#3b82f6" : isDark ? "#64748b" : "#94a3b8",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s",
  });

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={selectSty}>
            <option value="all">Semua Tahun</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={selectSty}>
            <option value="all">Semua Bulan</option>
            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {!isLocked && (
            <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={selectSty}>
              <option value="all">Semua Store</option>
              {availableStores.map(s => <option key={s} value={s}>{STORE_LABELS[s] || s}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setViewMode("card")} style={iconBtn(viewMode === "card")} title="Card view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <button onClick={() => setViewMode("list")} style={iconBtn(viewMode === "list")} title="List view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", color: isDark ? "#475569" : "#94a3b8" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Tidak ada data</p>
          <p style={{ fontSize: 11, margin: "4px 0 0" }}>Coba ubah filter pencarian</p>
        </div>
      )}

      {viewMode === "card" && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {grouped.map(([groupKey, items]) => (
            <div key={groupKey}>
              <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {groupKey}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                {items.map((entry, idx) => (
                  <SpreadsheetCard key={`${entry.id}-${groupKey}-${idx}`} entry={entry} isDark={isDark} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "list" && filtered.length > 0 && (
        <div style={{ background: isDark ? "#1e293b" : "white", borderRadius: 10, border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`, overflow: "hidden", boxShadow: isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", padding: "8px 14px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9"}`, background: isDark ? "rgba(0,0,0,0.2)" : "#f8fafc" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8", width: 40, textTransform: "uppercase" }}>&nbsp;</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Periode</span>
            <span style={{ width: 20 }}>&nbsp;</span>
          </div>
          <div>
            {filtered.map((entry, i) => (
              <SpreadsheetListItem key={`${entry.id}-${i}`} entry={entry} isDark={isDark} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Donut Progress Card ───────────────────────────────────────────────────────
function GaugeChart({ pct, value, label, color = "#0ea5e9", targetValue, actualValue, gaugeTrack = "#e2e8f0", labelColor = "#1e3a5f", valueColor: valueTxtColor = "#64748b" }: {
  pct: number; value: string; label: string; color?: string;
  targetValue?: string; actualValue?: string; gaugeTrack?: string; labelColor?: string; valueColor?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const clamped = Math.min(Math.max(pct, 0), 100);
  const size = 116; const strokeW = 12; const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r; const dash = (clamped / 100) * circ; const gap = circ - dash;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, padding: "14px 8px 8px", position: "relative" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && (
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", fontSize: 10, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          <div style={{ color: "#93c5fd", fontWeight: 700, marginBottom: 4, fontSize: 10 }}>{label}</div>
          {actualValue && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 2 }}><span style={{ color: "#94a3b8" }}>Aktual</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{actualValue}</span></div>}
          {targetValue && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 2 }}><span style={{ color: "#94a3b8" }}>Target</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{targetValue}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: "#94a3b8" }}>Pencapaian</span><span style={{ color: pct >= 100 ? "#4ade80" : color, fontWeight: 700 }}>{pct.toFixed(2)}%</span></div>
        </div>
      )}
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ display: "block" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={gaugeTrack} strokeWidth={strokeW} />
          {clamped > 0.1 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={circ / 4} />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.25 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{pct.toFixed(2)}%</span>
          <span style={{ fontSize: 8, color: valueTxtColor, fontWeight: 500, marginTop: 2 }}>{value}</span>
        </div>
      </div>
      <p style={{ fontSize: 9, fontWeight: 700, color: labelColor, textAlign: "center", margin: "6px 0 0", lineHeight: 1.3, paddingInline: 4 }}>{label}</p>
    </div>
  );
}

// ─── Tooltips ──────────────────────────────────────────────────────────────────
const TrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fullDate = payload[0]?.payload?.fullDate || `Tanggal ${label}`;
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
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

const OrderTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fullDate = payload[0]?.payload?.fullDate || `Tanggal ${label}`;
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
      <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 6px" }}>{fullDate}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 3 }}>
          <span style={{ color: p.color, fontWeight: 500 }}>{p.name}</span>
          <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{typeof p.value === "number" ? p.value.toLocaleString("id-ID") : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({
  year, month, title, cellData, targetData, trafficData, showConditional, css,
}: {
  year: number; month: number; title: string; cellData: Record<number, number>;
  targetData: Record<number, number>; trafficData?: Record<number, number>;
  showConditional: boolean; css: Record<string, string>;
}) {
  const [tooltip, setTooltip] = useState<{ data: any; x: number; y: number } | null>(null);
  const totalDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ background: css.calBg, borderRadius: 10, overflow: "visible", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", width: "100%", transition: "background 0.2s" }}
      onMouseLeave={() => setTooltip(null)}>
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x > (typeof window !== "undefined" ? window.innerWidth / 2 : 700) ? tooltip.x - 200 : tooltip.x + 12, top: Math.min(tooltip.y - 10, typeof window !== "undefined" ? window.innerHeight - 180 : 600), background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", minWidth: 180, pointerEvents: "none" }}>
          <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 8px", fontSize: 12 }}>Tanggal {tooltip.data.day}</p>
          {tooltip.data.showConditional ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}><span style={{ color: "#94a3b8" }}>Net Sales</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.sales)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}><span style={{ color: "#94a3b8" }}>Target</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.target)}</span></div>
              {tooltip.data.target > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}><span style={{ color: "#94a3b8" }}>Pencapaian</span><span style={{ color: (tooltip.data.sales / tooltip.data.target) * 100 >= 100 ? "#4ade80" : "#f59e0b", fontWeight: 700 }}>{((tooltip.data.sales / tooltip.data.target) * 100).toFixed(1)}%</span></div>}
              {tooltip.data.traffic > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#94a3b8" }}>Traffic</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{tooltip.data.traffic.toLocaleString("id-ID")}</span></div>}
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#94a3b8" }}>Target</span><span style={{ color: "#f1f5f9", fontWeight: 700 }}>{fmtRpExact(tooltip.data.target)}</span></div>
          )}
        </div>
      )}
      <div style={{ padding: "10px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ color: "white", fontWeight: 800, fontSize: 13, margin: 0 }}>{title}</p>
        <p style={{ color: "#93c5fd", fontSize: 10, margin: 0 }}>{MONTHS_SHORT[month]} {year}</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>{DAYS.map((d) => <th key={d} style={{ padding: "5px 4px", textAlign: "center", color: "#93c5fd", fontSize: 9, fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.15)" }}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) return <td key={di} style={{ border: "1px solid rgba(255,255,255,0.07)", background: css.cellBgEmpty, height: 68 }} />;
                const val = cellData[day] || 0;
                const tgt = targetData[day] || 0;
                const traffic = trafficData?.[day] || 0;
                const isAboveTarget = showConditional && val > 0 && tgt > 0 && val >= tgt;
                const hasValue = val > 0;
                const isDarkMode = css.cellBg !== "white";
                let bg = css.cellBg; let dayNumColor = "#9ca3af"; let valueColor = isDarkMode ? "#e2e8f0" : "#374151"; let trafficColor = isDarkMode ? "#64748b" : "#6b7280";
                if (showConditional) {
                  if (isAboveTarget) { bg = "#4ade80"; dayNumColor = "#14532d"; valueColor = "#14532d"; trafficColor = "#166534"; }
                  else if (hasValue) { bg = css.cellBg; dayNumColor = "#9ca3af"; valueColor = isDarkMode ? "#e2e8f0" : "#1e293b"; trafficColor = isDarkMode ? "#64748b" : "#64748b"; }
                  else { bg = css.cellBg; dayNumColor = isDarkMode ? "#4b5563" : "#9ca3af"; }
                } else {
                  if (hasValue) { bg = css.cellBgVal; dayNumColor = isDarkMode ? "#93c5fd" : "#334155"; valueColor = isDarkMode ? "#e2e8f0" : "#0f172a"; }
                  else { bg = css.cellBg; dayNumColor = isDarkMode ? "#4b5563" : "#9ca3af"; }
                }
                const handleMouseEnter = (e: React.MouseEvent) => {
                  const rect = (e.target as HTMLElement).closest("td")?.getBoundingClientRect();
                  if (!rect) return;
                  if (val === 0 && tgt === 0 && traffic === 0) return;
                  setTooltip({ data: { day, sales: showConditional ? val : 0, target: showConditional ? tgt : val, traffic, showConditional }, x: rect.left + rect.width / 2, y: rect.top });
                };
                return (
                  <td key={di} onMouseEnter={handleMouseEnter} onMouseLeave={() => setTooltip(null)}
                    style={{ border: "1px solid rgba(255,255,255,0.07)", background: bg, verticalAlign: "top", padding: "5px 7px", height: 68, overflow: "hidden", cursor: hasValue || (tgt > 0) ? "pointer" : "default", transition: "filter 0.1s" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: dayNumColor, marginBottom: 2 }}>{day}</div>
                    {hasValue && <div style={{ fontSize: 9.5, fontWeight: 800, color: valueColor, lineHeight: 1.2 }}>{fmtRpCell(val)}</div>}
                    {showConditional && traffic > 0 && <div style={{ fontSize: 8, fontWeight: 500, color: trafficColor, marginTop: 2, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 2 }}><span style={{ opacity: 0.7 }}>👤</span>{traffic.toLocaleString("id-ID")}</div>}
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
const selectStyle = (css: any): React.CSSProperties => ({
  padding: "4px 8px", border: `1px solid ${css.selectBorder}`, borderRadius: 6,
  fontSize: 11, background: css.selectBg, color: css.selectColor, outline: "none", cursor: "pointer",
});

// ─── Mini Stat Card ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, css }: { label: string; value: string; sub?: string; css: Record<string, string> }) {
  return (
    <div style={{ borderBottom: `1px solid ${css.divider}`, paddingBottom: 5 }}>
      <p style={{ fontSize: 9.5, color: css.textMuted, margin: 0, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: css.textValue, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: css.textSub, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ─── Metric Trend Chart ────────────────────────────────────────────────────────
type MetricKey = "sales" | "orders" | "qty" | "upt" | "scr";

const METRIC_CONFIG: Record<MetricKey, { label: string; color: string; isRp: boolean; isPct: boolean; decimals: number }> = {
  sales:  { label: "Sales",  color: "#0ea5e9", isRp: true,  isPct: false, decimals: 0 },
  orders: { label: "Orders", color: "#f97316", isRp: false, isPct: false, decimals: 0 },
  qty:    { label: "Qty",    color: "#10b981", isRp: false, isPct: false, decimals: 0 },
  upt:    { label: "UPT",   color: "#a855f7", isRp: false, isPct: false, decimals: 2 },
  scr:    { label: "SCR",   color: "#eab308", isRp: false, isPct: true,  decimals: 1 },
};

function MetricTrendChart({
  trendData, orderTrendData, css, isDark,
}: {
  trendData: any[];
  orderTrendData: any[];
  css: Record<string, string>;
  isDark: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>("sales");
  const cfg = METRIC_CONFIG[metric];
  const isSales = metric === "sales";

  const merged = useMemo(() => {
    return trendData.map((t) => {
      const o       = orderTrendData.find((r) => r.label === t.label) || {};
      const orders  = (o as any).orders || 0;
      const qty     = (o as any).qty    || 0;
      const traffic = (t as any).traffic || 0;
      const upt     = orders > 0 ? +(qty / orders).toFixed(2) : 0;
      const scr     = traffic > 0 ? +((orders / traffic) * 100).toFixed(1) : 0;
      return { ...t, orders, qty, upt, scr };
    });
  }, [trendData, orderTrendData]);

  const fmtY = (v: number) => {
    if (isSales || cfg.isRp) return fmtRpShort(v);
    if (cfg.isPct) return `${v.toFixed(cfg.decimals)}%`;
    return fmtNum(v);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || `Tanggal ${label}`;
    return (
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
        <p style={{ color: "#93c5fd", fontWeight: 700, margin: "0 0 6px" }}>{fullDate}</p>
        {payload.map((p: any, i: number) => {
          const display = isSales
            ? fmtRpExact(p.value ?? 0)
            : cfg.isPct
            ? `${Number(p.value ?? 0).toFixed(cfg.decimals)}%`
            : `${Number(p.value ?? 0).toFixed(cfg.decimals)}`;
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: i > 0 ? 3 : 0 }}>
              <span style={{ color: p.color, fontWeight: 500 }}>{p.name}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{display}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const btnStyle = (m: MetricKey): React.CSSProperties => {
    const active = metric === m;
    const c = METRIC_CONFIG[m].color;
    return {
      padding: "3px 10px", fontSize: 10, fontWeight: active ? 700 : 500, borderRadius: 6,
      border: `1px solid ${active ? c : isDark ? "#334155" : "#e2e8f0"}`,
      background: active ? `${c}22` : "transparent",
      color: active ? c : isDark ? "#64748b" : "#94a3b8",
      cursor: "pointer", transition: "all 0.12s",
    };
  };

  return (
    // ✅ FIX: flex: 1 + display flex column agar card stretch penuh
    <div style={{
      background: css.cardBg,
      borderRadius: 10,
      padding: "14px 16px",
      boxShadow: css.cardShadow,
      minWidth: 0,
      transition: "background 0.2s",
      display: "flex",
      flexDirection: "column",
      flex: 1,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: css.textValue, margin: 0 }}>
          {cfg.label} <span style={{ fontSize: 10, color: css.textMuted, fontWeight: 500 }}>Daily Trend</span>
        </p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)} style={btnStyle(m)}>
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ FIX: flex:1 + minHeight:0 agar ResponsiveContainer bisa mengisi sisa ruang */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gTarget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} /><stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSingle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cfg.color} stopOpacity={0.35} /><stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} />
            <XAxis dataKey="label" tick={{ ...chartAxisTick, fontSize: 9, dy: 4 }} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" />
            <YAxis tick={{ ...chartAxisTick, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={54} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} />

            {isSales ? (
              <>
                <Area type="monotone" dataKey="target" name="Target" stroke="#eab308" strokeWidth={1.5} fill="url(#gTarget)" dot={false} strokeDasharray="4 2" baseValue={0} />
                <Area type="monotone" dataKey="gross"  name="Gross"  stroke="#a855f7" strokeWidth={1.5} fill="url(#gGross)"  dot={false} baseValue={0} />
                <Area type="monotone" dataKey="sales"  name="Net"    stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gNet)"    dot={{ r: 3, fill: "#0ea5e9", strokeWidth: 0 }} activeDot={{ r: 5 }} baseValue={0} />
              </>
            ) : (
              <Area
                key={metric}
                type="monotone"
                dataKey={metric}
                name={cfg.label}
                stroke={cfg.color}
                strokeWidth={2.5}
                fill="url(#gSingle)"
                dot={{ r: 3, fill: cfg.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={true}
                baseValue={0}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — only for Sales tab */}
      {isSales && (
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 8, fontSize: 10, color: css.textSub }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 2, background: "#eab308", display: "inline-block", borderTop: "2px dashed #eab308" }} />Target</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7", display: "inline-block" }} />Gross</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9", display: "inline-block" }} />Net</span>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, css }: { title: string; css: Record<string, string> }) {
  return (
    <p style={{ fontSize: 13, fontWeight: 700, color: css.textValue, margin: "0 0 10px" }}>{title}</p>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<Record<string, any>[]>([]);
  const [targetSales, setTargetSales] = useState<Record<string, any>[]>([]);
  const [channelTraffic, setChannelTraffic] = useState<Record<string, any>[]>([]);
  const [spreadsheetSales, setSpreadsheetSales] = useState<SpreadsheetEntry[]>([]);
  const [grossSales, setGrossSales] = useState<Record<string, any>[]>([]);
  const [dailyOrder, setDailyOrder] = useState<Record<string, any>[]>([]);
  const [quantityOrder, setQuantityOrder] = useState<Record<string, any>[]>([]);

  const [activeTab, setActiveTab] = useState<"list" | "report">("list");

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selStore, setSelStore] = useState<string>("all");

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

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
      setSpreadsheetSales(json.spreadsheetSales || []);
      setGrossSales(json.grossSales || []);
      setDailyOrder(json.dailyOrder || []);
      setQuantityOrder(json.quantityOrder || []);
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
  const filteredGross = useMemo(() => filterRows(grossSales, "gross_daily"), [grossSales, selYear, selMonth]);
  const filteredDailyOrder = useMemo(() => filterRows(dailyOrder, "daily_order"), [dailyOrder, selYear, selMonth]);
  const filteredQtyOrder = useMemo(() => filterRows(quantityOrder, "qty_order"), [quantityOrder, selYear, selMonth]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSales = filteredDaily.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalTarget = filteredTarget.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalTraffic = filteredTraffic.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalGross = filteredGross.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalOrders = filteredDailyOrder.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);
    const totalQty = filteredQtyOrder.reduce((s, r) => s + activeStores.reduce((ss, st) => ss + parseVal(r[st]), 0), 0);

    const daysWithSales = filteredDaily.filter((r) => activeStores.some((st) => parseVal(r[st]) > 0)).length;
    const avgDaily = daysWithSales > 0 ? totalSales / daysWithSales : 0;
    const avgGrossDaily = daysWithSales > 0 ? totalGross / daysWithSales : 0;
    const aov = totalTraffic > 0 ? totalSales / totalTraffic : 0;
    const discount = totalGross > 0 ? totalGross - totalSales : 0;
    const discountPct = totalGross > 0 ? (discount / totalGross) * 100 : 0;
    const avgOrderQty = totalOrders > 0 ? totalQty / totalOrders : 0;
    const salesPct = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;

    const totalDays = daysInMonth(selYear, selMonth);
    const today = new Date();
    const isCurrentMonth = selYear === today.getFullYear() && selMonth === today.getMonth();
    const remainingDays = isCurrentMonth ? Math.max(0, totalDays - today.getDate()) : 0;
    const forecast = totalSales + remainingDays * avgDaily;
    const forecastPct = totalTarget > 0 ? (forecast / totalTarget) * 100 : 0;

    return {
      totalSales, totalTarget, totalTraffic, totalGross, totalOrders, totalQty,
      avgDaily, avgGrossDaily, aov, discount, discountPct, avgOrderQty,
      salesPct, forecast, forecastPct, daysWithSales, isCurrentMonth,
    };
  }, [filteredDaily, filteredTarget, filteredTraffic, filteredGross, filteredDailyOrder, filteredQtyOrder, activeStores, selYear, selMonth]);

  // ── Trend chart (Net Sales) ────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const totalDaysInMonth = daysInMonth(selYear, selMonth);
    const result = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dRow  = filteredDaily.find((r) => getDay(r.sales_date) === day) || {};
      const tRow  = filteredTarget.find((r) => getDay(r.sales_date) === day) || {};
      const gRow  = filteredGross.find((r) => getDay(r.gross_daily) === day) || {};
      const trRow = filteredTraffic.find((r) => getDay(r.traffic_date) === day) || {};
      const sales   = activeStores.reduce((s, st) => s + parseVal((dRow as any)[st]), 0);
      const target  = activeStores.reduce((s, st) => s + parseVal((tRow as any)[st]), 0);
      const gross   = activeStores.reduce((s, st) => s + parseVal((gRow as any)[st]), 0);
      const traffic = activeStores.reduce((s, st) => s + parseVal((trRow as any)[st]), 0);
      const fullDate = `${day} ${MONTHS[selMonth]} ${selYear}`;
      result.push({ label: String(day), fullDate, sales, target, gross, traffic });
    }
    return result;
  }, [filteredDaily, filteredTarget, filteredGross, filteredTraffic, activeStores, selYear, selMonth]);

  // ── Order trend chart ──────────────────────────────────────────────────────
  const orderTrendData = useMemo(() => {
    const totalDaysInMonth = daysInMonth(selYear, selMonth);
    const result = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const oRow = filteredDailyOrder.find((r) => getDay(r.daily_order) === day) || {};
      const qRow = filteredQtyOrder.find((r) => getDay(r.qty_order) === day) || {};
      const orders = activeStores.reduce((s, st) => s + parseVal((oRow as any)[st]), 0);
      const qty    = activeStores.reduce((s, st) => s + parseVal((qRow as any)[st]), 0);
      const fullDate = `${day} ${MONTHS[selMonth]} ${selYear}`;
      result.push({ label: String(day), fullDate, orders, qty });
    }
    return result;
  }, [filteredDailyOrder, filteredQtyOrder, activeStores, selYear, selMonth]);

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
    tabActiveBg: DM ? "#1e293b" : "white",
    tabActiveColor: DM ? "#e2e8f0" : "#1e3a5c",
    tabInactiveColor: DM ? "#64748b" : "#94a3b8",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px", fontSize: 12, fontWeight: active ? 700 : 500,
    color: active ? css.tabActiveColor : css.tabInactiveColor,
    background: active ? css.tabActiveBg : "transparent",
    border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", transition: "all 0.15s",
    borderBottom: active ? `2px solid #3b82f6` : "2px solid transparent", letterSpacing: "-0.01em",
  });

  return (
    <div className="flex-1 overflow-auto" style={{ background: css.pageBg, width: "100%", minWidth: 0, transition: "background 0.2s" }}>
      <div style={{ padding: "16px 18px", width: "100%", boxSizing: "border-box" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: css.textHeading, margin: 0, letterSpacing: "-0.02em" }}>Sales Dashboard</h1>
            {lockedStore && <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{STORE_LABELS[lockedStore] || lockedStore}</p>}
          </div>
          <Button
            onClick={fetchData}
            style={{ padding: "4px 12px", background: "#1e3a5c", color: "white", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}
          >
            Refresh
          </Button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${css.dividerLine}`, marginBottom: 16 }}>
          <button style={tabStyle(activeTab === "list")} onClick={() => setActiveTab("list")}>List</button>
          <button style={tabStyle(activeTab === "report")} onClick={() => setActiveTab("report")}>Report</button>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
            <p style={{ color: "#64748b" }}>Loading data...</p>
          </div>
        ) : (
          <>
            {/* ── LIST TAB ── */}
            {activeTab === "list" && (
              <SpreadsheetListSection entries={spreadsheetSales} isDark={DM} css={css} isLocked={isLocked} userStore={lockedStore || ""} />
            )}

            {/* ── REPORT TAB ── */}
            {activeTab === "report" && (
              <>
                {/* Filters */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: css.textValue, margin: 0 }}>
                    Daily Target vs Achievement
                    {lockedStore && <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500, marginLeft: 8 }}>{STORE_LABELS[lockedStore] || lockedStore} · {MONTHS[selMonth]} {selYear}</span>}
                  </p>
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
                  </div>
                </div>

                {/* ── ROW 1: Gauges + Stats + Net Sales Trend ── */}
                {/* ✅ FIX: tambah alignItems:"stretch" agar kedua kolom sama tinggi */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.7fr)", gap: 12, marginBottom: 12, width: "100%", alignItems: "stretch" }}>
                  {/* Left */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                    {/* Gauges */}
                    <div style={{ background: css.cardBg, borderRadius: 10, boxShadow: css.cardShadow, padding: "12px 12px 4px", overflow: "hidden", transition: "background 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
                        <GaugeChart pct={stats.salesPct} value={fmtRp(stats.totalSales)} label="Net Sales MTD vs Target MTD" color="#0ea5e9" actualValue={fmtRpExact(stats.totalSales)} targetValue={fmtRpExact(stats.totalTarget)} gaugeTrack={css.gaugeTrack} labelColor={css.textHeading} valueColor={css.textMuted} />
                        <div style={{ width: 1, background: css.dividerLine, margin: "8px 0" }} />
                        <GaugeChart pct={stats.forecastPct} value={fmtRp(Math.round(stats.forecast))} label="Est Net Sales vs Target MTD" color="#0ea5e9" actualValue={fmtRpExact(Math.round(stats.forecast))} targetValue={fmtRpExact(stats.totalTarget)} gaugeTrack={css.gaugeTrack} labelColor={css.textHeading} valueColor={css.textMuted} />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ background: css.cardBg, borderRadius: 10, padding: "12px 16px", boxShadow: css.cardShadow, transition: "background 0.2s" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                        <StatCard label="Avg Net Daily" value={fmtRp(Math.round(stats.avgDaily))} css={css} />
                        <StatCard label="Net Sales MTD" value={fmtRp(stats.totalSales)} css={css} />
                        <StatCard label="Gross Sales MTD" value={fmtRp(stats.totalGross)} css={css} />
                        <StatCard label="Discount MTD" value={fmtRp(stats.discount)} sub={`${stats.discountPct.toFixed(1)}% dari Gross`} css={css} />
                        <StatCard label="Est Net Sales" value={fmtRp(Math.round(stats.forecast))} css={css} />
                        <StatCard label="% Est Net Sales" value={`${stats.forecastPct.toFixed(2)}%`} css={css} />
                        <StatCard label="Total Traffic" value={stats.totalTraffic.toLocaleString("id-ID")} css={css} />
                        <StatCard label="Total Orders" value={stats.totalOrders.toLocaleString("id-ID")} css={css} />
                        <StatCard label="Total Qty" value={stats.totalQty.toLocaleString("id-ID")} css={css} />
                        <StatCard label="Avg Qty/Order" value={stats.avgOrderQty.toFixed(1)} css={css} />
                      </div>
                    </div>
                  </div>

                  {/* ✅ FIX: Right kolom pakai display:flex agar MetricTrendChart bisa stretch */}
                  <div style={{ display: "flex", minWidth: 0 }}>
                    <MetricTrendChart
                      trendData={trendData}
                      orderTrendData={orderTrendData}
                      css={css}
                      isDark={DM}
                    />
                  </div>
                </div>

                {/* ── ROW 3: Calendar grids ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", alignItems: "start" }}>
                  <CalendarGrid year={selYear} month={selMonth} title="Target Net Sales by Date" cellData={calendarTarget} targetData={{}} showConditional={false} css={css} />
                  <CalendarGrid year={selYear} month={selMonth} title="Net Sales by Date" cellData={calendarSales} targetData={calendarTarget} trafficData={calendarTraffic} showConditional={true} css={css} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}