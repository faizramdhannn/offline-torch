"use client";

import { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  placeholder?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  open,
  onOpenChange,
  containerRef,
  placeholder = "Select...",
}: MultiSelectDropdownProps) {
  const allSelected = selected.length === options.length && options.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-white"
      >
        <span className={cn("truncate", selected.length === 0 && "text-gray-400")}>
          {selected.length === 0 ? placeholder : `${selected.length} dipilih`}
        </span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            Select All
          </label>
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
