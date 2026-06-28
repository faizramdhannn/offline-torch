"use client";

import { cn } from "@/lib/utils";

interface TrafficEntry {
  store_location: string;
  customer_convert: string;
}

interface StoreTrafficMatrix {
  stores: string[];
  sources: string[];
  map: Record<string, Record<string, number>>;
}

interface MatrixTableProps {
  matrix: StoreTrafficMatrix;
  fd: TrafficEntry[];
  totalBeli: number;
  totalEntries: number;
  toTitleCase: (s: string) => string;
}

const th = "border border-gray-200 px-3 py-2 text-center font-semibold whitespace-nowrap";

export function MatrixTable({ matrix, fd, totalBeli, totalEntries, toTitleCase }: MatrixTableProps) {
  const totalTidakBeli = fd.filter((r) => r.customer_convert === "Tidak Beli").length;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Detail Store × Survey Source</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className={cn(th, "border-r border-gray-200 bg-gray-50 text-left")}>Store</th>
              {matrix.sources.map((src) => (
                <th key={src} className={cn(th, "min-w-[90px] bg-gray-50")}>
                  {src}
                </th>
              ))}
              <th className={cn(th, "bg-green-50")}>Beli</th>
              <th className={cn(th, "bg-red-50")}>Tdk Beli</th>
              <th className={cn(th, "bg-primary/10")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.stores.map((store, i) => {
              const rowTotal = matrix.sources.reduce((s, src) => s + (matrix.map[store]?.[src] || 0), 0);
              const storeBeli = fd.filter((r) => r.store_location === store && r.customer_convert === "Beli").length;
              const storeTidak = fd.filter((r) => r.store_location === store && r.customer_convert === "Tidak Beli").length;
              return (
                <tr key={store} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="whitespace-nowrap border border-gray-200 px-3 py-2 font-medium text-gray-700">{toTitleCase(store)}</td>
                  {matrix.sources.map((src) => {
                    const val = matrix.map[store]?.[src] || 0;
                    return (
                      <td key={src} className="border border-gray-200 px-3 py-2 text-center">
                        {val > 0 ? <span className="font-semibold text-blue-700">{val}</span> : <span className="text-gray-300">-</span>}
                      </td>
                    );
                  })}
                  <td className="border border-gray-200 bg-green-50/50 px-3 py-2 text-center font-semibold text-green-700">{storeBeli || "-"}</td>
                  <td className="border border-gray-200 bg-red-50/50 px-3 py-2 text-center font-semibold text-red-600">{storeTidak || "-"}</td>
                  <td className="border border-gray-200 bg-primary/5 px-3 py-2 text-center font-bold text-primary">{rowTotal}</td>
                </tr>
              );
            })}
            <tr className="bg-primary/10 font-bold">
              <td className="border border-gray-200 px-3 py-2 text-gray-700">TOTAL</td>
              {matrix.sources.map((src) => {
                const colTotal = matrix.stores.reduce((s, store) => s + (matrix.map[store]?.[src] || 0), 0);
                return (
                  <td key={src} className="border border-gray-200 px-3 py-2 text-center text-primary">
                    {colTotal}
                  </td>
                );
              })}
              <td className="border border-gray-200 px-3 py-2 text-center text-green-700">{totalBeli}</td>
              <td className="border border-gray-200 px-3 py-2 text-center text-red-600">{totalTidakBeli}</td>
              <td className="border border-gray-200 px-3 py-2 text-center text-primary">{totalEntries}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
