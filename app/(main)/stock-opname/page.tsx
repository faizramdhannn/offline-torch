"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoStore {
  id: string;
  month: string;
  store: string;
  spreadsheet_link_url: string;
  spreadsheet_id: string;
}

interface StoReport {
  id: string;
  store: string;
  date_sto: string;
  id_erp: string;
  physical_count_qty: string;
  physical_count_value: string;
  system_stock_qty: string;
  system_stock_value: string;
  variance_qty: string;
  variance_value: string;
  inventory_accuracy_qty_percent: string;
  inventory_accuracy_value_percent: string;
  matched_skus: string;
  skus_miss_plus_count: string;
  skus_miss_plus_qty: string;
  skus_miss_plus_value: string;
  skus_miss_minus_count: string;
  skus_miss_minus_qty: string;
  skus_miss_minus_value: string;
  total_sku_variance: string;
  total_variance_qty: string;
  total_variance_value: string;
  total_sku: string;
  inventory_accuracy_sku_percent: string;
  flipflop_skus: string;
  flipflop_variance_qty: string;
  flipflop_variance_value: string;
  penjualan_skus: string;
  penjualan_variance_qty: string;
  penjualan_variance_value: string;
  material_issue_skus: string;
  material_issue_variance_qty: string;
  material_issue_variance_value: string;
  peminjaman_skus: string;
  peminjaman_variance_qty: string;
  peminjaman_variance_value: string;
  reject_skus: string;
  reject_variance_qty: string;
  reject_variance_value: string;
  dn_belum_submit_skus: string;
  dn_belum_submit_variance_qty: string;
  dn_belum_submit_variance_value: string;
  salah_barcode_skus: string;
  salah_barcode_variance_qty: string;
  salah_barcode_variance_value: string;
  no_reason_skus: string;
  no_reason_variance_qty: string;
  no_reason_variance_value: string;
  grand_total_skus: string;
  grand_total_variance_qty: string;
  grand_total_variance_value: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(val: string | null | undefined): string {
  if (!val) return "-";
  return val.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function formatNumber(val: string | null | undefined): string {
  if (!val || val === "0") return "0";
  const cleaned = String(val).replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return val || "-";
  return new Intl.NumberFormat("id-ID").format(num);
}

function formatRupiah(val: string | null | undefined): string {
  if (!val || val === "0") return "Rp 0";
  const cleaned = String(val).replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return val || "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

function parsePercent(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(",", ".").replace("%", "").trim()) || 0;
}

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/\./g, "").replace(",", ".")) || 0;
}

const MONTH_ORDER: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

// ─── CSS Theme builder ────────────────────────────────────────────────────────

function buildCss(isDark: boolean) {
  return {
    pageBg:       isDark ? "#0f1724" : "#eef2f7",
    cardBg:       isDark ? "#1e293b" : "white",
    cardShadow:   isDark ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.07)",
    cardBorder:   isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    textHeading:  isDark ? "#e2e8f0" : "#1e3a5c",
    textValue:    isDark ? "#f1f5f9" : "#1e293b",
    textSub:      isDark ? "#94a3b8" : "#64748b",
    textMuted:    isDark ? "#64748b" : "#94a3b8",
    divider:      isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
    dividerLine:  isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
    selectBg:     isDark ? "#1e293b" : "white",
    selectColor:  isDark ? "#e2e8f0" : "#374151",
    selectBorder: isDark ? "#334155" : "#cbd5e1",
    inputBg:      isDark ? "#1e293b" : "white",
    inputBorder:  isDark ? "#334155" : "#cbd5e1",
    inputColor:   isDark ? "#e2e8f0" : "#374151",
    badgeBg:      isDark ? "#1e3a5c" : "#eff6ff",
    badgeColor:   isDark ? "#93c5fd" : "#1e3a5c",
    metricBg:     isDark ? "#243447" : "#f8fafc",
    metricBorder: isDark ? "#334155" : "#e2e8f0",
    rowAlt:       isDark ? "#243447" : "#f8fafc",
    greenBg:      isDark ? "rgba(74,222,128,0.1)" : "#f0fdf4",
    greenBorder:  isDark ? "rgba(74,222,128,0.2)" : "#bbf7d0",
    yellowBg:     isDark ? "rgba(251,191,36,0.1)" : "#fefce8",
    yellowBorder: isDark ? "rgba(251,191,36,0.2)" : "#fef08a",
    redBg:        isDark ? "rgba(239,68,68,0.1)" : "#fef2f2",
    redBorder:    isDark ? "rgba(239,68,68,0.2)" : "#fecaca",
  };
}

