"use client";

export function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-10 animate-pulse rounded bg-gray-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
