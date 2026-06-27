"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
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
  badge,
  toolbar,
  children,
  className,
  noPadding = false,
}: SectionCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-2xl border border-gray-200/80 bg-white shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
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