// ─── Spreadsheet icon ─────────────────────────────────────────────────────────

function SpreadsheetIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#1a7a4a"/>
      <rect x="8" y="12" width="32" height="24" rx="2" fill="white" fillOpacity="0.15"/>
      <rect x="8" y="12" width="32" height="6" fill="white" fillOpacity="0.25"/>
      <line x1="8" y1="24" x2="40" y2="24" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="8" y1="30" x2="40" y2="30" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="20" y1="12" x2="20" y2="36" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <line x1="30" y1="12" x2="30" y2="36" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
    </svg>
  );
}

// ─── Accuracy Ring ────────────────────────────────────────────────────────────

function AccuracyRing({ pct, label, isDark }: { pct: number; label: string; isDark: boolean }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = Math.min(pct / 100, 1) * circ;
  const color = pct >= 99 ? "#4ade80" : pct >= 97 ? "#f59e0b" : "#ef4444";
  const trackColor = isDark ? "#334155" : "#f3f4f6";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r={radius} fill="none" stroke={trackColor} strokeWidth="8"/>
          <circle
            cx="36" cy="36" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 10, fontWeight: 800, color }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <span style={{ fontSize: 9, color: isDark ? "#64748b" : "#94a3b8", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent, css }: {
  label: string; value: string; sub?: string;
  accent?: "green" | "red" | "yellow" | "blue" | "gray";
  css: ReturnType<typeof buildCss>;
}) {
  const accentColor: Record<string, string> = {
    green: "#4ade80", red: "#ef4444", yellow: "#f59e0b", blue: "#3b82f6", gray: "#94a3b8",
  };
  const valueColor = accent ? accentColor[accent] : css.textValue;

  return (
    <div style={{
      background: css.metricBg, borderRadius: 8,
      border: `1px solid ${css.metricBorder}`,
      padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ fontSize: 9.5, color: css.textMuted, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: valueColor, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: css.textMuted, lineHeight: 1.2 }}>{sub}</div>}
    </div>
  );
}

// ─── Variance Row ─────────────────────────────────────────────────────────────

