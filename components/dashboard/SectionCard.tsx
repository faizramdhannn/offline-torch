"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type Accent = "blue" | "green" | "orange" | "purple" | "gray";

const ACCENTS: Record<Accent, { text: string; line: string }> = {
  blue: { text: "text-sky-600", line: "#0ea5e9" },
  green: { text: "text-emerald-600", line: "#10b981" },
  orange: { text: "text-amber-600", line: "#f59e0b" },
  purple: { text: "text-violet-600", line: "#8b5cf6" },
  gray: { text: "text-slate-500", line: "#64748b" },
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

/** Cangkang panel seragam untuk semua bagian dashboard (judul kapital kecil + garis aksen). */
export function SectionCard({ title, subtitle, icon: Icon, accent = "gray", badge, toolbar, children, className, noPadding = false }: SectionCardProps) {
  const a = ACCENTS[accent];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ ["--cc-line" as string]: a.line }}
      className={cn("cc-panel", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4", a.text)} strokeWidth={2.25} />}
          <h3 className="cc-label !text-[11px] !text-gray-700">{title}</h3>
          {subtitle && <span className="text-xs font-normal text-gray-400">{subtitle}</span>}
          {badge}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className={noPadding ? "" : "px-5 pb-5"}>{children}</div>
    </motion.section>
  );
}
