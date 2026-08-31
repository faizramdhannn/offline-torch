"use client";

import { X } from "lucide-react";
import { DropZone } from "./DropZone";

// Tanggal (yesterday→today, Asia/Jakarta) selalu dihitung ulang tiap render —
// TIDAK di-hardcode — supaya link laporan ERP selalu menunjuk ke rentang
// "kemarin ke hari ini" yang benar kapan pun modal ini dibuka.
function jakartaDateStr(offsetDays: number): string {
  const target = new Date(Date.now() + offsetDays * 86400000);
  return target.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // YYYY-MM-DD
}

function buildStockBalanceUrl(): string {
  const fromDate = jakartaDateStr(-1); // kemarin
  const toDate = jakartaDateStr(0); // hari ini
  return (
    `https://erp.luminae.id/app/query-report/Stock%20Balance` +
    `?company=MAHA+NAGARI+NUSANTARA&from_date=${fromDate}&to_date=${toDate}` +
    `&warehouse=%5B%22Torch+Jogja+-+T%22%2C%22Torch+Margonda+-+T%22%2C%22Torch+Purwokerto+-+T%22%2C%22Torch+Store+Lembong+-+T%22%2C%22Torch+Karawang+-+T%22%2C%22Torch+Lampung+-+T%22%2C%22Torch+Surabaya+-+T%22%2C%22Torch+Pekalongan+-+T%22%2C%22Torch+Store+Cirebon+-+T%22%2C%22Torch+Neka+Bogor+-+T%22%2C%22Torch+Neka+Ciputat+-+T%22%2C%22Torch+Neka+Condet+-+T%22%2C%22Torch+Neka+Meruyung+-+T%22%2C%22Torch+Gramedia+Botani+Square+-+T%22%2C%22Torch+Gramedia+Gajah+Mada+-+T%22%2C%22Torch+Gramedia+Pandanaran+-+T%22%2C%22Torch+Gramedia+Sam+Ratulangi+-+T%22%2C%22Vega+Toys+%26+Hobbies+-+T%22%2C%22Torch+Metro+Trans+Studio+Mall+Bandung+-+T%22%5D` +
    `&valuation_field_type=Currency`
  );
}

interface ImportModalProps {
  open: boolean;
  importing: boolean;
  erpFile: File | null;
  javelinFile: File | null;
  thresholdFile: File | null;
  onErpFile: (f: File | null) => void;
  onJavelinFile: (f: File | null) => void;
  onThresholdFile: (f: File | null) => void;
  onClose: () => void;
  onImport: () => void;
}

export function ImportModal({
  open,
  importing,
  erpFile,
  javelinFile,
  thresholdFile,
  onErpFile,
  onJavelinFile,
  onThresholdFile,
  onClose,
  onImport,
}: ImportModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Import Stock Data</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Upload file untuk ERP Stock Balance, Javelin, dan/atau Threshold. Format: CSV, XLSX, atau XLS.
        </p>

        <div className="space-y-4">
          <DropZone
            label="ERP Stock Balance"
            labelHref={buildStockBalanceUrl()}
            file={erpFile}
            onFile={onErpFile}
            disabled={importing}
          />
          <DropZone label="Javelin" file={javelinFile} onFile={onJavelinFile} disabled={importing} />
          <DropZone label="Threshold (PowerBI)" file={thresholdFile} onFile={onThresholdFile} disabled={importing} />
          {importing && (
            <div className="py-3 text-center text-sm text-gray-600">
              <div className="animate-pulse">Importing files... Please wait.</div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={importing}
            className="min-h-[44px] flex-1 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={importing || (!erpFile && !javelinFile && !thresholdFile)}
            className="min-h-[44px] flex-1 rounded-lg bg-primary text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}