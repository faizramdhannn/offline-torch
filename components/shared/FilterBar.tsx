"use client";

import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Liquid Glass container for a row of filter controls (search, selects, date range, etc). */
export function FilterBar({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("glass-filterbar flex flex-wrap items-center gap-2 rounded-xl p-3", className)} {...props}>
      {children}
    </div>
  );
}
