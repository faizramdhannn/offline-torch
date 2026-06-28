"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "positive" | "negative" | "info" | "warning";
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, { icon: string; value: string }> = {
  default: { icon: "bg-gray-100 text-gray-600", value: "text-gray-900" },
  positive: { icon: "bg-green-50 text-green-600", value: "text-green-600" },
  negative: { icon: "bg-red-50 text-red-600", value: "text-red-600" },
  info: { icon: "bg-blue-50 text-blue-600", value: "text-blue-600" },
  warning: { icon: "bg-orange-50 text-orange-600", value: "text-orange-600" },
};

export function StatCard({ icon: Icon, label, value, sublabel, tone = "default" }: StatCardProps) {
  const toneClass = TONE_CLASSES[tone];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", toneClass.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", toneClass.value)}>{value}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-gray-400">{sublabel}</p>}
    </div>
  );
}
