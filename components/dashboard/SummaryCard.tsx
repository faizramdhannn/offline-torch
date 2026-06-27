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
  delay?: number;
}

const ACCENTS: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  red: { bg: "bg-red-50", text: "text-red-600" },
  gray: { bg: "bg-gray-100", text: "text-gray-600" },
};

/** Animated number that counts up from 0 to `value` once in view. */
function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  suffix = "",
  delay = 0,
}: SummaryCardProps) {
  const palette = ACCENTS[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className={cn("rounded-lg p-1.5", palette.bg)}>
          <Icon className={cn("h-4 w-4", palette.text)} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
        <CountUp value={value} suffix={suffix} />
      </div>
    </motion.div>
  );
}