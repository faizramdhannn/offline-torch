"use client";

import { LayoutList, ChartBar } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrafficTab = "list" | "report";

export function ViewTabs({ active, onChange }: { active: TrafficTab; onChange: (v: TrafficTab) => void }) {
  const tabs: { key: TrafficTab; label: string; icon: typeof LayoutList }[] = [
    { key: "list", label: "Data List", icon: LayoutList },
    { key: "report", label: "Report", icon: ChartBar },
  ];
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
              isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
