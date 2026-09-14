"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/useSortableTable";

interface SortableThProps {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
  className?: string;
  align?: "left" | "right" | "center";
}

// <th> yang bisa diklik untuk toggle sort asc/desc — dipakai konsisten di
// semua tabel list di app ini, dipasangkan dengan hooks/useSortableTable.
export function SortableTh({ label, active, dir, onClick, className, align = "left" }: SortableThProps) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap hover:bg-gray-100",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3 flex-none text-gray-500" />
          ) : (
            <ChevronDown className="h-3 w-3 flex-none text-gray-500" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 flex-none text-gray-300" />
        )}
      </span>
    </th>
  );
}
