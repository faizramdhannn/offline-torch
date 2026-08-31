"use client";

import { X } from "lucide-react";

interface StoreRow {
  name: string;
  key: string;
}

interface StoreBreakdownModalProps {
  sku: string;
  itemName: string;
  toProperCase: (s: string) => string;
  /** Stock per warehouse untuk SKU ini, key = WAREHOUSES[].key. */
  stockByWarehouse: Record<string, string>;
  warehouses: StoreRow[];
  onClose: () => void;
}

// Popup breakdown stock per toko untuk 1 SKU — konsep sama seperti "Stock per
// Toko" di menu Bundling. Digerbang oleh permission `stock_export` di
// pemanggil (app/(main)/stock/page.tsx), bukan di komponen ini.
export function StoreBreakdownModal({
  sku,
  itemName,
  toProperCase,
  stockByWarehouse,
  warehouses,
  onClose,
}: StoreBreakdownModalProps) {
  const total = warehouses.reduce((sum, wh) => {
    const n = parseInt(String(stockByWarehouse[wh.key] ?? "").replace(/[^0-9-]/g, ""), 10);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Stock per Toko</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {sku} · {toProperCase(itemName)}
            </p>
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
            const stock = parseInt(String(stockByWarehouse[wh.key] ?? "").replace(/[^0-9-]/g, ""), 10) || 0;
            return (
              <div key={wh.key} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                <span className="text-xs text-gray-700">{wh.name}</span>
                <span className={`text-xs font-semibold ${stock > 0 ? "text-green-600" : "text-gray-300"}`}>
                  {stock} unit
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Total Stock</p>
            <p className="text-xl font-bold text-primary">{total} unit</p>
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
