"use client";

import { useState } from "react";

export type ExportMode = "customers" | "orders";

interface ExportModalProps {
  onClose: () => void;
  onExport: (mode: ExportMode, from: string, to: string) => Promise<void>;
  exporting: boolean;
  filterSummary: string[]; // ringkasan filter yang sedang aktif di halaman
  totalCustomers: number; // jumlah customer yang lolos filter
}

export function ExportModal({ onClose, onExport, exporting, filterSummary, totalCustomers }: ExportModalProps) {
  const [mode, setMode] = useState<ExportMode>("customers");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const opt = (m: ExportMode, title: string, desc: string) => (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${mode === m ? "border-primary bg-primary/5" : "border-gray-200"}`}>
      <input type="radio" name="export-mode" className="mt-0.5" checked={mode === m} onChange={() => setMode(m)} />
      <span>
        <span className="block text-xs font-medium text-gray-800">{title}</span>
        <span className="block text-[11px] text-gray-500">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="modal-solid w-full max-w-md rounded-xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Export Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Tutup">✕</button>
        </div>

        <div className="mb-3 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-600">
          <p className="mb-1 font-medium text-gray-700">Mengikuti filter di halaman · {totalCustomers.toLocaleString("id-ID")} customer</p>
          {filterSummary.length > 0 ? (
            <ul className="flex flex-wrap gap-1">
              {filterSummary.map((f) => <li key={f} className="rounded bg-white px-1.5 py-0.5 text-gray-600 ring-1 ring-gray-200">{f}</li>)}
            </ul>
          ) : (
            <p className="text-gray-400">Tidak ada filter aktif — semua customer akan diexport.</p>
          )}
        </div>

        <div className="mb-3 space-y-2">
          {opt("customers", "Daftar customer", "Satu baris per customer: no. telepon, nama, toko, badge, jumlah order, total pcs, total nilai, pembelian pertama/terakhir.")}
          {opt("orders", "Detail order per item", "Semua order customer di atas, satu baris per item (SKU, qty, harga). Bisa dibatasi rentang tanggal.")}
        </div>

        {mode === "orders" && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">Dari Tanggal</label>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">Sampai Tanggal</label>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200">Batal</button>
          <button
            onClick={() => onExport(mode, from, to)}
            disabled={exporting || totalCustomers === 0}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? "Mengexport..." : "Export XLSX"}
          </button>
        </div>
      </div>
    </div>
  );
}
