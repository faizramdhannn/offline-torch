"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percent: number;
  done: number;
  total: number;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

function toneFor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 50) return "bg-primary";
  if (percent > 0) return "bg-orange-400";
  return "bg-gray-300";
}

export function ProgressBar({
  percent,
  done,
  total,
  size = "sm",
  showLabel = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-full bg-gray-100",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", toneFor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "shrink-0 tabular-nums font-medium text-gray-500",
            size === "sm" ? "text-[11px]" : "text-xs"
          )}
        >
          {clamped}%{" "}
          <span className="text-gray-400">
            ({done}/{total})
          </span>
        </span>
      )}
    </div>
  );
}
