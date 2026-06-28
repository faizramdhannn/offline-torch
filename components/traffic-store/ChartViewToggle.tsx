"use client";

import { cn } from "@/lib/utils";

export function ChartViewToggle({ view, onChange }: { view: "all" | "daily"; onChange: (v: "all" | "daily") => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
      {(["all", "daily"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-all duration-200",
            view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {v === "all" ? "All" : "Daily"}
        </button>
      ))}
    </div>
  );
}
