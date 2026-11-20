"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "blue" | "green" | "orange" | "purple" | "red" | "gray";
  suffix?: string;
  hint?: string;
  /** 0–1: tampilkan cincin kemajuan di sisi kanan */
  progress?: number;
  delay?: number;
}

const ACCENTS: Record<string, { text: string; line: string; stroke: string }> = {
  blue: { text: "text-sky-600", line: "#0ea5e9", stroke: "#0ea5e9" },
  green: { text: "text-emerald-600", line: "#10b981", stroke: "#10b981" },
  orange: { text: "text-amber-600", line: "#f59e0b", stroke: "#f59e0b" },
  purple: { text: "text-violet-600", line: "#8b5cf6", stroke: "#8b5cf6" },
  red: { text: "text-rose-600", line: "#f43f5e", stroke: "#f43f5e" },
  gray: { text: "text-slate-500", line: "#64748b", stroke: "#64748b" },
};

/** Angka yang menghitung naik dari 0 sekali saat terlihat. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [isInView, value]);
  return <span ref={ref}>{display}</span>;
}

function Ring({ progress, stroke }: { progress: number; stroke: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="flex-none -rotate-90" aria-hidden>
      <circle cx="23" cy="23" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="4" />
      <motion.circle
        cx="23" cy="23" r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ filter: `drop-shadow(0 0 3px ${stroke}88)` }}
      />
    </svg>
  );
}

export function SummaryCard({ label, value, icon: Icon, accent = "blue", suffix = "", hint, progress, delay = 0 }: SummaryCardProps) {
  const a = ACCENTS[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      whileHover={{ y: -2 }}
      style={{ ["--cc-line" as string]: a.line }}
      className="cc-panel cc-kpi p-4 transition-shadow duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", a.text)} strokeWidth={2.25} />
            <span className="cc-label truncate">{label}</span>
          </div>
          <div className="cc-num mt-2.5 flex items-baseline gap-1 text-3xl font-semibold text-gray-900">
            <CountUp value={value} />
            {suffix && <span className="text-sm font-medium text-gray-400">{suffix}</span>}
          </div>
          {hint && <p className="mt-1 truncate text-[11px] text-gray-400">{hint}</p>}
        </div>
        {typeof progress === "number" && <Ring progress={progress} stroke={a.stroke} />}
      </div>
    </motion.div>
  );
}
