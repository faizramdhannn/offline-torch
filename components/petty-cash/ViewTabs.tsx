"use client";

import { LucideIcon, List, BarChart3, Wallet, History } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "report" | "balance" | "history";

interface ViewTabsProps {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
  showBalance: boolean;
  showHistory: boolean;
}

const TABS: { key: ViewMode; label: string; icon: LucideIcon }[] = [
  { key: "list", label: "List", icon: List },
  { key: "report", label: "Report", icon: BarChart3 },
  { key: "balance", label: "Balance", icon: Wallet },
  { key: "history", label: "History", icon: History },
];

export function ViewTabs({ active, onChange, showBalance, showHistory }: ViewTabsProps) {
  const visibleTabs = TABS.filter((t) => {
    if (t.key === "balance") return showBalance;
    if (t.key === "history") return showHistory;
    return true;
  });

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
      {visibleTabs.map((tab) => {
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
