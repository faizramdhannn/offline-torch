"use client";

import { X } from "lucide-react";
import { DropZone } from "./DropZone";

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
          <DropZone label="ERP Stock Balance" file={erpFile} onFile={onErpFile} disabled={importing} />
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