"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "purple" | "pink" | "teal";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
  warning: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200",
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  neutral: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  purple: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
  pink: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200",
  teal: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
};

export function Badge({
  variant = "neutral",
  children,
  className,
  dot = false,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  /** Show a small status dot before the label. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}