function VarianceRow({ label, skus, qty, value, css }: {
  label: string; skus: string; qty: string; value: string;
  css: ReturnType<typeof buildCss>;
}) {
  const skuNum = parseInt(skus) || 0;
  const qtyNum = parseNum(qty);
  const valNum = parseNum(value);
  if (skuNum === 0 && qtyNum === 0) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 0",
      borderBottom: `1px solid ${css.divider}`,
    }}>
      <div style={{ width: 120, fontSize: 10, color: css.textSub, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: css.textValue, width: 28, textAlign: "right" }}>{skuNum}</div>
      <div style={{ fontSize: 10, color: css.textSub, flex: 1, textAlign: "right" }}>
        {qtyNum !== 0 ? (qtyNum > 0 ? `+${formatNumber(qty)}` : formatNumber(qty)) : "-"}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 600, flex: 1, textAlign: "right",
        color: valNum > 0 ? "#ef4444" : valNum < 0 ? "#4ade80" : css.textMuted,
      }}>
        {valNum !== 0 ? formatRupiah(String(Math.abs(valNum))) : "-"}
      </div>
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report, css, isDark }: {
  report: StoReport;
  css: ReturnType<typeof buildCss>;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const accQtyPct = parsePercent(report.inventory_accuracy_qty_percent);
  const accValPct = parsePercent(report.inventory_accuracy_value_percent);
  const accSkuPct = parsePercent(report.inventory_accuracy_sku_percent);
  const varianceQty = parseNum(report.variance_qty);
  const varianceVal = parseNum(report.variance_value);

  // Card border/bg based on accuracy
  const accentBg    = accQtyPct >= 99 ? css.greenBg    : accQtyPct >= 97 ? css.yellowBg    : css.redBg;
  const accentBorder = accQtyPct >= 99 ? css.greenBorder : accQtyPct >= 97 ? css.yellowBorder : css.redBorder;
  const accentColor  = accQtyPct >= 99 ? "#4ade80"       : accQtyPct >= 97 ? "#f59e0b"        : "#ef4444";

  const varianceCategories = [
    { label: "Flip-Flop",       skus: report.flipflop_skus,         qty: report.flipflop_variance_qty,         value: report.flipflop_variance_value },
    { label: "Penjualan",       skus: report.penjualan_skus,         qty: report.penjualan_variance_qty,        value: report.penjualan_variance_value },
    { label: "Material Issue",  skus: report.material_issue_skus,    qty: report.material_issue_variance_qty,   value: report.material_issue_variance_value },
    { label: "Peminjaman",      skus: report.peminjaman_skus,        qty: report.peminjaman_variance_qty,       value: report.peminjaman_variance_value },
    { label: "Reject",          skus: report.reject_skus,            qty: report.reject_variance_qty,           value: report.reject_variance_value },
    { label: "DN Belum Submit", skus: report.dn_belum_submit_skus,   qty: report.dn_belum_submit_variance_qty,  value: report.dn_belum_submit_variance_value },
    { label: "Salah Barcode",   skus: report.salah_barcode_skus,     qty: report.salah_barcode_variance_qty,    value: report.salah_barcode_variance_value },
    { label: "No Reason",       skus: report.no_reason_skus,         qty: report.no_reason_variance_qty,        value: report.no_reason_variance_value },
  ];
  const hasVarianceDetails = varianceCategories.some((c) => parseInt(c.skus) > 0);

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${accentBorder}`,
      background: accentBg,
      boxShadow: css.cardShadow,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${accentBorder}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: css.textValue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {report.store}
          </div>
          <div style={{ fontSize: 10, color: css.textSub, marginTop: 2 }}>{report.date_sto}</div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: accentColor,
          background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.6)",
          border: `1px solid ${accentBorder}`,
          borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {report.inventory_accuracy_qty_percent || "-"}
        </div>
      </div>

      {/* Accuracy rings */}
      <div style={{
        padding: "12px 14px",
        display: "flex", justifyContent: "space-around",
        borderBottom: `1px solid ${accentBorder}`,
        background: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.5)",
      }}>
        <AccuracyRing pct={accSkuPct} label="Akurasi SKU" isDark={isDark} />
        <AccuracyRing pct={accQtyPct} label="Akurasi Qty" isDark={isDark} />
        <AccuracyRing pct={accValPct} label="Akurasi Value" isDark={isDark} />
      </div>

      {/* Key metrics */}
      <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderBottom: `1px solid ${accentBorder}` }}>
        <MetricCard label="Physical Qty"   value={formatNumber(report.physical_count_qty)} sub={formatRupiah(report.physical_count_value)} css={css} />
        <MetricCard label="System Qty"     value={formatNumber(report.system_stock_qty)}   sub={formatRupiah(report.system_stock_value)}   css={css} />
        <MetricCard
          label="Variance Qty"
          value={varianceQty > 0 ? `+${formatNumber(report.variance_qty)}` : formatNumber(report.variance_qty)}
          accent={varianceQty === 0 ? "green" : varianceQty > 0 ? "red" : "yellow"}
          css={css}
        />
        <MetricCard
          label="Variance Value"
          value={formatRupiah(report.variance_value)}
          accent={varianceVal === 0 ? "green" : "red"}
          css={css}
        />
        <MetricCard
          label="Total SKU"
          value={formatNumber(report.total_sku)}
          sub={`${report.matched_skus || 0} matched`}
          css={css}
        />
        <MetricCard
          label="SKU Variance"
          value={formatNumber(report.total_sku_variance)}
          sub={`+${report.skus_miss_plus_count || 0} / -${report.skus_miss_minus_count || 0}`}
          accent={parseInt(report.total_sku_variance) === 0 ? "green" : "red"}
          css={css}
        />
      </div>

      {/* Miss breakdown */}
      <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, borderBottom: `1px solid ${accentBorder}` }}>
        <MetricCard
          label="Miss+"
          value={`${report.skus_miss_plus_count || 0} SKU`}
          sub={`${formatNumber(report.skus_miss_plus_qty)} unit · ${formatRupiah(report.skus_miss_plus_value)}`}
          accent="red"
          css={css}
        />
        <MetricCard
          label="Miss-"
          value={`${report.skus_miss_minus_count || 0} SKU`}
          sub={`${formatNumber(report.skus_miss_minus_qty)} unit · ${formatRupiah(report.skus_miss_minus_value)}`}
          accent="yellow"
          css={css}
        />
      </div>

      {/* Grand total */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${accentBorder}`,
        background: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.5)",
      }}>
        <div style={{ fontSize: 9.5, color: css.textMuted, fontWeight: 600, marginBottom: 6 }}>Grand Total Variance</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "SKU",   val: report.grand_total_skus },
            { label: "Qty",   val: formatNumber(report.grand_total_variance_qty) },
            { label: "Value", val: formatRupiah(report.grand_total_variance_value) },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: css.textMuted }}>{label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: css.textValue }}>{val || "0"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Variance breakdown toggle */}
      {hasVarianceDetails && (
        <div style={{ padding: "8px 14px" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%", background: "none", border: "none",
              fontSize: 10, color: "#3b82f6", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 4, padding: "4px 0",
            }}
          >
            <span>{expanded ? "Sembunyikan" : "Lihat"} Detail Variance</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
            >
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {expanded && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${accentBorder}` }}>
              {/* Column headers */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, padding: "0 0 4px", borderBottom: `1px solid ${css.divider}` }}>
                <div style={{ width: 120, fontSize: 9, color: css.textMuted, fontWeight: 600 }}>Kategori</div>
                <div style={{ fontSize: 9, color: css.textMuted, width: 28, textAlign: "right", fontWeight: 600 }}>SKU</div>
                <div style={{ fontSize: 9, color: css.textMuted, flex: 1, textAlign: "right", fontWeight: 600 }}>Qty</div>
                <div style={{ fontSize: 9, color: css.textMuted, flex: 1, textAlign: "right", fontWeight: 600 }}>Value</div>
              </div>
              {varianceCategories.map((cat) => (
                <VarianceRow key={cat.label} {...cat} css={css} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Store List Card ──────────────────────────────────────────────────────────

function StoreCard({ store, css, isDark, index }: {
  store: StoStore;
  css: ReturnType<typeof buildCss>;
  isDark: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? (isDark ? "#243447" : "#f0f7ff") : css.cardBg,
        border: `1px solid ${hovered ? "#3b82f6" : css.cardBorder}`,
        borderRadius: 10,
        boxShadow: hovered ? "0 4px 16px rgba(59,130,246,0.15)" : css.cardShadow,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        transition: "all 0.15s ease",
      }}
    >
      {/* Store name + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: css.textValue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {capitalize(store.store)}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: css.badgeColor, background: css.badgeBg,
          padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {capitalize(store.month)}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: css.dividerLine }} />

      {/* Link */}
      {store.spreadsheet_link_url ? (
        <a
          href={store.spreadsheet_link_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600, color: "#3b82f6",
            textDecoration: "none",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Buka Spreadsheet
        </a>
      ) : (
        <span style={{ fontSize: 11, color: css.textMuted, fontStyle: "italic" }}>Spreadsheet belum tersedia</span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockOpnamePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"list" | "report">("list");
  const [stores, setStores] = useState<StoStore[]>([]);
  const [reports, setReports] = useState<StoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFetched, setReportFetched] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [searchStore, setSearchStore] = useState("");
  const [searchReport, setSearchReport] = useState("");

  // ── Dark mode ──────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const css = useMemo(() => buildCss(isDark), [isDark]);

  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock_opname && !parsedUser.stock_opname_report) {
      router.push("/dashboard"); return;
    }
    setUser(parsedUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchStores();
  }, [user]);

  useEffect(() => {
    if (!user || tab !== "report" || reportFetched) return;
    fetchReports();
  }, [tab, user]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        username: user.user_name || "",
        hasReportAccess: String(user.stock_opname_report === true || user.stock_opname_report === "true"),
      });
      const res = await fetch(`/api/stock-opname/store?${params}`);
      if (res.ok) setStores(await res.json());
      else showMessage("Gagal memuat data store", "error");
    } catch { showMessage("Gagal memuat data store", "error"); }
    finally { setLoading(false); }
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        username: user.user_name || "",
        hasReportAccess: String(user.stock_opname_report === true || user.stock_opname_report === "true"),
      });
      const res = await fetch(`/api/stock-opname/report?${params}`);
      if (res.ok) {
        setReports(await res.json());
        setReportFetched(true);
      } else showMessage("Gagal memuat data report", "error");
    } catch { showMessage("Gagal memuat data report", "error"); }
    finally { setReportLoading(false); }
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message); setPopupType(type); setShowPopup(true);
  };

  const filteredStores = stores.filter(
    (s) => searchStore === "" ||
      (s.store || "").toLowerCase().includes(searchStore.toLowerCase()) ||
      (s.month || "").toLowerCase().includes(searchStore.toLowerCase())
  );

  const filteredReports = reports.filter(
    (r) => searchReport === "" ||
      (r.store || "").toLowerCase().includes(searchReport.toLowerCase()) ||
      (r.date_sto || "").toLowerCase().includes(searchReport.toLowerCase())
  );

  // Group reports by month
  const reportsByMonth = useMemo(() => {
    const map = new Map<string, StoReport[]>();
    filteredReports.forEach((r) => {
      const parts = (r.date_sto || "").trim().split(" ");
      const key = parts.length >= 3 ? `${parts[1]} ${parts[2]}` : r.date_sto || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    // Sort ascending by year then month
    return [...map.entries()].sort(([a], [b]) => {
      const [am, ay] = a.split(" ");
      const [bm, by] = b.split(" ");
      if (ay !== by) return Number(ay) - Number(by);
      return (MONTH_ORDER[am?.toLowerCase()] ?? 99) - (MONTH_ORDER[bm?.toLowerCase()] ?? 99);
    });
  }, [filteredReports]);

  if (!user) return null;
  const hasReport = user.stock_opname_report === true || user.stock_opname_report === "true";

  const inputStyle: React.CSSProperties = {
    padding: "5px 10px",
    border: `1px solid ${css.inputBorder}`,
    borderRadius: 6, fontSize: 11,
    background: css.inputBg, color: css.inputColor,
    outline: "none", width: 220,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px",
    fontSize: 12, fontWeight: active ? 700 : 500,
    color: active ? (isDark ? "#e2e8f0" : "#1e3a5c") : css.textMuted,
    background: "transparent", border: "none",
    borderRadius: "8px 8px 0 0",
    cursor: "pointer",
    transition: "all 0.15s",
    borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    letterSpacing: "-0.01em",
  });

  return (
    <div
      className="flex-1 overflow-auto"
      style={{ background: css.pageBg, width: "100%", minWidth: 0, transition: "background 0.2s" }}
    >
      <div style={{ padding: "16px 18px", width: "100%", boxSizing: "border-box" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: css.textHeading, margin: 0, letterSpacing: "-0.02em" }}>
              Stock Opname
            </h1>
            <p style={{ fontSize: 10, color: css.textMuted, margin: 0 }}>
              {hasReport ? "Semua store" : `Store: ${user.user_name}`}
            </p>
          </div>
          <button
            onClick={() => { if (tab === "list") fetchStores(); else fetchReports(); }}
            style={{
              padding: "4px 12px", background: "#1e3a5c", color: "white",
              border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 0,
          borderBottom: `2px solid ${css.dividerLine}`,
          marginBottom: 16,
        }}>
          <button style={tabStyle(tab === "list")} onClick={() => setTab("list")}>List</button>
          <button style={tabStyle(tab === "report")} onClick={() => setTab("report")}>Report</button>
        </div>

        {/* ── LIST TAB ── */}
        {tab === "list" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                value={searchStore}
                onChange={(e) => setSearchStore(e.target.value)}
                placeholder="Cari store atau bulan..."
                style={inputStyle}
              />
            </div>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
                <p style={{ color: css.textMuted, fontSize: 13 }}>Loading...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div style={{
                background: css.cardBg, borderRadius: 10, padding: "40px 20px",
                textAlign: "center", color: css.textMuted, fontSize: 13,
                border: `1px solid ${css.cardBorder}`,
              }}>
                Tidak ada data store STO
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}>
                {filteredStores.map((s, i) => (
                  <StoreCard key={`${s.id}-${i}`} store={s} css={css} isDark={isDark} index={i} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── REPORT TAB ── */}
        {tab === "report" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <input
                type="text"
                value={searchReport}
                onChange={(e) => setSearchReport(e.target.value)}
                placeholder="Cari store atau tanggal..."
                style={inputStyle}
              />
              {!reportLoading && (
                <span style={{ fontSize: 11, color: css.textMuted }}>
                  {filteredReports.length} laporan
                </span>
              )}
            </div>

            {reportLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
                <p style={{ color: css.textMuted, fontSize: 13 }}>Loading report...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div style={{
                background: css.cardBg, borderRadius: 10, padding: "40px 20px",
                textAlign: "center", color: css.textMuted, fontSize: 13,
                border: `1px solid ${css.cardBorder}`,
              }}>
                Tidak ada data report STO
              </div>
            ) : hasReport ? (
              /* Grouped by month */
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {reportsByMonth.map(([monthName, monthReports]) => (
                  <div key={monthName}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 10,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: css.textHeading }}>{monthName}</span>
                      <span style={{ fontSize: 10, color: css.textMuted }}>({monthReports.length} laporan)</span>
                    </div>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 12,
                    }}>
                      {monthReports.map((r, i) => (
                        <ReportCard key={`${r.id}-${i}`} report={r} css={css} isDark={isDark} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Own store only */
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}>
                {filteredReports.map((r, i) => (
                  <ReportCard key={`${r.id}-${i}`} report={r} css={css} isDark={isDark} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Popup
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}