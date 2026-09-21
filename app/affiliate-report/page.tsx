"use client";

import { useEffect, useMemo, useState } from "react";
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
import { chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

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
  affiliate_list: { affiliate_code: string; affiliate_name: string; affiliate_store: string; affiliate_job: string; orders: number; value: number; commission: number }[];
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

  // Jumlah affiliate per toko — dihitung di client dari affiliate_list
  // (satu baris = satu affiliate), bukan dari API, karena backend belum
  // punya agregat ini secara terpisah dan datanya sudah lengkap di sini.
  const affiliateCountByStore = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const a of data.affiliate_list) {
      const key = a.affiliate_store || "Tidak Ada Toko";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([store_name, count]) => ({ store_name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Tingkat aktivasi per toko: affiliate terdaftar vs yang sudah pernah
  // closing (orders > 0) — sama-sama dihitung dari affiliate_list.
  const activationByStore = useMemo(() => {
    if (!data) return [];
    const rows = new Map<string, { registered: number; active: number }>();
    for (const a of data.affiliate_list) {
      const key = a.affiliate_store || "Tidak Ada Toko";
      const row = rows.get(key) || { registered: 0, active: 0 };
      row.registered += 1;
      if (a.orders > 0) row.active += 1;
      rows.set(key, row);
    }
    return Array.from(rows.entries())
      .map(([store_name, v]) => ({
        store_name,
        registered: v.registered,
        active: v.active,
        rate: v.registered ? Math.round((v.active / v.registered) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [data]);

  const badgeClass = (status: string) =>
    status === "Sudah Redeem" ? "ar-badge-redeem" : status === "Diproses" ? "ar-badge-diproses" : "ar-badge-belum";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .ar-root {
          --ar-ink: #1c2530; --ar-ink-soft: #57616d; --ar-ink-faint: #8b93a0;
          --ar-line: #e7e3d9; --ar-accent: #0e6e64; --ar-accent-soft: #e4f1ef; --ar-accent-ink: #08423b;
          --ar-warn: #b5580c; --ar-warn-soft: #fbe9d8;
          --ar-good: #1c7c3f; --ar-good-soft: #e3f4e8;
          --ar-shadow: 0 1px 2px rgba(28,37,48,0.04), 0 8px 24px -12px rgba(28,37,48,0.12);
          min-height: 100vh; background: #ffffff; color: var(--ar-ink);
          font-family: 'Inter', -apple-system, sans-serif; padding: 2.5rem 1.25rem 3rem;
        }
        .ar-container { max-width: 1080px; margin: 0 auto; }
        .ar-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .ar-logo-img { height: 34px; width: auto; }
        .ar-tagline { text-align: center; font-size: 0.72rem; color: var(--ar-accent); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 1.75rem; font-family: 'IBM Plex Mono', monospace; }
        .ar-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--ar-line); }
        .ar-title { font-family: 'Fraunces', Georgia, serif; font-size: 1.65rem; font-weight: 600; color: var(--ar-ink); letter-spacing: -0.01em; }
        .ar-select { padding: 0.55rem 0.9rem; background: #ffffff; border: 1.5px solid var(--ar-line); border-radius: 9px; font-size: 0.85rem; color: var(--ar-ink); outline: none; font-family: inherit; }
        .ar-select:focus { border-color: var(--ar-accent); }
        .ar-error { font-size: 0.8rem; color: #b91c1c; font-weight: 500; padding: 0.65rem 0.85rem; margin-bottom: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .ar-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; background: var(--ar-line); border: 1px solid var(--ar-line); border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; box-shadow: var(--ar-shadow); }
        .ar-stat { background: #ffffff; padding: 1.1rem 1.25rem; }
        .ar-stat-label { font-size: 0.68rem; color: var(--ar-ink-faint); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .ar-stat-value { font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; font-weight: 600; color: var(--ar-ink); margin-top: 0.35rem; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
        .ar-grid-2 { display: grid; grid-template-columns: 1fr; gap: 1.25rem; margin-bottom: 1.5rem; }
        @media (min-width: 900px) { .ar-grid-2 { grid-template-columns: 1fr 1fr; } }
        .ar-card { background: #ffffff; border: 1px solid var(--ar-line); border-radius: 12px; box-shadow: var(--ar-shadow); padding: 1.5rem; }
        .ar-card-title { font-family: 'Fraunces', Georgia, serif; font-size: 1.05rem; font-weight: 600; color: var(--ar-ink); margin-bottom: 1rem; }
        table.ar-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        table.ar-table th, table.ar-table td { text-align: left; padding: 0.65rem 0.7rem; border-bottom: 1px solid var(--ar-line); white-space: nowrap; }
        table.ar-table th { color: var(--ar-ink-faint); font-weight: 700; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; }
        table.ar-table tbody tr:hover td { background: #fafaf8; }
        table.ar-table tbody tr:last-child td { border-bottom: none; }
        .ar-num { text-align: right; font-variant-numeric: tabular-nums; }
        .ar-table-wrap { overflow-x: auto; border: 1px solid var(--ar-line); border-radius: 10px; }
        .ar-badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; white-space: nowrap; }
        .ar-badge-belum { background: var(--ar-warn-soft); color: var(--ar-warn); }
        .ar-badge-diproses { background: var(--ar-accent-soft); color: var(--ar-accent-ink); }
        .ar-badge-redeem { background: var(--ar-good-soft); color: var(--ar-good); }
        .ar-pill { display: inline-flex; align-items: center; font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.55rem; border-radius: 999px; }
        .ar-pill-good { background: var(--ar-good-soft); color: var(--ar-good); }
        .ar-pill-warn { background: var(--ar-warn-soft); color: var(--ar-warn); }
        .ar-empty { text-align: center; padding: 2rem 0; color: var(--ar-ink-faint); font-size: 0.85rem; }
        .ar-footer { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: var(--ar-ink-faint); letter-spacing: 0.06em; text-align: center; margin-top: 2.5rem; }
        .ar-code { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; color: var(--ar-ink-soft); }
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
                        <Bar dataKey="commission" name="Komisi" fill="#0e6e64" radius={[6, 6, 0, 0]} />
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
                        <Bar dataKey="commission" name="Komisi" fill="#0e6e64" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="ar-card" style={{ marginBottom: "1.5rem" }}>
                <div className="ar-card-title">Jumlah Affiliate per Toko</div>
                {affiliateCountByStore.length === 0 ? (
                  <div className="ar-empty">Tidak ada data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, affiliateCountByStore.length * 32)}>
                    <BarChart data={affiliateCountByStore} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} horizontal={false} />
                      <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="store_name"
                        tick={chartAxisTick}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => `${v ?? 0} affiliate`} />
                      <Bar dataKey="count" name="Jumlah Affiliate" fill="#0e6e64" radius={[0, 6, 6, 0]}>
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="ar-card" style={{ marginBottom: "1.5rem" }}>
                <div className="ar-card-title">Tingkat Aktivasi Affiliate</div>
                {activationByStore.length === 0 ? (
                  <div className="ar-empty">Tidak ada data</div>
                ) : (
                  <div className="ar-table-wrap">
                    <table className="ar-table">
                      <thead>
                        <tr>
                          <th>Toko</th>
                          <th className="ar-num">Terdaftar</th>
                          <th className="ar-num">Aktif</th>
                          <th className="ar-num">Aktivasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activationByStore.map((s) => (
                          <tr key={s.store_name}>
                            <td>{s.store_name}</td>
                            <td className="ar-num">{s.registered}</td>
                            <td className="ar-num">{s.active}</td>
                            <td className="ar-num">
                              <span className={`ar-pill ${s.rate >= 50 ? "ar-pill-good" : "ar-pill-warn"}`}>{s.rate}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                      <Line type="monotone" dataKey="commission" name="Komisi" stroke="#0e6e64" strokeWidth={2} dot={false} />
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
                        <th>Job</th>
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
                          <td>{a.affiliate_job || "-"}</td>
                          <td className="ar-code">{a.affiliate_code}</td>
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
