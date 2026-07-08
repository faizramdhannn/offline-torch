"use client";

import { LucideIcon, Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white border border-primary hover:bg-primary/90 shadow-sm",
  secondary: "bg-gray-100 text-gray-700 border border-gray-100 hover:bg-gray-200",
  outline: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300",
  danger: "bg-red-600 text-white border border-red-600 hover:bg-red-700 shadow-sm",
  ghost: "bg-transparent text-gray-500 border border-transparent hover:bg-gray-100 hover:text-gray-700",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-9 w-9 p-0 justify-center",
};

/**
 * Shared button primitive for the Request Shipment page redesign.
 * Visual-only — callers keep their own onClick / disabled / form logic.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center rounded-lg font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      ) : (
        Icon && <Icon className={size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      )}
      {size !== "icon" && children}
    </button>
  );
});
