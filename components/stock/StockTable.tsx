"use client";

import { Copy, Check, ImageOff, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface StockItem {
  link_url?: string;
  image_url?: string;
  warehouse?: string;
  sku: string;
  stock: string;
  item_name: string;
  category: string;
  grade: string;
  hpp: string;
  hpt: string;
  hpj: string;
  discount?: string;
  threshold?: string;
}

interface StockTableProps {
  items: StockItem[];
  selectedView: "store" | "pca" | "master";
  showHpp: boolean;
  showHpt: boolean;
  showHpj: boolean;
  toProperCase: (s: string) => string;
  parseDiscount: (v: string | undefined | null) => number;
  parseHarga: (v: string | undefined | null) => number;
  formatRupiah: (v: number) => string;
  onRowClick: (item: StockItem) => void;
  /** Active sort column key (matches the keys used in SortableTh below), or null for unsorted. */
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  /** Called with the column key when its header is clicked. */
  onSort?: (column: string) => void;
}

const NO_IMAGE_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="28" height="28"%3E%3Crect fill="%23ddd" width="28" height="28"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="9"%3ENo%3C/text%3E%3C/svg%3E';

function SkuCell({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="group flex items-center gap-1">
      <span>{sku}</span>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy SKU"}
        className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-gray-200 group-hover:opacity-100"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
        )}
      </button>
    </div>
  );
}

function HpjCell({
  item,
  parseDiscount,
  parseHarga,
  formatRupiah,
}: {
  item: StockItem;
  parseDiscount: (v: string | undefined | null) => number;
  parseHarga: (v: string | undefined | null) => number;
  formatRupiah: (v: number) => string;
}) {
  const discountPct = parseDiscount(item.discount);
  const hpjVal = parseHarga(item.hpj);
  const hargaDiskon =
    discountPct > 0 && hpjVal > 0 ? Math.round(hpjVal * (1 - discountPct / 100)) : 0;

  if (!item.hpj) return <td className="px-3 py-2 text-gray-400">-</td>;

  if (discountPct > 0 && hargaDiskon > 0) {
    return (
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 line-through">{item.hpj}</span>
          <div className="flex items-center gap-1">
            <span className="rounded bg-red-500 px-1 text-[9px] font-bold text-white">
              -{discountPct}%
            </span>
            <span className="text-[10px] font-semibold text-gray-800">
              {formatRupiah(hargaDiskon)}
            </span>
          </div>
        </div>
      </td>
    );
  }
  return <td className="px-3 py-2">{item.hpj}</td>;
}

function ThresholdCell({ item }: { item: StockItem }) {
  const thresholdVal = parseInt(String(item.threshold ?? "").replace(/[^0-9]/g, "")) || 0;
  const stockVal = parseInt(String(item.stock ?? "").replace(/[^0-9-]/g, "")) || 0;

  if (!item.threshold && item.threshold !== "0") {
    return <td className="px-3 py-2 text-gray-300">-</td>;
  }
  const isBelow = thresholdVal > 0 && stockVal <= thresholdVal;
  return (
    <td className="px-3 py-2">
      <span
        className={cn(
          "inline-flex min-w-[24px] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
          isBelow ? "bg-red-100 text-red-700" : "text-gray-600"
        )}
      >
        {thresholdVal > 0 ? thresholdVal : "-"}
      </span>
    </td>
  );
}

function SortableTh({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: {
  label: string;
  column: string;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  className?: string;
}) {
  const isActive = sortColumn === column;
  return (
    <th
      onClick={() => onSort?.(column)}
      className={cn(
        "select-none px-3 py-2.5 text-left font-semibold text-gray-600",
        onSort && "cursor-pointer transition-colors hover:bg-gray-100",
        isActive && "text-gray-900",
        className
      )}
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {onSort && (
          isActive ? (
            sortDirection === "asc" ? (
              <ChevronUp className="h-3 w-3 text-primary" />
            ) : (
              <ChevronDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 text-gray-300" />
          )
        )}
      </span>
    </th>
  );
}

export function StockTable({
  items,
  selectedView,
  showHpp,
  showHpt,
  showHpj,
  toProperCase,
  parseDiscount,
  parseHarga,
  formatRupiah,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
}: StockTableProps) {
  const thProps = { sortColumn, sortDirection, onSort };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[11px]">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="border-b border-gray-100">
            <th className="w-9 px-3 py-2.5 text-left font-semibold text-gray-600">Img</th>
            <SortableTh label="SKU" column="sku" {...thProps} />
            <SortableTh label="Product Name" column="item_name" {...thProps} />
            <SortableTh label="Category" column="category" {...thProps} />
            <SortableTh label="Grade" column="grade" {...thProps} />
            {selectedView !== "master" && (
              <SortableTh label="Stock" column="stock" {...thProps} />
            )}
            {selectedView === "pca" && (
              <SortableTh label="Threshold" column="threshold" {...thProps} />
            )}
            {selectedView === "store" && (
              <SortableTh label="Warehouse" column="warehouse" {...thProps} />
            )}
            {showHpp && <SortableTh label="HPP" column="hpp" {...thProps} />}
            {showHpt && <SortableTh label="HPT" column="hpt" {...thProps} />}
            {showHpj && <SortableTh label="HPJ" column="hpj" {...thProps} />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={`${item.sku}-${item.warehouse ?? ""}-${index}`}
              onClick={() => onRowClick(item)}
              className={cn(
                "cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50 active:bg-gray-100",
                index % 2 === 1 && "bg-gray-50/40"
              )}
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {item.link_url || item.image_url ? (
                  <img
                    src={item.link_url || item.image_url}
                    alt={item.sku}
                    className="h-7 w-7 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = NO_IMAGE_FALLBACK;
                    }}
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-gray-400">
                    <ImageOff className="h-3.5 w-3.5" />
                  </div>
                )}
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <SkuCell sku={item.sku} />
              </td>
              <td className="max-w-[140px] px-3 py-2 sm:max-w-none">
                <span className="block truncate text-gray-700">{toProperCase(item.item_name)}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">{toProperCase(item.category)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">{toProperCase(item.grade)}</td>
              {selectedView !== "master" && (
                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-700">{item.stock}</td>
              )}
              {selectedView === "pca" && <ThresholdCell item={item} />}
              {selectedView === "store" && (
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{item.warehouse}</td>
              )}
              {showHpp && <td className="whitespace-nowrap px-3 py-2 text-gray-600">{item.hpp}</td>}
              {showHpt && <td className="whitespace-nowrap px-3 py-2 text-gray-600">{item.hpt}</td>}
              {showHpj && (
                <HpjCell
                  item={item}
                  parseDiscount={parseDiscount}
                  parseHarga={parseHarga}
                  formatRupiah={formatRupiah}
                />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}