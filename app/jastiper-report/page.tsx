"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { CHART_PALETTE as PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";
import { SocialMediaIcon } from "@/components/jastiper/SocialMediaIcon";
import { CopyableText } from "@/components/jastiper/CopyableText";

// Halaman PUBLIK, TIDAK login-gated — sengaja di luar (main) route group,
// sama pola dengan app/affiliate-report/page.tsx. Menampilkan monitoring
// SEMUA jastiper untuk SIAPA SAJA lewat app/api/jastiper/report-public/route.ts
// (juga publik). PENTING: per keputusan eksplisit user, halaman ini
// menampilkan data lengkap per-jastiper (nama, no HP, dll) — bukan lagi
// agregat-only.

interface JastiperOrderRow {
  sales_order: string;
  store_name: string;
  value: number;
  value_formatted: string;
  date: string | null;
}

interface JastiperRow {
  uuid: string;
  jastiper_name: string;
  jastiper_phone_number: string;
  jastiper_store: string;
  jastiper_code: string;
  jastiper_respond: string;
  jastiper_status: string;
  notes: string;
  social_media: string;
  social_media_username: string;
  total_order: number;
  total_value: number;
  total_value_formatted: string;
  orders: JastiperOrderRow[];
}

interface ReportData {
  stores: string[];
  responds: string[];
  summary: { jastiper_count: number; total_order: number; total_value: number; total_value_formatted: string };
  chart_by_store: { store: string; jastiper_count: number; total_order: number; total_value: number }[];
  chart_by_respond: { respond: string; count: number }[];
  chart_trend: { date: string; total_order: number; total_value: number }[];
  data: JastiperRow[];
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function formatOrderDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function respondBadgeClass(respond: string) {
  if (respond === "Canceled") return "jr-badge-canceled";
  if (respond === "Joined Group") return "jr-badge-joined";
  if (respond === "Done Approach") return "jr-badge-approach";
  if (respond === "On Followup") return "jr-badge-followup";
  return "jr-badge-default";
}

export default function JastiperReportPublicPage() {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedResponds, setSelectedResponds] = useState<string[]>([]);
  const [showRespondDropdown, setShowRespondDropdown] = useState(false);
  const respondDropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "data">("summary");
  const [pieMode, setPieMode] = useState<"respond" | "store">("respond");
  const [search, setSearch] = useState("");
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false);
      }
      if (respondDropdownRef.current && !respondDropdownRef.current.contains(e.target as Node)) {
        setShowRespondDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchReport = async (stores: string[], responds: string[]) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (stores.length > 0) params.set("stores", stores.join(","));
      if (responds.length > 0) params.set("respond", responds.join(","));
      const qs = params.toString();
      const res = await fetch(`/api/jastiper/report-public${qs ? `?${qs}` : ""}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat report");
      setData(result);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedStores, selectedResponds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStores, selectedResponds]);

  const toggleStore = (store: string) => {
    setSelectedStores((prev) => (prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store]));
  };

  const toggleRespond = (respond: string) => {
    setSelectedResponds((prev) => (prev.includes(respond) ? prev.filter((r) => r !== respond) : [...prev, respond]));
  };

  const jastiperCountData = useMemo(() => {
    if (!data) return [];
    if (pieMode === "respond") {
      return data.chart_by_respond.map((r) => ({ name: r.respond || "Belum Diisi", value: r.count }));
    }
    return data.chart_by_store.map((s) => ({ name: s.store, value: s.jastiper_count }));
  }, [data, pieMode]);

  // Top 10 jastiper by kontribusi (Total Value) — sama pola dengan "Top 10
  // Affiliate" di affiliate-report, cuma tampilkan yang sudah ada order-nya.
  const salesPerJastiper = useMemo(() => {
    if (!data) return [];
    return [...data.data]
      .filter((d) => d.total_value > 0)
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 10)
      .map((d) => ({ name: d.jastiper_name, value: d.total_value }));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.data;
    return data.data.filter(
      (d) =>
        d.jastiper_name.toLowerCase().includes(q) ||
        d.jastiper_phone_number.toLowerCase().includes(q) ||
        d.jastiper_code.toLowerCase().includes(q) ||
        d.jastiper_store.toLowerCase().includes(q) ||
        d.social_media_username.toLowerCase().includes(q)
    );
  }, [data, search]);

  const handleExport = () => {
    if (!data) return;
    const rows = filteredData.map((d) => ({
      "Nama Jastiper": d.jastiper_name,
      "Sosial Media": d.social_media,
      Username: d.social_media_username,
      "No HP": d.jastiper_phone_number,
      Toko: d.jastiper_store,
      "Kode Jastiper": d.jastiper_code,
      Respond: d.jastiper_respond,
      Status: d.jastiper_status,
      Notes: d.notes,
      "Total Order": d.total_order,
      "Total Value": d.total_value,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jastiper");
    XLSX.writeFile(wb, `jastiper_report_${Date.now()}.xlsx`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .jr-root { min-height: 100vh; background: linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%); font-family: 'IBM Plex Sans', sans-serif; padding: 2.5rem 1.25rem 3rem; }
        .jr-container { max-width: 1320px; margin: 0 auto; }
        .jr-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .jr-logo-img { height: 34px; width: auto; }
        .jr-tagline { text-align: center; font-size: 0.72rem; color: #6b7280; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.75rem; }
        .jr-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.25rem; }
        .jr-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .jr-dropdown { position: relative; }
        .jr-dropdown-btn { padding: 0.55rem 0.9rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.82rem; color: #0f172a; outline: none; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; min-width: 160px; justify-content: space-between; }
        .jr-dropdown-btn:hover { border-color: #cbd5e1; }
        .jr-dropdown-panel { position: absolute; z-index: 20; top: 100%; right: 0; margin-top: 0.35rem; width: 220px; max-height: 260px; overflow-y: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px -8px rgba(16,24,40,0.15); padding: 0.4rem; }
        .jr-dropdown-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; font-size: 0.8rem; color: #334155; border-radius: 6px; cursor: pointer; }
        .jr-dropdown-item:hover { background: #f8fafc; }
        .jr-error { font-size: 0.8rem; color: #b91c1c; font-weight: 500; padding: 0.65rem 0.85rem; margin-bottom: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .jr-tabs { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; }
        .jr-tab { padding: 0.5rem 1rem; font-size: 0.82rem; font-weight: 600; color: #64748b; background: transparent; border: none; border-radius: 8px; cursor: pointer; }
        .jr-tab.active { background: #0f172a; color: #ffffff; }
        .jr-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem; }
        .jr-stat { background: #ffffff; border: 1px solid #e7eaef; border-radius: 12px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 2px rgba(16,24,40,0.04); }
        .jr-stat-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .jr-stat-value { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 0.3rem; letter-spacing: -0.01em; }
        .jr-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-bottom: 1.5rem; }
        @media (min-width: 900px) { .jr-grid-2 { grid-template-columns: 1fr 1fr; } }
        .jr-card { background: #ffffff; border: 1px solid #e7eaef; border-radius: 16px; box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.08); padding: 1.5rem; margin-bottom: 1.5rem; }
        .jr-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 0.5rem; flex-wrap: wrap; }
        .jr-card-title { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
        .jr-pie-toggle { display: flex; gap: 0.3rem; background: #f1f5f9; border-radius: 8px; padding: 0.2rem; }
        .jr-pie-toggle button { padding: 0.3rem 0.7rem; font-size: 0.72rem; font-weight: 600; border: none; border-radius: 6px; background: transparent; color: #64748b; cursor: pointer; }
        .jr-pie-toggle button.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(16,24,40,0.08); }
        .jr-search { padding: 0.55rem 0.9rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.82rem; color: #0f172a; outline: none; width: 240px; max-width: 100%; }
        .jr-search:focus { border-color: #0e7490; }
        .jr-export-btn { padding: 0.55rem 1rem; background: #0f172a; color: #ffffff; border: none; border-radius: 9px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .jr-export-btn:hover { opacity: 0.9; }
        table.jr-table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 0.78rem; }
        table.jr-table th, table.jr-table td { text-align: left; padding: 0.6rem 0.65rem; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        table.jr-table th { color: #64748b; font-weight: 600; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; white-space: nowrap; }
        table.jr-table tbody tr:hover td { background: #fafcfe; }
        .jr-table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 10px; }
        .jr-row-clickable { cursor: pointer; }
        .jr-row-clickable:hover td { background: #f8fafc; }
        .jr-name-toggle { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600; color: #0f172a; }
        .jr-caret { display: inline-block; font-size: 0.65rem; color: #94a3b8; transition: transform 0.15s; }
        .jr-caret.open { transform: rotate(90deg); }
        .jr-expand-row td { background: #f8fafc; padding: 0.75rem 1rem; }
        table.jr-subtable { width: 100%; border-collapse: collapse; font-size: 0.75rem; background: #ffffff; border: 1px solid #eef1f5; border-radius: 8px; overflow: hidden; }
        table.jr-subtable th, table.jr-subtable td { text-align: left; padding: 0.5rem 0.65rem; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        table.jr-subtable th { color: #94a3b8; font-weight: 600; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.03em; background: #fafcfe; }
        table.jr-subtable tbody tr:last-child td { border-bottom: none; }
        .jr-badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; white-space: nowrap; }
        .jr-badge-canceled { background: #fee2e2; color: #b91c1c; }
        .jr-badge-joined { background: #dcfce7; color: #166534; }
        .jr-badge-approach { background: #dbeafe; color: #1e40af; }
        .jr-badge-followup { background: #fef3c7; color: #92400e; }
        .jr-badge-default { background: #f1f5f9; color: #475569; }
        .jr-empty { text-align: center; padding: 2rem 0; color: #94a3b8; font-size: 0.85rem; }
        .jr-footer { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: #94a3b8; letter-spacing: 0.06em; text-align: center; margin-top: 2.5rem; }
      `}</style>

      <div className="jr-root">
        <div className="jr-container">
          <div className="jr-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png" alt="Torch" className="jr-logo-img" />
          </div>
          <div className="jr-tagline">Jastiper Report</div>

          <div className="jr-toolbar">
            <div className="jr-title">Monitoring Jastiper</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div className="jr-dropdown" ref={respondDropdownRef}>
                <button className="jr-dropdown-btn" onClick={() => setShowRespondDropdown((p) => !p)}>
                  <span>
                    {selectedResponds.length === 0 ? "Semua Respond" : `${selectedResponds.length} respond dipilih`}
                  </span>
                  <span style={{ color: "#94a3b8" }}>▾</span>
                </button>
                {showRespondDropdown && (
                  <div className="jr-dropdown-panel">
                    {data?.responds.map((r) => (
                      <label key={r} className="jr-dropdown-item">
                        <input type="checkbox" checked={selectedResponds.includes(r)} onChange={() => toggleRespond(r)} />
                        {r}
                      </label>
                    ))}
                    {(!data || data.responds.length === 0) && <div className="jr-dropdown-item">Tidak ada respond</div>}
                  </div>
                )}
              </div>
              <div className="jr-dropdown" ref={storeDropdownRef}>
                <button className="jr-dropdown-btn" onClick={() => setShowStoreDropdown((p) => !p)}>
                  <span>
                    {selectedStores.length === 0 ? "Semua Toko" : `${selectedStores.length} toko dipilih`}
                  </span>
                  <span style={{ color: "#94a3b8" }}>▾</span>
                </button>
                {showStoreDropdown && (
                  <div className="jr-dropdown-panel">
                    {data?.stores.map((s) => (
                      <label key={s} className="jr-dropdown-item">
                        <input type="checkbox" checked={selectedStores.includes(s)} onChange={() => toggleStore(s)} />
                        {s}
                      </label>
                    ))}
                    {(!data || data.stores.length === 0) && <div className="jr-dropdown-item">Tidak ada toko</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className="jr-error">{error}</div>}

          {loading || !data ? (
            <div className="jr-empty">Memuat report...</div>
          ) : (
            <>
              <div className="jr-tabs">
                <button className={`jr-tab ${activeTab === "summary" ? "active" : ""}`} onClick={() => setActiveTab("summary")}>
                  Ringkasan
                </button>
                <button className={`jr-tab ${activeTab === "data" ? "active" : ""}`} onClick={() => setActiveTab("data")}>
                  Data
                </button>
              </div>

              <div className="jr-stat-grid">
                <div className="jr-stat">
                  <div className="jr-stat-label">Jumlah Jastiper</div>
                  <div className="jr-stat-value">{data.summary.jastiper_count}</div>
                </div>
                <div className="jr-stat">
                  <div className="jr-stat-label">Total Order</div>
                  <div className="jr-stat-value">{data.summary.total_order}</div>
                </div>
                <div className="jr-stat">
                  <div className="jr-stat-label">Total Value</div>
                  <div className="jr-stat-value">{data.summary.total_value_formatted}</div>
                </div>
              </div>

              {activeTab === "summary" ? (
                <>
                  <div className="jr-grid-2">
                    <div className="jr-card">
                      <div className="jr-card-head">
                        <div className="jr-card-title">Jumlah Jastiper</div>
                        <div className="jr-pie-toggle">
                          <button className={pieMode === "respond" ? "active" : ""} onClick={() => setPieMode("respond")}>
                            Respond
                          </button>
                          <button className={pieMode === "store" ? "active" : ""} onClick={() => setPieMode("store")}>
                            Toko
                          </button>
                        </div>
                      </div>
                      {jastiperCountData.length === 0 ? (
                        <div className="jr-empty">Tidak ada data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.max(180, jastiperCountData.length * 34)}>
                          <BarChart data={jastiperCountData} layout="vertical" margin={{ right: 28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                            <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" tick={chartAxisTick} axisLine={false} tickLine={false} width={100} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Bar dataKey="value" name="Jumlah" fill={PALETTE[1]} radius={[0, 6, 6, 0]}>
                              <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: "#475569" }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div className="jr-card">
                      <div className="jr-card-title">Total Value per Toko</div>
                      {data.chart_by_store.length === 0 ? (
                        <div className="jr-empty">Tidak ada data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={Math.max(180, data.chart_by_store.length * 34)}>
                          <BarChart data={data.chart_by_store} layout="vertical" margin={{ right: 48 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                            <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                            <YAxis type="category" dataKey="store" tick={chartAxisTick} axisLine={false} tickLine={false} width={100} />
                            <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => formatRupiah(v ?? 0)} />
                            <Bar dataKey="total_value" name="Total Value" fill={PALETTE[3]} radius={[0, 6, 6, 0]}>
                              <LabelList
                                dataKey="total_value"
                                position="right"
                                formatter={(v: any) => formatCompact(Number(v) || 0)}
                                style={{ fontSize: 10, fill: "#475569" }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="jr-card">
                    <div className="jr-card-title">Sales per Jastiper (Top 10)</div>
                    {salesPerJastiper.length === 0 ? (
                      <div className="jr-empty">Belum ada penjualan tercatat</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(220, salesPerJastiper.length * 34)}>
                        <BarChart data={salesPerJastiper} layout="vertical" margin={{ right: 56 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                          <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                          <YAxis type="category" dataKey="name" tick={chartAxisTick} axisLine={false} tickLine={false} width={130} />
                          <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => formatRupiah(v ?? 0)} />
                          <Bar dataKey="value" name="Total Value" fill={PALETTE[2]} radius={[0, 6, 6, 0]}>
                            <LabelList
                              dataKey="value"
                              position="right"
                              formatter={(v: any) => formatCompact(Number(v) || 0)}
                              style={{ fontSize: 10, fill: "#475569" }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="jr-card">
                    <div className="jr-card-title">Tren Harian (30 Hari Terakhir)</div>
                    {data.chart_trend.length === 0 ? (
                      <div className="jr-empty">Tidak ada data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={data.chart_trend} margin={{ top: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={chartAxisTick} axisLine={false} tickLine={false} />
                          <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            labelFormatter={(v) => formatDateLabel(String(v))}
                            formatter={(v?: number, name?: string) => (name === "Total Value" ? formatRupiah(v ?? 0) : v)}
                          />
                          <Line type="monotone" dataKey="total_value" name="Total Value" stroke={PALETTE[0]} strokeWidth={2} dot={{ r: 3 }}>
                            <LabelList
                              dataKey="total_value"
                              position="top"
                              formatter={(v: any) => (Number(v) > 0 ? formatCompact(Number(v)) : "")}
                              style={{ fontSize: 9, fill: "#64748b" }}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              ) : (
                <div className="jr-card">
                  <div className="jr-card-head">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama, no HP, kode, atau toko..."
                      className="jr-search"
                    />
                    <button className="jr-export-btn" onClick={handleExport}>
                      Export XLSX
                    </button>
                  </div>
                  <div className="jr-table-wrap">
                    <table className="jr-table">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Sosial Media</th>
                          <th>Username</th>
                          <th>No HP</th>
                          <th>Toko</th>
                          <th>Kode</th>
                          <th>Respond</th>
                          <th>Status</th>
                          <th>Notes</th>
                          <th>Total Order</th>
                          <th>Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((d) => {
                          const isExpanded = expandedUuid === d.uuid;
                          return (
                            <Fragment key={d.uuid}>
                              <tr
                                onClick={() => setExpandedUuid(isExpanded ? null : d.uuid)}
                                className="jr-row-clickable"
                              >
                                <td>
                                  <span className="jr-name-toggle">
                                    <span className={`jr-caret ${isExpanded ? "open" : ""}`}>▸</span>
                                    <CopyableText value={d.jastiper_name} label="nama" />
                                  </span>
                                </td>
                                <td>{d.social_media ? <SocialMediaIcon platform={d.social_media} size={14} /> : "-"}</td>
                                <td>
                                  <CopyableText value={d.social_media_username} label="username" className="max-w-[160px]" />
                                </td>
                                <td>
                                  <CopyableText value={d.jastiper_phone_number} label="no HP" />
                                </td>
                                <td>{d.jastiper_store}</td>
                                <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem" }}>
                                  <CopyableText value={d.jastiper_code} label="kode" />
                                </td>
                                <td>
                                  <span className={`jr-badge ${respondBadgeClass(d.jastiper_respond)}`}>{d.jastiper_respond || "-"}</span>
                                </td>
                                <td>{d.jastiper_status || "-"}</td>
                                <td style={{ whiteSpace: "normal", minWidth: 160 }}>{d.notes || "-"}</td>
                                <td>{d.total_order}</td>
                                <td>{d.total_value_formatted}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="jr-expand-row">
                                  <td colSpan={11}>
                                    {d.orders.length === 0 ? (
                                      <div className="jr-empty" style={{ padding: "0.75rem 0" }}>
                                        Belum ada sales order untuk kode ini.
                                      </div>
                                    ) : (
                                      <table className="jr-subtable">
                                        <thead>
                                          <tr>
                                            <th>Sales Order</th>
                                            <th>Store</th>
                                            <th>Tanggal</th>
                                            <th>Value</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {d.orders.map((o, i) => (
                                            <tr key={i}>
                                              <td>{o.sales_order}</td>
                                              <td>{o.store_name}</td>
                                              <td>{formatOrderDate(o.date)}</td>
                                              <td>{o.value_formatted}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredData.length === 0 && <div className="jr-empty">Tidak ada data yang cocok.</div>}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="jr-footer">© 2026 OFFLINE TORCH</div>
        </div>
      </div>
    </>
  );
}
