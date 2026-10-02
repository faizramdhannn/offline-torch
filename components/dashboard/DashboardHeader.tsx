"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  dayLabel: string;
  dateLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

/**
 * Top header for the dashboard. Purely presentational — `onRefresh`
 * is expected to re-trigger the existing fetch* functions from the page.
 * No business logic lives here.
 */
export function DashboardHeader({
  dayLabel,
  dateLabel,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm">
          {dayLabel}, {dateLabel}
        </p>
      </div>

      <button
        onClick={onRefresh}
        className="glass-card flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 transition-colors hover:brightness-105"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}
