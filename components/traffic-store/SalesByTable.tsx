"use client";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#22c55e", "#fb923c",
  "#0ea5e9", "#d946ef", "#facc15", "#4ade80", "#fb7185",
];

interface SalesByTableProps {
  title: string;
  data: { name: string; count: number; value: number }[];
  colorOffset?: number;
  formatRupiah: (v: number) => string;
}

export function SalesByTable({ title, data, colorOffset = 0, formatRupiah }: SalesByTableProps) {
  if (data.length === 0) return null;
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalValue = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-gray-600">{title}</h4>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Nama</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Transaksi</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Sales</th>
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Avg/Transaksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((d, i) => (
              <tr key={i} className="transition-colors hover:bg-gray-50">
                <td className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[(i + colorOffset) % COLORS.length] }} />
                  <span className="font-medium text-gray-700">{d.name}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700">{d.count}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-green-700">{formatRupiah(d.value)}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-500">{d.count > 0 ? formatRupiah(d.value / d.count) : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-primary/5 font-bold">
              <td className="px-3 py-2 text-xs text-primary">TOTAL</td>
              <td className="px-3 py-2 text-right text-xs text-primary">{totalCount}</td>
              <td className="px-3 py-2 text-right text-xs text-green-700">{formatRupiah(totalValue)}</td>
              <td className="px-3 py-2 text-right text-xs text-gray-500">{totalCount > 0 ? formatRupiah(totalValue / totalCount) : "-"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
