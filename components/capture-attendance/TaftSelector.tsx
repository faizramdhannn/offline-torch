"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaftEntry } from "./types";

export function TaftSelector({
  tafts,
  selected,
  onToggle,
  label,
}: {
  tafts: TaftEntry[];
  selected: string[];
  onToggle: (name: string) => void;
  label: string;
}) {
  if (tafts.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</label>
        {selected.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {selected.length} dipilih
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {tafts.map((t) => {
          const checked = selected.includes(t.taft_name);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.taft_name)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                checked ? "border-primary bg-primary/5" : "border-gray-100 bg-gray-50 hover:bg-gray-100"
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  checked ? "border-primary bg-primary" : "border-gray-300 bg-white"
                )}
              >
                {checked && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className={cn("text-sm font-medium", checked ? "text-primary" : "text-gray-700")}>
                {t.taft_name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}