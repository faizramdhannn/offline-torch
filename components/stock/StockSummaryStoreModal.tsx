"use client";

import { X } from "lucide-react";

interface StoreRow {
  name: string;
  key: string;
}

interface StockSummaryStoreModalProps {
  /** "qty" nampilin angka unit polos, "value" pakai formatValue (rupiah). */
  metricMode: "qty" | "value";
  /** name -> total metric (qty atau value) untuk store itu, dari chartData yang sudah menghormati filter aktif. */
  totalsByStoreName: Record<string, number>;
  warehouses: StoreRow[];
  formatValue: (n: number) => string;
  onClose: () => void;
}

// Popup breakdown TOTAL stock/value semua toko (Stock Summary) — beda dari
// StoreBreakdownModal yang breakdown per 1 SKU. Ini menampilkan agregat
// seluruh item yang sedang tampil (menghormati filter aktif), dipicu dari
// tombol Show/Hide di panel "Stock Summary". Digerbang oleh permission
// stock_export di pemanggil (app/(main)/stock/page.tsx).
export function StockSummaryStoreModal({
  metricMode,
  totalsByStoreName,
  warehouses,
  formatValue,
  onClose,
}: StockSummaryStoreModalProps) {
  const total = warehouses.reduce((sum, wh) => sum + (totalsByStoreName[wh.name] || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {metricMode === "value" ? "Value" : "Stock"} per Toko
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-400">Ringkasan semua item sesuai filter aktif</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-5 py-4">
          {warehouses.map((wh) => {
            const v = totalsByStoreName[wh.name] || 0;
            return (
              <div key={wh.key} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                <span className="text-xs text-gray-700">{wh.name}</span>
                <span className={`text-xs font-semibold ${v > 0 ? "text-green-600" : "text-gray-300"}`}>
                  {metricMode === "value" ? formatValue(v) : `${v.toLocaleString("id-ID")} unit`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Total {metricMode === "value" ? "Value" : "Stock"}
            </p>
            <p className="text-xl font-bold text-primary">
              {metricMode === "value" ? formatValue(total) : `${total.toLocaleString("id-ID")} unit`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
