"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}

function parsePercent(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(",", ".").replace("%", "").trim()) || 0;
}

function getAccuracyColor(pct: number): string {
  if (pct >= 99) return "text-emerald-600";
  if (pct >= 97) return "text-yellow-600";
  return "text-red-600";
}

function getAccuracyBg(pct: number): string {
  if (pct >= 99) return "bg-emerald-50 border-emerald-200";
  if (pct >= 97) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  accent,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "blue" | "yellow" | "gray";
  small?: boolean;
}) {
  const accentMap = {
    green: "text-emerald-600",
    red: "text-red-600",
    blue: "text-blue-600",
    yellow: "text-yellow-600",
    gray: "text-gray-600",
  };
  const colorClass = accent ? accentMap[accent] : "text-gray-800";

  return (
    <div className="bg-white rounded border border-gray-200 p-3 flex flex-col gap-0.5">
      <div className="text-[10px] text-gray-500 leading-tight">{label}</div>
      <div className={`font-semibold ${small ? "text-sm" : "text-base"} ${colorClass} leading-tight`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-400 leading-tight">{sub}</div>}
    </div>
  );
}

function AccuracyRing({ pct, label }: { pct: number; label: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = Math.min(pct / 100, 1) * circ;
  const color = pct >= 99 ? "#10b981" : pct >= 97 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle
            cx="36" cy="36" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <span className="text-[9px] text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function VarianceRow({
  label,
  skus,
  qty,
  value,
}: {
  label: string;
  skus: string;
  qty: string;
  value: string;
}) {
  const skuNum = parseInt(skus) || 0;
  const qtyNum = parseFloat(String(qty).replace(/\./g, "").replace(",", ".")) || 0;
  const valNum = parseFloat(String(value).replace(/\./g, "").replace(",", ".")) || 0;
  if (skuNum === 0 && qtyNum === 0) return null;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <div className="w-32 text-[10px] text-gray-600 flex-shrink-0">{label}</div>
      <div className="text-[10px] font-medium text-gray-700 w-8 text-right">{skuNum}</div>
      <div className="text-[10px] text-gray-500 flex-1 text-right">
        {qtyNum !== 0 ? (qtyNum > 0 ? `+${formatNumber(qty)}` : formatNumber(qty)) : "-"}
      </div>
      <div className={`text-[10px] font-medium flex-1 text-right ${valNum > 0 ? "text-red-500" : valNum < 0 ? "text-emerald-600" : "text-gray-400"}`}>
        {valNum !== 0 ? formatRupiah(String(Math.abs(valNum))) : "-"}
      </div>
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: StoReport }) {
  const [expanded, setExpanded] = useState(false);

  const accQtyPct  = parsePercent(report.inventory_accuracy_qty_percent);
  const accValPct  = parsePercent(report.inventory_accuracy_value_percent);
  const accSkuPct  = parsePercent(report.inventory_accuracy_sku_percent);

  const varianceQty = parseFloat(String(report.variance_qty).replace(/\./g, "").replace(",", ".")) || 0;
  const varianceVal = parseFloat(String(report.variance_value).replace(/\./g, "").replace(",", ".")) || 0;

  const varianceCategories = [
    { label: "Flip-Flop",       skus: report.flipflop_skus,          qty: report.flipflop_variance_qty,          value: report.flipflop_variance_value },
    { label: "Penjualan",       skus: report.penjualan_skus,          qty: report.penjualan_variance_qty,         value: report.penjualan_variance_value },
    { label: "Material Issue",  skus: report.material_issue_skus,     qty: report.material_issue_variance_qty,    value: report.material_issue_variance_value },
    { label: "Peminjaman",      skus: report.peminjaman_skus,         qty: report.peminjaman_variance_qty,        value: report.peminjaman_variance_value },
    { label: "Reject",          skus: report.reject_skus,             qty: report.reject_variance_qty,            value: report.reject_variance_value },
    { label: "DN Belum Submit", skus: report.dn_belum_submit_skus,    qty: report.dn_belum_submit_variance_qty,   value: report.dn_belum_submit_variance_value },
    { label: "Salah Barcode",   skus: report.salah_barcode_skus,      qty: report.salah_barcode_variance_qty,     value: report.salah_barcode_variance_value },
    { label: "No Reason",       skus: report.no_reason_skus,          qty: report.no_reason_variance_qty,         value: report.no_reason_variance_value },
  ];

  const hasVarianceDetails = varianceCategories.some(c => parseInt(c.skus) > 0);

  return (
    <div className={`rounded-lg border ${getAccuracyBg(accQtyPct)} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-800 truncate">{report.store}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{report.date_sto}</div>
        </div>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${getAccuracyBg(accQtyPct)} ${getAccuracyColor(accQtyPct)}`}>
          {report.inventory_accuracy_qty_percent || "-"}
        </div>
      </div>

      {/* Accuracy rings */}
      <div className="px-4 py-3 flex justify-around border-b border-gray-100 bg-white/60">
        <AccuracyRing pct={accSkuPct}  label="Akurasi SKU" />
        <AccuracyRing pct={accQtyPct}  label="Akurasi Qty" />
        <AccuracyRing pct={accValPct}  label="Akurasi Value" />
      </div>

      {/* Key metrics grid */}
      <div className="px-3 py-2 grid grid-cols-2 gap-1.5 border-b border-gray-100">
        <MetricCard label="Physical Qty"   value={formatNumber(report.physical_count_qty)} sub={formatRupiah(report.physical_count_value)} small />
        <MetricCard label="System Qty"     value={formatNumber(report.system_stock_qty)}   sub={formatRupiah(report.system_stock_value)}   small />
        <MetricCard
          label="Variance Qty"
          value={varianceQty > 0 ? `+${formatNumber(report.variance_qty)}` : formatNumber(report.variance_qty)}
          accent={varianceQty === 0 ? "green" : varianceQty > 0 ? "red" : "yellow"}
          small
        />
        <MetricCard
          label="Variance Value"
          value={formatRupiah(report.variance_value)}
          accent={varianceVal === 0 ? "green" : "red"}
          small
        />
        <MetricCard label="Total SKU"     value={formatNumber(report.total_sku)}           sub={`${report.matched_skus || 0} matched`}     small />
        <MetricCard
          label="SKU Variance"
          value={formatNumber(report.total_sku_variance)}
          sub={`+${report.skus_miss_plus_count || 0} / -${report.skus_miss_minus_count || 0}`}
          accent={parseInt(report.total_sku_variance) === 0 ? "green" : "red"}
          small
        />
      </div>

      {/* Miss breakdown */}
      <div className="px-3 py-2 grid grid-cols-2 gap-1.5 border-b border-gray-100">
        <MetricCard
          label="Miss+ (SKU/Qty/Val)"
          value={`${report.skus_miss_plus_count || 0} SKU`}
          sub={`${formatNumber(report.skus_miss_plus_qty)} unit · ${formatRupiah(report.skus_miss_plus_value)}`}
          accent="red"
          small
        />
        <MetricCard
          label="Miss- (SKU/Qty/Val)"
          value={`${report.skus_miss_minus_count || 0} SKU`}
          sub={`${formatNumber(report.skus_miss_minus_qty)} unit · ${formatRupiah(report.skus_miss_minus_value)}`}
          accent="yellow"
          small
        />
      </div>

      {/* Grand total */}
      <div className="px-3 py-2 border-b border-gray-100 bg-white/60">
        <div className="text-[10px] text-gray-500 mb-1.5 font-medium">Grand Total Variance</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] text-gray-400">SKU</div>
            <div className="text-xs font-semibold text-gray-800">{report.grand_total_skus || "0"}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Qty</div>
            <div className="text-xs font-semibold text-gray-800">{formatNumber(report.grand_total_variance_qty)}</div>
          </div>
          <div>
            <div className="text-[9px] text-gray-400">Value</div>
            <div className="text-xs font-semibold text-gray-800">{formatRupiah(report.grand_total_variance_value)}</div>
          </div>
        </div>
      </div>

      {/* Variance breakdown toggle */}
      {hasVarianceDetails && (
        <div className="px-3 py-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-[10px] text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1"
          >
            <span>{expanded ? "Sembunyikan" : "Lihat"} Detail Variance</span>
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="flex items-center gap-2 mb-1 px-0.5">
                <div className="w-32 text-[9px] text-gray-400 font-medium">Kategori</div>
                <div className="text-[9px] text-gray-400 w-8 text-right">SKU</div>
                <div className="text-[9px] text-gray-400 flex-1 text-right">Qty</div>
                <div className="text-[9px] text-gray-400 flex-1 text-right">Value</div>
              </div>
              {varianceCategories.map((cat) => (
                <VarianceRow key={cat.label} {...cat} />
              ))}
            </div>
          )}
        </div>
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

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock_opname && !parsedUser.stock_opname_report) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
  }, []);

  // Fetch stores once user is ready
  useEffect(() => {
    if (!user) return;
    fetchStores();
  }, [user]);

  // Fetch reports when switching to report tab (only once)
  useEffect(() => {
    if (!user || tab !== "report" || reportFetched) return;
    fetchReports();
  }, [tab, user]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        username: user.user_name || "",
        // stock_opname_report may not exist in old localStorage — treat undefined as false
        hasReportAccess: String(user.stock_opname_report === true || user.stock_opname_report === "true"),
      });
      const res = await fetch(`/api/stock-opname/stores?${params}`);
      if (res.ok) {
        const json = await res.json();
        setStores(json);
      } else {
        showMessage("Gagal memuat data store", "error");
      }
    } catch {
      showMessage("Gagal memuat data store", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        username: user.user_name || "",
        hasReportAccess: String(user.stock_opname_report === true || user.stock_opname_report === "true"),
      });
      const res = await fetch(`/api/stock-opname/reports?${params}`);
      if (res.ok) {
        const json = await res.json();
        setReports(json);
        setReportFetched(true);
      } else {
        showMessage("Gagal memuat data report", "error");
      }
    } catch {
      showMessage("Gagal memuat data report", "error");
    } finally {
      setReportLoading(false);
    }
  };

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const filteredStores = stores.filter(
    (s) =>
      searchStore === "" ||
      (s.store || "").toLowerCase().includes(searchStore.toLowerCase()) ||
      (s.month || "").toLowerCase().includes(searchStore.toLowerCase())
  );

  const filteredReports = reports.filter(
    (r) =>
      searchReport === "" ||
      (r.store || "").toLowerCase().includes(searchReport.toLowerCase()) ||
      (r.date_sto || "").toLowerCase().includes(searchReport.toLowerCase())
  );

  // Group reports by store name
  const reportsByStore = filteredReports.reduce<Record<string, StoReport[]>>((acc, r) => {
    const key = r.store || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  if (!user) return null;

  const hasReport = user.stock_opname_report === true || user.stock_opname_report === "true";

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-primary">Stock Opname</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasReport ? "Semua store" : `Store: ${user.user_name}`}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white rounded-lg shadow p-1 w-fit">
            <button
              onClick={() => setTab("list")}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                tab === "list"
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              List Store STO
            </button>
            <button
              onClick={() => setTab("report")}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                tab === "report"
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              Report STO
            </button>
          </div>

          {/* ── LIST TAB ─────────────────────────────────────────────────── */}
          {tab === "list" && (
            <>
              <div className="mb-3">
                <input
                  type="text"
                  value={searchStore}
                  onChange={(e) => setSearchStore(e.target.value)}
                  placeholder="Cari store atau bulan..."
                  className="w-64 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
                  Loading...
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
                  Tidak ada data store STO
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">No</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Bulan STO</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Store (Username)</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Spreadsheet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStores.map((s, idx) => (
                          <tr key={s.id} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">{s.month || "-"}</td>
                            <td className="px-3 py-2 text-gray-700">{s.store || "-"}</td>
                            <td className="px-3 py-2">
                              {s.spreadsheet_link_url ? (
                                <a
                                  href={s.spreadsheet_link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Buka Spreadsheet
                                </a>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 border-t bg-gray-50">
                    <span className="text-[10px] text-gray-500">{filteredStores.length} store ditemukan</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── REPORT TAB ───────────────────────────────────────────────── */}
          {tab === "report" && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <input
                  type="text"
                  value={searchReport}
                  onChange={(e) => setSearchReport(e.target.value)}
                  placeholder="Cari store atau tanggal..."
                  className="w-64 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {!reportLoading && (
                  <span className="text-xs text-gray-500">{filteredReports.length} laporan</span>
                )}
              </div>

              {reportLoading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
                  Loading report...
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500">
                  Tidak ada data report STO
                </div>
              ) : hasReport ? (
                /* Report access: grouped by store name */
                <div className="space-y-6">
                  {Object.entries(reportsByStore).map(([storeName, storeReports]) => (
                    <div key={storeName}>
                      <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                        {storeName}
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({storeReports.length} laporan)
                        </span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {storeReports.map((r) => (
                          <ReportCard key={r.id} report={r} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* No report access: show own store cards */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredReports.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Popup show={showPopup} message={popupMessage} type={popupType} onClose={() => setShowPopup(false)} />
    </div>
  );
}