"use client";

/**
 * Skeleton rows shown while canvasing data is loading.
 */
export function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
          <div className="h-5 w-10 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton cards shown while report/KPI data loads.
 */
export function KpiSkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
            <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-100" />
          </div>
          <div className="mt-3 h-7 w-12 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}