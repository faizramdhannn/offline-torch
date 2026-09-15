"use client";

import { useState } from "react";
import { Button } from "@/components/shared/Button";

// Halaman PUBLIK, TIDAK login-gated — sengaja di luar (main) route group
// supaya tidak lewat useSessionGuard/layout otentikasi, sama pola dengan
// app/affiliator/page.tsx. Dipakai jastiper (bukan user internal) untuk cek
// performa mereka sendiri sendiri lewat app/api/jastiper/public/route.ts
// (juga publik, tanpa auth check) — kredensial ringan no HP + kode jastiper,
// BUKAN akun/password sungguhan.
// Link ke halaman ini SENGAJA tidak ditaruh di UI app yang login-gated.

interface JastiperOrderRow {
  sales_order: string;
  store_name: string;
  value: number;
  value_formatted: string;
  date: string | null;
}

interface JastiperInfo {
  jastiper_name: string;
  jastiper_phone_number: string;
  jastiper_store: string;
  jastiper_code: string;
  jastiper_status: string;
}

interface SummaryData {
  total_order: number;
  total_value: number;
  total_value_formatted: string;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function JastiperMonitorPublicPage() {
  const [phone, setPhone] = useState("");
  const [jastiperCode, setJastiperCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jastiper, setJastiper] = useState<JastiperInfo | null>(null);
  const [orders, setOrders] = useState<JastiperOrderRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setJastiper(null);
    setOrders([]);
    setSummary(null);
    try {
      const res = await fetch("/api/jastiper/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, jastiper_code: jastiperCode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat data");
      setJastiper(result.jastiper);
      setOrders(result.orders || []);
      setSummary(result.summary);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .jm-root {
          min-height: 100vh;
          background: linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%);
          font-family: 'IBM Plex Sans', sans-serif;
          padding: 3rem 1.25rem 2.5rem;
        }
        .jm-container { max-width: 640px; margin: 0 auto; }
        .jm-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .jm-logo-img { height: 34px; width: auto; }
        .jm-tagline {
          text-align: center; font-size: 0.72rem; color: #6b7280; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 2.25rem;
        }
        .jm-card {
          background: #ffffff; border: 1px solid #e7eaef; border-radius: 16px;
          box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.08);
          padding: 2rem; margin-bottom: 1.5rem;
        }
        .jm-heading { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem; letter-spacing: -0.01em; }
        .jm-subheading { font-size: 0.82rem; color: #64748b; font-weight: 400; margin-bottom: 1.75rem; line-height: 1.5; }
        .jm-field { margin-bottom: 1.15rem; }
        .jm-label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #475569;
          letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.45rem;
        }
        .jm-input {
          width: 100%; padding: 0.75rem 1rem;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          border-radius: 9px; color: #0f172a;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.9rem; outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .jm-input::placeholder { color: #94a3b8; }
        .jm-input:focus { border-color: #0e7490; background: #ffffff; }
        .jm-error {
          font-size: 0.78rem; color: #b91c1c; font-weight: 500;
          padding: 0.65rem 0.85rem; margin-bottom: 1.1rem;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
        }

        .jm-profile { padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid #eef1f5; }
        .jm-profile-name { font-size: 1.15rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .jm-profile-meta { font-size: 0.8rem; color: #64748b; margin-top: 0.3rem; }
        .jm-profile-code {
          display: inline-block; margin-top: 0.55rem; margin-right: 0.4rem; font-family: 'IBM Plex Mono', monospace;
          font-size: 0.72rem; font-weight: 500; color: #0e7490; background: #ecfeff;
          border: 1px solid #a5f3fc; border-radius: 999px; padding: 0.2rem 0.65rem; letter-spacing: 0.03em;
        }
        .jm-profile-store {
          display: inline-block; margin-top: 0.55rem; font-size: 0.72rem; font-weight: 500; color: #475569;
          background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; padding: 0.2rem 0.65rem;
        }

        .jm-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem; }
        .jm-stat { background: #f8fafc; border: 1px solid #eef1f5; border-radius: 10px; padding: 1rem 1.1rem; }
        .jm-stat-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .jm-stat-value { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-top: 0.3rem; letter-spacing: -0.01em; }

        .jm-section-label { font-size: 0.72rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem; }
        table.jm-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        table.jm-table th, table.jm-table td { text-align: left; padding: 0.65rem 0.7rem; border-bottom: 1px solid #f1f5f9; }
        table.jm-table th { color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; }
        table.jm-table tbody tr:last-child td { border-bottom: none; }
        table.jm-table tbody tr:hover td { background: #fafcfe; }
        .jm-table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 10px; }
        .jm-empty { text-align: center; padding: 2rem 0; color: #94a3b8; font-size: 0.85rem; }
        .jm-footer { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: #94a3b8; letter-spacing: 0.06em; text-align: center; margin-top: 2rem; }
      `}</style>

      <div className="jm-root">
        <div className="jm-container">
          <div className="jm-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png" alt="Torch" className="jm-logo-img" />
          </div>
          <div className="jm-tagline">Jastiper Portal</div>

          <div className="jm-card">
            <h1 className="jm-heading">Cek Performa Jastiper</h1>
            <p className="jm-subheading">Masukkan no HP dan kode jastiper Anda untuk melihat riwayat order dan kontribusi.</p>

            <form onSubmit={handleSubmit}>
              <div className="jm-field">
                <label className="jm-label">No HP</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="mis. 0851-7711-4215"
                  className="jm-input"
                  required
                />
              </div>
              <div className="jm-field">
                <label className="jm-label">Kode Jastiper</label>
                <input
                  type="text"
                  value={jastiperCode}
                  onChange={(e) => setJastiperCode(e.target.value)}
                  placeholder="Kode jastiper Anda"
                  className="jm-input"
                  required
                />
              </div>

              {error && <div className="jm-error">{error}</div>}

              <Button type="submit" loading={loading} className="w-full">
                Cek Performa
              </Button>
            </form>
          </div>

          {jastiper && summary && (
            <div className="jm-card">
              <div className="jm-profile">
                <div className="jm-profile-name">{jastiper.jastiper_name}</div>
                <div className="jm-profile-meta">{jastiper.jastiper_phone_number}</div>
                <span className="jm-profile-code">{jastiper.jastiper_code}</span>
                <span className="jm-profile-store">{jastiper.jastiper_store}</span>
              </div>

              <div className="jm-stat-grid">
                <div className="jm-stat">
                  <div className="jm-stat-label">Total Order</div>
                  <div className="jm-stat-value">{summary.total_order}</div>
                </div>
                <div className="jm-stat">
                  <div className="jm-stat-label">Total Value</div>
                  <div className="jm-stat-value">{summary.total_value_formatted}</div>
                </div>
              </div>

              <div className="jm-section-label">Riwayat Order</div>
              <div className="jm-table-wrap">
                <table className="jm-table">
                  <thead>
                    <tr>
                      <th>Sales Order</th>
                      <th>Store</th>
                      <th>Tanggal</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => (
                      <tr key={i}>
                        <td>{o.sales_order}</td>
                        <td>{o.store_name}</td>
                        <td>{formatDate(o.date)}</td>
                        <td>{o.value_formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length === 0 && <div className="jm-empty">Belum ada order.</div>}
              </div>
            </div>
          )}

          <div className="jm-footer">© 2026 OFFLINE TORCH</div>
        </div>
      </div>
    </>
  );
}
