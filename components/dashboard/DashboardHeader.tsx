"use client";

import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  dayLabel: string;
  dateLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

/**
 * Top header for the dashboard. Purely presentational — `onRefresh`
 * is expected to re-trigger the existing fetch* functions from the
 * page, and `onSearchChange` only filters the Activity Log client-side.
 * No business logic lives here.
 */
export function DashboardHeader({
  dayLabel,
  dateLabel,
  onRefresh,
  isRefreshing = false,
  searchValue,
  onSearchChange,
}: DashboardHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {dayLabel}, {dateLabel}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari activity log..."
            className="h-9 w-44 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10 sm:w-56"
          />
        </div>

        <button
          onClick={onRefresh}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}