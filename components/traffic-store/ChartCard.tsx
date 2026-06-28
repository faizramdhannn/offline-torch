"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  children,
  className,
  span,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  span?: "full" | "half";
}) {
  return (
    <div className={cn(span === "half" ? "" : "col-span-2", className)}>
      {title && <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>}
      {children}
    </div>
  );
}
