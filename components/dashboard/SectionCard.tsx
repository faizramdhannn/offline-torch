"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Accent = "blue" | "green" | "orange" | "purple" | "gray";

const ACCENTS: Record<Accent, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  gray: { bg: "bg-gray-100", text: "text-gray-600" },
};

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: Accent;
  badge?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

/**
 * Consistent card shell used to wrap every dashboard section
 * (Today's Shift, Store Location, Activity Log, etc).
 * Keeps header/toolbar layout identical across sections.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  accent = "gray",
  badge,
  toolbar,
  children,
  className,
  noPadding = false,
}: SectionCardProps) {
  const palette = ACCENTS[accent];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("glass-card-elevated rounded-2xl", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/40 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", palette.bg)}>
              <Icon className={cn("h-3.5 w-3.5", palette.text)} strokeWidth={2.25} />
            </span>
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <span className="text-xs font-normal text-gray-400">{subtitle}</span>
          )}
          {badge}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </motion.section>
  );
}
