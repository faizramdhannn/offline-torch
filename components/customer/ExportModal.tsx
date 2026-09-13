"use client";

import { useState } from "react";

interface ExportModalProps {
  onClose: () => void;
  onExport: (from: string, to: string) => Promise<void>;
  exporting: boolean;
}

export function ExportModal({ onClose, onExport, exporting }: ExportModalProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Export Data Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <p className="mb-3 text-[11px] text-gray-400">
          Export data order Shopify lengkap (per item, sudah dinormalisasi) beserta badge customer,
          dalam format XLSX. Kosongkan tanggal untuk export semua data.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            onClick={() => onExport(from, to)}
            disabled={exporting}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? "Mengexport..." : "Export XLSX"}
          </button>
        </div>
      </div>
    </div>
  );
}
