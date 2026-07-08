"use client";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#22c55e", "#fb923c",
  "#0ea5e9", "#d946ef", "#facc15", "#4ade80", "#fb7185",
];

interface TrafficEntry {
  traffic_source: string;
  customer_convert: string;
  value_order?: string;
}

interface SummaryTableProps {
  trafficChartData: { name: string; value: number }[];
  fd: TrafficEntry[];
  parseValue: (v: string | undefined) => number;
  formatRupiah: (v: number) => string;
}

export function SummaryTable({ trafficChartData, fd, parseValue, formatRupiah }: SummaryTableProps) {
  const total = trafficChartData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Ringkasan Survey Source</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Survey Source</th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Jumlah</th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Beli</th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Conv. Rate</th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total Sales</th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trafficChartData.map((t, i) => {
              const trafficBeli = fd.filter((r) => r.traffic_source === t.name && r.customer_convert === "Beli").length;
              const trafficSales = fd
                .filter((r) => r.traffic_source === t.name && r.customer_convert === "Beli")
                .reduce((s, r) => s + parseValue(r.value_order), 0);
              const convPct = t.value ? `${((trafficBeli / t.value) * 100).toFixed(1)}%` : "-";
              return (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  <td className="flex items-center gap-2 px-2 py-1 text-[11px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-700">{t.name}</span>
                  </td>
                  <td className="px-2 py-1 text-right text-[11px] font-medium text-gray-700">{t.value}</td>
                  <td className="px-2 py-1 text-right text-[11px] font-medium text-green-700">{trafficBeli}</td>
                  <td className="px-2 py-1 text-right text-[11px] text-orange-600">{convPct}</td>
                  <td className="px-2 py-1 text-right text-[11px] font-medium text-teal-700">{trafficSales > 0 ? formatRupiah(trafficSales) : "-"}</td>
                  <td className="px-2 py-1 text-right text-[11px] text-gray-500">{total ? `${((t.value / total) * 100).toFixed(1)}%` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
