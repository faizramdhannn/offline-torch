"use client";

interface ReportData {
  store: string;
  pettyCash: number;
  listrik: number;
  total: number;
}

interface ReportTableProps {
  data: ReportData[];
  formatRupiah: (value: number) => string;
}

export function ReportTable({ data, formatRupiah }: ReportTableProps) {
  const grandPettyCash = data.reduce((sum, item) => sum + item.pettyCash, 0);
  const grandListrik = data.reduce((sum, item) => sum + item.listrik, 0);
  const grandTotal = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Store</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Petty Cash</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Listrik</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item, idx) => (
            <tr key={idx} className="transition-colors hover:bg-gray-50">
              <td className="px-3 py-2.5 text-xs font-medium text-gray-800">{item.store}</td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">{formatRupiah(item.pettyCash)}</td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600">{formatRupiah(item.listrik)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-green-600">{formatRupiah(item.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2.5 text-xs text-gray-700">Grand Total</td>
            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-700">{formatRupiah(grandPettyCash)}</td>
            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-700">{formatRupiah(grandListrik)}</td>
            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-green-700">{formatRupiah(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
