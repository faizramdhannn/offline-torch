"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HeroMascot } from "./HeroMascot";

interface DashboardHeaderProps {
  dayLabel: string;
  dateLabel: string;
  userName?: string;
  pendingTotal?: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function greeting(h: number): string {
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

// Jam WIB hidup (dihitung di browser; tidak memanggil server).
const wib = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...o }).format(d);

/** Banner "command center": jam WIB, sapaan personal, status sistem. Murni presentasi. */
export function DashboardHeader({ dayLabel, dateLabel, userName, pendingTotal, onRefresh, isRefreshing = false }: DashboardHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const hour = now ? Number(wib(now, { hour: "2-digit", hour12: false })) : 9;
  const first = (userName || "").trim().split(/\s+/)[0];

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="cc-hero mb-5 px-5 py-6 sm:px-8 sm:py-7">
      <div className="cc-hero-sweep" />
      <HeroMascot />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {greeting(hour)}{first ? `, ${first}` : ""}
          </h1>
          <p className="mt-1 text-sm text-white/60">{dayLabel}, {dateLabel}</p>
          {!!pendingTotal && (
            <div className="mt-4">
              <span className="cc-chip !border-amber-300/40 !text-amber-200">{pendingTotal} perlu tindakan</span>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end">
          <div className="text-left sm:text-right">
            <div className="cc-num text-4xl font-light leading-none tracking-tight text-white sm:text-5xl">
              {now ? wib(now, { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":") : "--:--"}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[.16em] text-white/50">WIB</div>
          </div>
          <button
            onClick={onRefresh}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-cyan-200/25 transition-colors hover:bg-white/20"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Sinkronkan</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
