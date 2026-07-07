"use client";

import { LucideIcon, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "positive" | "negative" | "info" | "warning";
  /** % change vs previous period, e.g. 12.4 or -5.2. Omit to hide the trend row. */
  delta?: number;
  /** Label for what delta is measured against, e.g. "vs 7 hari sebelumnya" */
  deltaLabel?: string;
  /** When true, a negative delta is shown as positive (green) — e.g. for "Tidak Beli" counts where less is better */
  invertDeltaTone?: boolean;
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, { icon: string; value: string }> = {
  default: { icon: "bg-gray-100 text-gray-600", value: "text-gray-900" },
  positive: { icon: "bg-green-50 text-green-600", value: "text-green-600" },
  negative: { icon: "bg-red-50 text-red-600", value: "text-red-600" },
  info: { icon: "bg-blue-50 text-blue-600", value: "text-blue-600" },
  warning: { icon: "bg-orange-50 text-orange-600", value: "text-orange-600" },
};

export function StatCard({
  icon: Icon, label, value, sublabel, tone = "default",
  delta, deltaLabel, invertDeltaTone = false,
}: StatCardProps) {
  const toneClass = TONE_CLASSES[tone];

  let deltaIsUp = typeof delta === "number" && delta > 0.05;
  let deltaIsDown = typeof delta === "number" && delta < -0.05;
  let deltaGood = invertDeltaTone ? deltaIsDown : deltaIsUp;
  let deltaBad = invertDeltaTone ? deltaIsUp : deltaIsDown;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", toneClass.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        {typeof delta === "number" && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              deltaGood && "bg-green-50 text-green-600",
              deltaBad && "bg-red-50 text-red-600",
              !deltaGood && !deltaBad && "bg-gray-50 text-gray-400"
            )}
            title={deltaLabel}
          >
            {deltaGood && !deltaBad ? <ArrowUp className="h-2.5 w-2.5" /> : deltaBad ? <ArrowDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", toneClass.value)}>{value}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-gray-400">{sublabel}</p>}
      {deltaLabel && typeof delta === "number" && (
        <p className="mt-0.5 text-[10px] text-gray-300">{deltaLabel}</p>
      )}
    </div>
  );
}