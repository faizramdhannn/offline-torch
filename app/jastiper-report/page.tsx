"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { CHART_PALETTE as PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

// Halaman PUBLIK, TIDAK login-gated — sengaja di luar (main) route group,
// sama pola dengan app/affiliate-report/page.tsx. Menampilkan monitoring
// SEMUA jastiper per toko untuk SIAPA SAJA lewat
// app/api/jastiper/report-public/route.ts (juga publik).
// SENGAJA hanya agregat per toko (bukan per-jastiper) — tidak ada nama/no HP
// personal jastiper yang ditampilkan di halaman ini, demi privasi karena
// halaman ini benar-benar tanpa gate sama sekali.

interface StoreRow {
  store: string;
  total_order: number;
  total_value: number;
  jastiper_count: number;
}

interface ReportData {
  stores: string[];
  summary: { total_order: number; total_value: number; jastiper_count: number; total_value_formatted: string };
  chart_by_store: StoreRow[];
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

export default function JastiperReportPublicPage() {
  const [store, setStore] = useState("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = async (selectedStore: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jastiper/report-public?store=${encodeURIComponent(selectedStore)}`);
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
    fetchReport(store);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .jr-root { min-height: 100vh; background: linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%); font-family: 'IBM Plex Sans', sans-serif; padding: 2.5rem 1.25rem 3rem; }
        .jr-container { max-width: 900px; margin: 0 auto; }
        .jr-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .jr-logo-img { height: 34px; width: auto; }
        .jr-tagline { text-align: center; font-size: 0.72rem; color: #6b7280; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.75rem; }
        .jr-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.25rem; }
        .jr-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .jr-select { padding: 0.55rem 0.9rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.85rem; color: #0f172a; outline: none; }
        .jr-select:focus { border-color: #0e7490; }
        .jr-error { font-size: 0.8rem; color: #b91c1c; font-weight: 500; padding: 0.65rem 0.85rem; margin-bottom: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .jr-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem; }
        .jr-stat { background: #ffffff; border: 1px solid #e7eaef; border-radius: 12px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 2px rgba(16,24,40,0.04); }
        .jr-stat-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .jr-stat-value { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 0.3rem; letter-spacing: -0.01em; }
        .jr-card { background: #ffffff; border: 1px solid #e7eaef; border-radius: 16px; box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.08); padding: 1.5rem; margin-bottom: 1.5rem; }
        .jr-card-title { font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; }
        table.jr-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        table.jr-table th, table.jr-table td { text-align: left; padding: 0.65rem 0.7rem; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        table.jr-table th { color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; }
        table.jr-table tbody tr:hover td { background: #fafcfe; }
        .jr-table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 10px; }
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
            <div className="jr-title">Monitoring Jastiper per Toko</div>
            <select className="jr-select" value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">Semua Toko</option>
              {data?.stores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="jr-error">{error}</div>}

          {loading || !data ? (
            <div className="jr-empty">Memuat report...</div>
          ) : (
            <>
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

              <div className="jr-card">
                <div className="jr-card-title">Total Value per Toko</div>
                {data.chart_by_store.length === 0 ? (
                  <div className="jr-empty">Tidak ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.chart_by_store}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="store" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => formatRupiah(v ?? 0)} />
                      <Bar dataKey="total_value" name="Total Value" fill={PALETTE[1]} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="jr-card">
                <div className="jr-card-title">Rekap per Toko</div>
                <div className="jr-table-wrap">
                  <table className="jr-table">
                    <thead>
                      <tr>
                        <th>Toko</th>
                        <th>Jumlah Jastiper</th>
                        <th>Total Order</th>
                        <th>Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.chart_by_store.map((s) => (
                        <tr key={s.store}>
                          <td>{s.store}</td>
                          <td>{s.jastiper_count}</td>
                          <td>{s.total_order}</td>
                          <td>{formatRupiah(s.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.chart_by_store.length === 0 && <div className="jr-empty">Belum ada data.</div>}
                </div>
              </div>
            </>
          )}

          <div className="jr-footer">© 2026 OFFLINE TORCH</div>
        </div>
      </div>
    </>
  );
}
