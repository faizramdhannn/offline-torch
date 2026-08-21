"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/shared/Button";

// Halaman PUBLIK, TIDAK login-gated — sengaja di luar (main) route group
// supaya tidak lewat useSessionGuard/layout otentikasi. Dipakai affiliator
// (bukan user internal) untuk cek performa mereka sendiri lewat
// app/api/affiliate/public/route.ts (juga publik, tanpa auth check).
// Link ke halaman ini SENGAJA tidak ditaruh di UI app yang login-gated.

interface AffiliateOrderRow {
  sales_order: string;
  store_name: string;
  order_date: string;
  value_order: string;
  commission_rate: string;
  reedem_status: string;
}

interface AffiliateInfo {
  affiliate_name: string;
  affiliate_number: string;
  affiliate_code: string;
}

interface SummaryData {
  total_orders: number;
  total_commission: number;
  commission_by_status: Record<string, number>;
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value || 0);
}

export default function AffiliatorPublicPage() {
  const [email, setEmail] = useState("");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(null);
  const [orders, setOrders] = useState<AffiliateOrderRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);

  // Sama seperti AffiliateCard di app/(main)/affiliate/page.tsx — render QR
  // ke <canvas> via qrcode.react, lalu gambar ulang QR + teks ke canvas
  // offscreen supaya bisa di-download jadi 1 file PNG kartu nama.
  const handleDownloadQr = (info: AffiliateInfo) => {
    setDownloadingQr(true);
    try {
      const qrCanvas = document.getElementById(
        "affiliator-qr-canvas"
      ) as HTMLCanvasElement | null;
      if (!qrCanvas) throw new Error("QR canvas not found");

      const width = 500;
      const height = 220;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      const qrSize = 180;
      const qrPad = 20;
      ctx.drawImage(qrCanvas, qrPad, (height - qrSize) / 2, qrSize, qrSize);

      const textX = qrPad + qrSize + 30;
      ctx.fillStyle = "#111827";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(info.affiliate_name || "-", textX, height / 2 - 10);

      ctx.fillStyle = "#6b7280";
      ctx.font = "16px sans-serif";
      ctx.fillText(info.affiliate_number || "-", textX, height / 2 + 20);

      ctx.fillStyle = "#0e7490";
      ctx.font = "600 14px sans-serif";
      ctx.fillText(info.affiliate_code || "-", textX, height / 2 + 45);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Affiliate_${(info.affiliate_name || "unknown").replace(/\s+/g, "_")}_${info.affiliate_code || ""}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download affiliate QR:", err);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setAffiliate(null);
    setOrders([]);
    setSummary(null);
    try {
      const res = await fetch("/api/affiliate/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, affiliate_code: affiliateCode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memuat data");
      setAffiliate(result.affiliate);
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
        .af-root {
          min-height: 100vh;
          background: linear-gradient(180deg, #f4f7fb 0%, #eef2f8 100%);
          font-family: 'IBM Plex Sans', sans-serif;
          padding: 3rem 1.25rem 2.5rem;
        }
        .af-container { max-width: 640px; margin: 0 auto; }
        .af-brand { display: flex; align-items: center; justify-content: center; margin-bottom: 0.6rem; }
        .af-logo-img { height: 34px; width: auto; }
        .af-tagline {
          text-align: center; font-size: 0.72rem; color: #6b7280; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 2.25rem;
        }
        .af-card {
          background: #ffffff; border: 1px solid #e7eaef; border-radius: 16px;
          box-shadow: 0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.08);
          padding: 2rem; margin-bottom: 1.5rem;
        }
        .af-heading { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem; letter-spacing: -0.01em; }
        .af-subheading { font-size: 0.82rem; color: #64748b; font-weight: 400; margin-bottom: 1.75rem; line-height: 1.5; }
        .af-field { margin-bottom: 1.15rem; }
        .af-label {
          display: block; font-size: 0.7rem; font-weight: 600; color: #475569;
          letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.45rem;
        }
        .af-input {
          width: 100%; padding: 0.75rem 1rem;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          border-radius: 9px; color: #0f172a;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.9rem; outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .af-input::placeholder { color: #94a3b8; }
        .af-input:focus { border-color: #0e7490; background: #ffffff; }
        .af-error {
          font-size: 0.78rem; color: #b91c1c; font-weight: 500;
          padding: 0.65rem 0.85rem; margin-bottom: 1.1rem;
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
        }

        .af-profile { display: flex; align-items: center; gap: 1.25rem; padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid #eef1f5; }
        .af-qr-box { flex-shrink: 0; padding: 8px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; }
        .af-profile-name { font-size: 1.15rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
        .af-profile-meta { font-size: 0.8rem; color: #64748b; margin-top: 0.3rem; }
        .af-profile-code {
          display: inline-block; margin-top: 0.55rem; font-family: 'IBM Plex Mono', monospace;
          font-size: 0.72rem; font-weight: 500; color: #0e7490; background: #ecfeff;
          border: 1px solid #a5f3fc; border-radius: 999px; padding: 0.2rem 0.65rem; letter-spacing: 0.03em;
        }

        .af-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.85rem; margin-bottom: 1.25rem; }
        .af-stat { background: #f8fafc; border: 1px solid #eef1f5; border-radius: 10px; padding: 1rem 1.1rem; }
        .af-stat-label { font-size: 0.68rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .af-stat-value { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-top: 0.3rem; letter-spacing: -0.01em; }

        .af-section-label { font-size: 0.72rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem; }
        table.af-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        table.af-table th, table.af-table td { text-align: left; padding: 0.65rem 0.7rem; border-bottom: 1px solid #f1f5f9; }
        table.af-table th { color: #64748b; font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; }
        table.af-table tbody tr:last-child td { border-bottom: none; }
        table.af-table tbody tr:hover td { background: #fafcfe; }
        .af-table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 10px; }
        .af-badge {
          padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; white-space: nowrap;
        }
        .af-badge-belum { background: #fef3c7; color: #92400e; }
        .af-badge-diproses { background: #dbeafe; color: #1e40af; }
        .af-badge-redeem { background: #dcfce7; color: #166534; }
        .af-empty { text-align: center; padding: 2rem 0; color: #94a3b8; font-size: 0.85rem; }
        .af-footer { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: #94a3b8; letter-spacing: 0.06em; text-align: center; margin-top: 2rem; }
      `}</style>

      <div className="af-root">
        <div className="af-container">
          <div className="af-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png" alt="Torch" className="af-logo-img" />
          </div>
          <div className="af-tagline">Affiliate Portal</div>

          <div className="af-card">
            <h1 className="af-heading">Cek Performa Affiliate</h1>
            <p className="af-subheading">Masukkan email dan kode affiliate Anda untuk melihat riwayat order dan komisi.</p>

            <form onSubmit={handleSubmit}>
              <div className="af-field">
                <label className="af-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="af-input"
                  required
                />
              </div>
              <div className="af-field">
                <label className="af-label">Kode Affiliate</label>
                <input
                  type="text"
                  value={affiliateCode}
                  onChange={(e) => setAffiliateCode(e.target.value)}
                  placeholder="Kode affiliate Anda"
                  className="af-input"
                  required
                />
              </div>

              {error && <div className="af-error">{error}</div>}

              <Button type="submit" loading={loading} className="w-full">
                Cek Performa
              </Button>
            </form>
          </div>

          {affiliate && summary && (
            <div className="af-card">
              <div className="af-profile">
                <div className="af-qr-box">
                  <QRCodeCanvas
                    id="affiliator-qr-canvas"
                    value={affiliate.affiliate_code}
                    size={78}
                    level="H"
                    imageSettings={{
                      // Logo asli 3544x1182px (rasio ~3:1) — pertahankan rasionya,
                      // jangan dipaksa persegi.
                      src: "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png",
                      height: 10,
                      width: 30,
                      excavate: true,
                      crossOrigin: "anonymous",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="af-profile-name">{affiliate.affiliate_name}</div>
                  <div className="af-profile-meta">{affiliate.affiliate_number}</div>
                  <span className="af-profile-code">{affiliate.affiliate_code}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  loading={downloadingQr}
                  onClick={() => handleDownloadQr(affiliate)}
                >
                  Download QR
                </Button>
              </div>

              <div className="af-stat-grid">
                <div className="af-stat">
                  <div className="af-stat-label">Total Order</div>
                  <div className="af-stat-value">{summary.total_orders}</div>
                </div>
                <div className="af-stat">
                  <div className="af-stat-label">Total Komisi</div>
                  <div className="af-stat-value">{formatRupiah(summary.total_commission)}</div>
                </div>
              </div>

              {summary.commission_by_status && Object.keys(summary.commission_by_status).length > 0 && (
                <div className="af-stat-grid">
                  {Object.entries(summary.commission_by_status).map(([status, value]) => (
                    <div className="af-stat" key={status}>
                      <div className="af-stat-label">{status}</div>
                      <div className="af-stat-value">{formatRupiah(value)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="af-section-label">Riwayat Order</div>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>Sales Order</th>
                      <th>Store</th>
                      <th>Tanggal</th>
                      <th>Value</th>
                      <th>Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => {
                      const statusClass =
                        o.reedem_status === "Sudah Redeem" ? "af-badge-redeem"
                        : o.reedem_status === "Diproses" ? "af-badge-diproses"
                        : "af-badge-belum";
                      return (
                        <tr key={i}>
                          <td>{o.sales_order}</td>
                          <td>{o.store_name}</td>
                          <td>{o.order_date}</td>
                          <td>{formatRupiah(parseFloat((o.value_order || "0").replace(/[^0-9.-]/g, "")) || 0)}</td>
                          <td>{o.commission_rate}</td>
                          <td><span className={`af-badge ${statusClass}`}>{o.reedem_status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {orders.length === 0 && <div className="af-empty">Belum ada order.</div>}
              </div>
            </div>
          )}

          <div className="af-footer">© 2026 OFFLINE TORCH</div>
        </div>
      </div>
    </>
  );
}
