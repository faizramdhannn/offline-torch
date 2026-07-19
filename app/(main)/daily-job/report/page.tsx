"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHART_PALETTE, chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";
import { Pagination } from "@/components/shared/Pagination";

interface DailyTrendPoint {
  date: string;
  total_error_delivery_note: number;
  total_error_sales_order: number;
  total_error_stock_entry: number;
}

interface CompletionTrendPoint {
  date: string;
  completed_count: number;
  total_taft_count: number;
  completion_rate: number;
}

interface CountTrendPoint {
  date: string;
  count: number;
}

interface ReportResponse {
  dailyTrend: DailyTrendPoint[];
  completionTrend: CompletionTrendPoint[];
  deliveryNoteTrend: CountTrendPoint[];
  salesOrderTrend: CountTrendPoint[];
  stockEntryTrend: CountTrendPoint[];
  checklistRows: any[];
  deliveryNoteRows: any[];
  salesOrderRows: any[];
  stockEntryRows: any[];
}

const ITEMS_PER_PAGE = 10;

const TABS = [
  { key: "checklist", label: "Daily Checklist" },
  { key: "delivery", label: "Delivery Note" },
  { key: "sales", label: "Sales Order" },
  { key: "stock", label: "Stock Entry" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function RawTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const paged = rows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-[11px] text-gray-400">{rows.length} baris</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
              {columns.map((c) => (
                <th key={c} className="px-2 py-2 text-left border-r border-gray-200 whitespace-nowrap last:border-r-0">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-6 text-gray-400">Tidak ada data</td></tr>
            ) : (
              paged.map((r, idx) => (
                <tr key={r.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-2 border-r border-gray-200 whitespace-nowrap max-w-[220px] truncate last:border-r-0">
                      {String(r[c] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rangeLabel={`${rows.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}-${Math.min(page * ITEMS_PER_PAGE, rows.length)} dari ${rows.length}`}
      />
    </div>
  );
}

export default function DailyJobReportPage() {
  const router = useRouter();
  useSessionGuard();

  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("checklist");

  // Filter tanggal — kosong berarti "semua hari" (tidak dibatasi rentang).
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.daily_checklist_all) { router.push("/dashboard"); return; }
    setUser(u);
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const qs = params.toString();
      const res = await fetch(`/api/daily-job/report${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // ignore — table stays empty
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!user) return;
    fetchReport();
  }, [user, fetchReport]);

  const resetFilter = () => {
    setFromDate("");
    setToDate("");
  };

  const completionTrendPct = useMemo(
    () =>
      (data?.completionTrend || []).map((p) => ({
        ...p,
        completion_rate_pct: Math.round(p.completion_rate * 1000) / 10,
      })),
    [data]
  );

  if (!user) return null;

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Daily Job Report</h1>
        <p className="text-xs text-gray-500">Ringkasan checklist &amp; laporan error harian seluruh taft</p>
      </div>

      {/* Filter tanggal */}
      <div className="bg-white rounded-lg shadow p-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
        </div>
        <button
          onClick={resetFilter}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Semua Hari
        </button>
        <span className="text-[11px] text-gray-400 ml-auto">
          {fromDate || toDate ? `Menampilkan ${fromDate || "awal"} s/d ${toDate || "hari ini"}` : "Menampilkan semua hari"}
        </span>
      </div>

      {/* Tab menu */}
      <div className="bg-white rounded-lg shadow px-2 pt-2 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 text-sm">Memuat data...</div>
      ) : (
        <>
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Trend Total Error per Hari</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data?.dailyTrend || []}>
                      <CartesianGrid stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="date" tick={chartAxisTick} />
                      <YAxis tick={chartAxisTick} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="total_error_delivery_note" name="Delivery Note" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="total_error_sales_order" name="Sales Order" stroke={CHART_PALETTE[1]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="total_error_stock_entry" name="Stock Entry" stroke={CHART_PALETTE[4]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">Trend Completion Rate Checklist</h3>
                  <p className="text-[10px] text-gray-400 mb-2">
                    Perkiraan — denominator = jumlah taft unik yang pernah mengisi checklist (bukan roster HR aktual).
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={completionTrendPct}>
                      <CartesianGrid stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="date" tick={chartAxisTick} />
                      <YAxis tick={chartAxisTick} unit="%" domain={[0, 100]} />
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v?: number) => `${v ?? 0}%`} />
                      <Line type="monotone" dataKey="completion_rate_pct" name="Completion Rate" stroke={CHART_PALETTE[2]} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <RawTable
                title="Daily Checklist"
                rows={data?.checklistRows || []}
                columns={["created_at", "taft_by", "role_taft", "name", "total_error_delivery_note", "total_error_sales_order", "total_error_stock_entry"]}
              />
            </div>
          )}

          {activeTab === "delivery" && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Jumlah Laporan Delivery Note per Hari</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data?.deliveryNoteTrend || []}>
                    <CartesianGrid stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="date" tick={chartAxisTick} />
                    <YAxis tick={chartAxisTick} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" name="Delivery Note" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <RawTable
                title="Delivery Note Report"
                rows={data?.deliveryNoteRows || []}
                columns={["created_at", "taft_by", "error_sales_order_delivery_note", "error_category_delivery_note", "error_solved_delivery_note", "solved_at"]}
              />
            </div>
          )}

          {activeTab === "sales" && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Jumlah Laporan Sales Order per Hari</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data?.salesOrderTrend || []}>
                    <CartesianGrid stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="date" tick={chartAxisTick} />
                    <YAxis tick={chartAxisTick} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" name="Sales Order" stroke={CHART_PALETTE[1]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <RawTable
                title="Sales Order Report"
                rows={data?.salesOrderRows || []}
                columns={["created_at", "taft_by", "error_sales_order", "error_category_sales_order", "error_solved_sales_order", "solved_at"]}
              />
            </div>
          )}

          {activeTab === "stock" && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Jumlah Laporan Stock Entry per Hari</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data?.stockEntryTrend || []}>
                    <CartesianGrid stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="date" tick={chartAxisTick} />
                    <YAxis tick={chartAxisTick} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" name="Stock Entry" stroke={CHART_PALETTE[4]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <RawTable
                title="Stock Entry Report"
                rows={data?.stockEntryRows || []}
                columns={["created_at", "taft_by", "error_stock_entry", "error_category_stock_entry", "error_solved_stock_entry", "solved_at"]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
