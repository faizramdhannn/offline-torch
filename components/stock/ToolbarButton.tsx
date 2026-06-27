"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
  loading?: boolean;
}

/**
 * Consistent pill-style action button for page toolbars
 * (Import Data, Export Stock, Refresh Javelin, Print Barcode, etc).
 */
export function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  variant = "default",
  loading = false,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-primary text-white hover:bg-primary/90"
          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {Icon && (
        <Icon className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      )}
      {label}
    </button>
  );
}