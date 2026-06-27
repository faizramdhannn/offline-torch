"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  rangeLabel: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, rangeLabel }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row">
      <div className="text-xs text-gray-500">{rangeLabel}</div>
      <div className="flex flex-wrap justify-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1;
          if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "min-h-[32px] min-w-[32px] rounded-lg border px-1 text-xs font-medium transition-colors",
                  currentPage === page
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {page}
              </button>
            );
          } else if (page === currentPage - 2 || page === currentPage + 2) {
            return <span key={page} className="px-1 py-1.5 text-xs text-gray-400">…</span>;
          }
          return null;
        })}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}