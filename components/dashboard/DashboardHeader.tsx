"use client";

import { RefreshCw, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  dayLabel: string;
  dateLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

/**
 * Gradient hero banner at the top of the dashboard — brand gradient
 * (Icy Blue -> Gunmetal), decorative radial glows, greeting + date on the
 * left, refresh button on the right. Purely presentational — `onRefresh`
 * re-triggers the existing fetch* functions from the page.
 */
export function DashboardHeader({
  dayLabel,
  dateLabel,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl px-6 py-7 sm:px-8"
      style={{
        background: "linear-gradient(135deg, #35393C 0%, #1f4e63 45%, #0d7a8f 100%)",
      }}
    >
      {/* Decorative glow — cuma satu (bukan dua) dan blur lebih tipis, dua
          blur-3xl sebelumnya lumayan berat di-render bareng banyak kartu
          glass-card-elevated lain di halaman yang sama. */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, #A4D8FF 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
            <LayoutDashboard className="h-5 w-5 text-white" strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {greeting()}
            </h1>
            <p className="mt-0.5 text-sm text-white/70">
              {dayLabel}, {dateLabel}
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="flex h-9 items-center gap-1.5 self-start rounded-lg bg-white/15 px-3 text-sm font-medium text-white backdrop-blur-sm ring-1 ring-white/25 transition-colors hover:bg-white/25 sm:self-auto"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </motion.div>
  );
}
