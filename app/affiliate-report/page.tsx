"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { CHART_PALETTE as PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

// Halaman PUBLIK, TIDAK login-gated — sengaja di luar (main) route group,
// sama pola dengan app/affiliator/page.tsx. Menampilkan report Affiliate
// (chart + list) untuk SIAPA SAJA, dengan filter "Semua Store" atau salah
// satu store, lewat app/api/affiliate/report-public/route.ts (juga publik).

interface ReportRow {
  sales_order: string;
  affiliate_code: string;
  affiliate_name: string;
  store_name: string;
  order_date: string;
  value_order: string;
  commission_rate: string;
  reedem_status: string;
}

interface ReportData {
  stores: string[];
  summary: { total_orders: number; total_value: number; total_commission: number };
  chart_by_store: { store_name: string; orders: number; value: number; commission: number }[];
  chart_by_affiliate: { affiliate_name: string; orders: number; value: number; commission: number }[];
  chart_trend: { date: string; orders: number; commission: number }[];
  affiliate_list: { affiliate_code: string; affiliate_name: string; affiliate_store: string; orders: number; value: number; commission: number }[];
  list: ReportRow[];
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

export default function AffiliateReportPublicPage() {
  const [store, setStore] = useState("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = async (selectedStore: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/affiliate/report-public?store=${encodeURIComponent(selectedStore)}`);
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

  const badgeClass = (status: string) =>
    status === "Sudah Redeem" ? "ar-badge-redeem" : status === "Diproses" ? "ar-badge-diproses" : "ar-badge-belum";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .ar-root { min-height: 100vh; background: linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%); font-family: 'IBM Plex Sans', sans-serif; padding: 2.5rem 1.25rem 3rem; }
        .ar-container { max-width: 1080px; margin: 0 auto; }
        .ar-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .ar-logo-img { height: 34px; width: auto; }
        .ar-tagline { text-align: center; font-size: 0.72rem; color: #6b7280; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.75rem; }
        .ar-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.25rem; }
        .ar-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .ar-select { padding: 0.55rem 0.9rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.85rem; color: #0f172a; outline: none; }
        .ar-select:focus { border-color: #0e7490; }
        .ar-error { font-size: 0.8rem; color: #b91c1c; font-weight: 500; padding: 0.65rem 0.85rem; margin-bottom: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .ar-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem; }
        .ar-stat { background: #ffffff; border: 1px solid #e7eaef; border-radius: 12px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 2px rgba(16,24,40,0.04); }
        .ar-stat-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .ar-stat-value { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 0.3rem; letter-spacing: -0.01em; }
        .ar-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-bottom: 1.5rem; }
        @media (min-width: 900px) { .ar-grid-2 { grid-template-columns: 1fr 1fr; } }
        .ar-card { background: #ffffff; border: 1px solid #e7eaef; border-radius: 16px; box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.08); padding: 1.5rem; }
        .ar-card-title { font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; }
        table.ar-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        table.ar-table th, table.ar-table td { text-align: left; padding: 0.65rem 0.7rem; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        table.ar-table th { color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; }
        table.ar-table tbody tr:hover td { background: #fafcfe; }
        .ar-table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 10px; }
        .ar-badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; white-space: nowrap; }
        .ar-badge-belum { background: #fef3c7; color: #92400e; }
        .ar-badge-diproses { background: #dbeafe; color: #1e40af; }
        .ar-badge-redeem { background: #dcfce7; color: #166534; }
        .ar-empty { text-align: center; padding: 2rem 0; color: #94a3b8; font-size: 0.85rem; }
        .ar-footer { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: #94a3b8; letter-spacing: 0.06em; text-align: center; margin-top: 2.5rem; }
      `}</style>

      <div className="ar-root">
        <div className="ar-container">
          <div className="ar-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png" alt="Torch" className="ar-logo-img" />
          </div>
          <div className="ar-tagline">Affiliate Report</div>

          <div className="ar-toolbar">
            <div className="ar-title">Performa Affiliate</div>
            <select className="ar-select" value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">Semua Store</option>
              {data?.stores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="ar-error">{error}</div>}

          {loading || !data ? (
            <div className="ar-empty">Memuat report...</div>
          ) : (
            <>
              <div className="ar-stat-grid">
                <div className="ar-stat">
                  <div className="ar-stat-label">Total Order</div>
                  <div className="ar-stat-value">{data.summary.total_orders}</div>
                </div>
                <div className="ar-stat">
                  <div className="ar-stat-label">Total Value Order</div>
                  <div className="ar-stat-value">{formatRupiah(data.summary.total_value)}</div>
                </div>
                <div className="ar-stat">
                  <div className="ar-stat-label">Total Komisi</div>
                  <div className="ar-stat-value">{formatRupiah(data.summary.total_commission)}</div>
                </div>
              </div>

              <div className="ar-grid-2">
                <div className="ar-card">
                  <div className="ar-card-title">Komisi per Store</div>
                  {data.chart_by_store.length === 0 ? (
                    <div className="ar-empty">Tidak ada data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.chart_by_store}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                        <XAxis dataKey="store_name" tick={chartAxisTick} axisLine={false} tickLine={false} />
                        <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(v?: number) => formatRupiah(v ?? 0)}
                        />
                        <Bar dataKey="commission" name="Komisi" fill={PALETTE[1]} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="ar-card">
                  <div className="ar-card-title">Top 10 Affiliate (by Komisi)</div>
                  {data.chart_by_affiliate.length === 0 ? (
                    <div className="ar-empty">Tidak ada data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.chart_by_affiliate} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                        <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                        <YAxis
                          type="category"
                          dataKey="affiliate_name"
                          tick={chartAxisTick}
                          axisLine={false}
                          tickLine={false}
                          width={100}
                        />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => formatRupiah(v ?? 0)} />
                        <Bar dataKey="commission" name="Komisi" fill={PALETTE[3]} radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="ar-card" style={{ marginBottom: "1.5rem" }}>
                <div className="ar-card-title">Trend Komisi Harian</div>
                {data.chart_trend.length === 0 ? (
                  <div className="ar-empty">Tidak ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.chart_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => formatRupiah(v ?? 0)} />
                      <Line type="monotone" dataKey="commission" name="Komisi" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="ar-card" style={{ marginBottom: "1.5rem" }}>
                <div className="ar-card-title">List Affiliate</div>
                <div className="ar-table-wrap">
                  <table className="ar-table">
                    <thead>
                      <tr>
                        <th>Affiliate</th>
                        <th>Store</th>
                        <th>Kode</th>
                        <th>Total Order</th>
                        <th>Total Value</th>
                        <th>Total Komisi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.affiliate_list.map((a) => (
                        <tr key={a.affiliate_code}>
                          <td>{a.affiliate_name}</td>
                          <td>{a.affiliate_store || "-"}</td>
                          <td style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem" }}>{a.affiliate_code}</td>
                          <td>{a.orders}</td>
                          <td>{formatRupiah(a.value)}</td>
                          <td>{formatRupiah(a.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.affiliate_list.length === 0 && <div className="ar-empty">Belum ada affiliate.</div>}
                </div>
              </div>

              <div className="ar-card">
                <div className="ar-card-title">Daftar Order</div>
                <div className="ar-table-wrap">
                  <table className="ar-table">
                    <thead>
                      <tr>
                        <th>Sales Order</th>
                        <th>Affiliate</th>
                        <th>Store</th>
                        <th>Tanggal</th>
                        <th>Value</th>
                        <th>Rate</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.list.map((o, i) => (
                        <tr key={i}>
                          <td>{o.sales_order}</td>
                          <td>{o.affiliate_name}</td>
                          <td>{o.store_name}</td>
                          <td>{o.order_date}</td>
                          <td>{formatRupiah(parseFloat((o.value_order || "0").replace(/[^0-9.-]/g, "")) || 0)}</td>
                          <td>{o.commission_rate}</td>
                          <td>
                            <span className={`ar-badge ${badgeClass(o.reedem_status)}`}>{o.reedem_status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.list.length === 0 && <div className="ar-empty">Belum ada order.</div>}
                </div>
              </div>
            </>
          )}

          <div className="ar-footer">© 2026 OFFLINE TORCH</div>
        </div>
      </div>
    </>
  );
}
