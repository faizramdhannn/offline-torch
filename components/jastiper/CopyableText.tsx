"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Sama pola dengan SkuCell di components/stock/StockTable.tsx — teks +
// tombol copy (ikon SVG dari lucide-react) yang cuma muncul saat hover baris,
// dipakai untuk kolom Nama/Username/No HP/Kode di menu Jastiper supaya bisa
// disalin cepat tanpa select-manual.
export function CopyableText({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className={className}>-</span>;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <span className={`group inline-flex items-center gap-1 ${className || ""}`}>
      <span className="min-w-0 flex-1 truncate" title={value}>
        {value}
      </span>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy ${label || "text"}`}
        className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
        )}
      </button>
    </span>
  );
}
