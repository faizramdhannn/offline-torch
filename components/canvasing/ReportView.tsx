"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Download, X, Calendar } from "lucide-react";
import { RESULT_STATUS_OPTIONS, STATUS_META } from "./DomainBadges";
import { Canvasing } from "@/types";
import { chartTooltipStyle, chartAxisTick, chartGridStroke } from "@/components/shared/chartStyles";

// ── Derived data helpers ──────────────────────────────────────────────────────

export function buildReportData(filteredData: Canvasing[], toTitleCase: (s: string) => string) {
  const storesInData = [...new Set(filteredData.map((item) => item.store))];
  return storesInData.map((store) => {
    const storeData = filteredData.filter((item) => item.store === store);
    const row: Record<string, string | number> = { store: toTitleCase(store) };
    RESULT_STATUS_OPTIONS.forEach((status) => {
      row[status] = storeData.filter((item) => item.result_status === status).length;
    });
    row.total = storeData.length;
    return row;
  });
}

export function buildPieData(filteredData: Canvasing[]) {
  return RESULT_STATUS_OPTIONS.map((status) => ({
    name: status,
    value: filteredData.filter((item) => item.result_status === status).length,
  })).filter((d) => d.value > 0);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
      {RESULT_STATUS_OPTIONS.map((status) => (
        <div key={status} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: STATUS_META[status]?.color }}
          />
          <span className="text-[11px] text-gray-500">{status}</span>
        </div>
      ))}
    </div>
  );
}

// ── ReportView ─────────────────────────────────────────────────────────────────

interface ReportViewProps {
  filteredData: Canvasing[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onExportXlsx: () => void;
  toTitleCase: (s: string) => string;
}

/**
 * Report view: date-range toolbar, two recharts charts, and a summary table.
 * Purely presentational — all data fetching and export logic stays in the page.
 */
export function ReportView({
  filteredData,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onExportXlsx,
  toTitleCase,
}: ReportViewProps) {
  const reportData = buildReportData(filteredData, toTitleCase);
  const pieData = buildPieData(filteredData);
  const hasDateFilter = dateFrom || dateTo;

  return (
    <>
      {/* Report toolbar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Visit dari
          </p>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-3 text-xs text-gray-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Sampai
          </p>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-3 text-xs text-gray-700 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {hasDateFilter && (
            <button
              onClick={() => {
                onDateFromChange("");
                onDateToChange("");
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-gray-500 hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <button
            onClick={onExportXlsx}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </button>
        </div>
      </div>

      {/* Charts */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bar chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-800">
            Visits per Store
          </p>
          {reportData.length > 0 ? (
            <>
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, reportData.length * 40)}
              >
                <BarChart
                  data={reportData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke={chartGridStroke}
                  />
                  <XAxis
                    type="number"
                    tick={{ ...chartAxisTick, fontSize: 10 }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="store"
                    tick={{ ...chartAxisTick, fontSize: 11 }}
                    width={90}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  {RESULT_STATUS_OPTIONS.map((status, i) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      stackId="a"
                      fill={STATUS_META[status]?.color}
                      radius={
                        i === RESULT_STATUS_OPTIONS.length - 1
                          ? [0, 3, 3, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <ChartLegend />
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              Tidak ada data
            </div>
          )}
        </div>

        {/* Pie chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-800">
            Distribusi Status
          </p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={85}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={STATUS_META[entry.name]?.color || "#8884d8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} visits`, name]}
                    contentStyle={chartTooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 px-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        backgroundColor:
                          STATUS_META[entry.name]?.color || "#8884d8",
                      }}
                    />
                    <span className="min-w-0 truncate text-[11px] text-gray-600">
                      {entry.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] font-semibold text-gray-800">
                      {((entry.value / filteredData.length) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">
              Tidak ada data
            </div>
          )}
        </div>
      </div>

      {/* Summary table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Store
                </th>
                {RESULT_STATUS_OPTIONS.map((status) => (
                  <th
                    key={status}
                    className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {status}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reportData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {row.store as string}
                  </td>
                  {RESULT_STATUS_OPTIONS.map((status) => (
                    <td key={status} className="px-4 py-3 text-center">
                      {(row[status] as number) > 0 ? (
                        <span
                          className="font-semibold"
                          style={{ color: STATUS_META[status]?.color }}
                        >
                          {row[status] as number}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-semibold text-primary">
                    {row.total as number}
                  </td>
                </tr>
              ))}

              {/* Grand total */}
              {reportData.length > 1 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                  <td className="px-4 py-3 font-bold text-gray-700">Total</td>
                  {RESULT_STATUS_OPTIONS.map((status) => {
                    const total = reportData.reduce(
                      (sum, row) => sum + ((row[status] as number) || 0),
                      0
                    );
                    return (
                      <td
                        key={status}
                        className="px-4 py-3 text-center font-bold"
                        style={{
                          color: total > 0 ? STATUS_META[status]?.color : "#D1D5DB",
                        }}
                      >
                        {total > 0 ? total : "—"}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-bold text-primary">
                    {reportData.reduce(
                      (sum, row) => sum + (row.total as number),
                      0
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {reportData.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-400">
              Tidak ada data untuk ditampilkan
            </div>
          )}
        </div>
      </div>
    </>
  );
}