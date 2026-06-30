"use client";

import { Camera, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceTab } from "./types";

const TABS: { key: AttendanceTab; label: string; icon: typeof Camera }[] = [
  { key: "capture", label: "Absen (Selfie)", icon: Camera },
  { key: "history", label: "Riwayat Absensi", icon: History },
];

export function AttendanceTabs({
  active,
  onChange,
}: {
  active: AttendanceTab;
  onChange: (tab: AttendanceTab) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
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