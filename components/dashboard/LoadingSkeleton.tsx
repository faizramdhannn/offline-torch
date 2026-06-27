"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-100", className)}
    />
  );
}

export function CardSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="min-w-[160px] flex-shrink-0 rounded-xl border border-gray-100 p-3"
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-2.5 w-full" />
          <Skeleton className="mb-2 h-2.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}