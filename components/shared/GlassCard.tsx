"use client";

import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Padding = "none" | "sm" | "md" | "lg";

const PADDING_CLASSES: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: Padding;
}

/** Liquid Glass card surface — drop-in replacement for a flat `bg-white rounded-xl border` card. */
export function GlassCard({ children, padding = "md", className, ...props }: GlassCardProps) {
  return (
    <div className={cn("glass-card rounded-2xl", PADDING_CLASSES[padding], className)} {...props}>
      {children}
    </div>
  );
}
