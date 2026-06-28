"use client";

import { Search, X, RefreshCw, Download, SlidersHorizontal } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | "pending" | "completed";

interface ToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  resultCount?: number;
  showResultCount?: boolean;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onExport?: () => void;
}

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Selesai" },
];

/**
 * Toolbar above the shipment table: search, status filter pills, refresh
 * and export. Purely presentational — all handlers are passed in from the
 * page, which still owns search/filter state and the actual fetch/export logic.
 */
export function Toolbar({
  searchValue,
  onSearchChange,
  resultCount,
  showResultCount,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  refreshing,
  onExport,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari penerima, no. resi, atau sales order..."
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-8 text-xs text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
              title="Bersihkan pencarian"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          <SlidersHorizontal className="ml-1 h-3 w-3 text-gray-400" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onStatusFilterChange(opt.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                statusFilter === opt.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {showResultCount && (
          <span className="text-[11px] text-gray-400">
            {resultCount} hasil
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRefresh} loading={refreshing}>
            Refresh
          </Button>
        )}
        {onExport && (
          <Button variant="outline" size="sm" icon={Download} onClick={onExport}>
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
