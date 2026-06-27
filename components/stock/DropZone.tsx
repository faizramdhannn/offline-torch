"use client";

import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  file: File | null;
  onFile: (f: File | null) => void;
  label: string;
  disabled?: boolean;
}

/** Drag & drop upload zone — same behavior as original, icons via lucide-react. */
export function DropZone({ file, onFile, label, disabled = false }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile, disabled]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);
  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null);
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : ""}>
      <p className="mb-2 text-sm font-semibold text-gray-700">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-green-200 bg-green-100">
            <FileSpreadsheet className="h-4.5 w-4.5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-green-800">{file.name}</p>
            <p className="text-[10px] text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            title="Hapus file"
            className="shrink-0 rounded-lg p-1.5 text-green-700 hover:bg-green-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex select-none flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 transition-all",
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
          )}
        >
          <UploadCloud
            className={cn("h-7 w-7 transition-colors", dragging ? "text-blue-500" : "text-gray-400")}
          />
          <p className={cn("text-xs font-medium transition-colors", dragging ? "text-blue-600" : "text-gray-600")}>
            {dragging ? "Lepaskan file di sini" : "Drag & drop atau klik untuk pilih"}
          </p>
          <p className="text-[10px] text-gray-400">CSV, XLSX, atau XLS</p>
        </div>
      )}
    </div>
  );
}