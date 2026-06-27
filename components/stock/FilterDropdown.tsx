"use client";

import { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Multi-select checkbox dropdown used for Category / Grade / Warehouse
 * filters. Open/close state and click-outside handling stay owned by
 * the parent page (via `open`, `onOpenChange`, `containerRef`) so the
 * existing click-outside useEffect logic is untouched.
 */
export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  open,
  onOpenChange,
  containerRef,
}: FilterDropdownProps) {
  return (
    <div className="relative" ref={containerRef}>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <button
        onClick={() => onOpenChange(!open)}
        className="flex min-h-[36px] w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 outline-none transition-colors hover:border-gray-300 sm:py-1.5"
      >
        <span className="truncate text-gray-500">
          {selected.length === 0 ? "All" : `${selected.length} selected`}
        </span>
        <ChevronDown
          className={cn(
            "ml-1 h-3.5 w-3.5 flex-shrink-0 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Tidak ada opsi</p>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="mr-2 accent-primary"
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}