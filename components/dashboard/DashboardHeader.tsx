"use client";

import { RefreshCw, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  dayLabel: string;
  dateLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
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
      <div className="flex items-center gap-3">
        <span className="glass-card-elevated flex h-11 w-11 items-center justify-center rounded-xl">
          <LayoutDashboard className="h-5 w-5 text-primary" strokeWidth={2.25} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {greeting()}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {dayLabel}, {dateLabel}
          </p>
        </div>
      </div>

      <button
        onClick={onRefresh}
        className="glass-card-elevated flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 transition-colors hover:brightness-105"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}
