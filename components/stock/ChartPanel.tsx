"use client";

import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartModeOption {
  key: string;
  label: string;
}

interface ChartPanelProps {
  title: string;
  totalLabel: string;
  totalValue: string;
  modes?: ChartModeOption[];
  activeMode?: string;
  onModeChange?: (key: string) => void;
  /** Second toggle group, rendered to the LEFT of `modes` (e.g. Qty/Value
   *  next to the existing Category/Grade or Store/Category toggle). */
  metricModes?: ChartModeOption[];
  activeMetricMode?: string;
  onMetricModeChange?: (key: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  legend?: ReactNode;
}

/**
 * Collapsible chart container used for both the Store and PCA chart
 * sections. Open/close + mode-switch state stay controlled by the
 * parent so existing state (storeChartOpen, chartMode, etc) is reused
 * as-is — this component is purely the shell around the chart.
 */
export function ChartPanel({
  title,
  totalLabel,
  totalValue,
  modes,
  activeMode,
  onModeChange,
  metricModes,
  activeMetricMode,
  onMetricModeChange,
  open,
  onOpenChange,
  children,
  legend,
}: ChartPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {totalLabel}: <span className="font-bold text-gray-800">{totalValue}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open && metricModes && metricModes.length > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5">
              {metricModes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => onMetricModeChange?.(m.key)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3",
                    activeMetricMode === m.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {open && modes && modes.length > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5">
              {modes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => onModeChange?.(m.key)}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium transition-colors sm:px-3",
                    activeMode === m.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => onOpenChange(!open)}
            title={open ? "Hide chart" : "Show chart"}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-200", !open && "-rotate-180")}
            />
          </button>
        </div>
      </div>

      {open && (
        <>
          {children}
          {legend && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{legend}</div>}
        </>
      )}
    </div>
  );
}