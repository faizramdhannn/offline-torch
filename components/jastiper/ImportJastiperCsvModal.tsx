"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportJastiperCsvModalProps {
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  importing: boolean;
}

export function ImportJastiperCsvModal({ onClose, onImport, importing }: ImportJastiperCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Import Master Data Jastiper</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-100">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-green-800">{file.name}</p>
              <p className="text-[11px] text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              title="Hapus file"
              className="shrink-0 rounded-lg p-1.5 text-green-700 transition-colors hover:bg-green-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            className={cn(
              "flex select-none flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-8 transition-all duration-200 cursor-pointer",
              dragging ? "border-primary/50 bg-primary/5" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
            )}
          >
            <FileUp className={cn("h-6 w-6 transition-colors", dragging ? "text-primary" : "text-gray-400")} />
            <p className={cn("text-xs font-medium transition-colors", dragging ? "text-primary" : "text-gray-600")}>
              {dragging ? "Lepaskan file di sini" : "Drag & drop atau klik untuk pilih file"}
            </p>
            <p className="text-[11px] text-gray-400">
              CSV kolom: jastiper_name, jastiper_phone_number, jastiper_respond, jastiper_store, jastiper_code, jastiper_status
            </p>
          </div>
        )}

        <p className="mt-3 text-[11px] text-gray-400">
          Jastiper dengan nomor HP dan toko yang sama dengan data yang sudah ada akan dilewati
          (tidak akan terduplikasi).
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Batal
          </button>
          <button
            onClick={() => file && onImport(file)}
            disabled={!file || importing}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {importing ? "Mengimport..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
