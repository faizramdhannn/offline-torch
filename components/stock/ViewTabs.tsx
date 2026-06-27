"use client";

import { cn } from "@/lib/utils";

interface ViewTabItem {
  key: string;
  label: string;
}

interface ViewTabsProps {
  items: ViewTabItem[];
  active: string;
  onChange: (key: string) => void;
}

/** Segmented tab control used for "Select View" (Store / PCA / Master). */
export function ViewTabs({ items, active, onChange }: ViewTabsProps) {
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 sm:w-auto">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            "flex-shrink-0 rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
            active === item.key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}