"use client";

import { motion } from "framer-motion";
import {
  PackageSearch,
  Send,
  PackageCheck,
  Boxes,
  Warehouse,
  Truck,
  Gift,
  PackageMinus,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { STEP_ERP_TYPES } from "@/lib/stepErpConfig";
import { ProgressBar } from "./ProgressBar";

const TYPE_ICONS: Record<string, LucideIcon> = {
  material_request_store: PackageSearch,
  stock_entry_store: Send,
  end_transit_store: PackageCheck,
  allocation_pca: Boxes,
  material_request_warehouse: Warehouse,
  stock_entry_warehouse: Truck,
  material_request_issue: Gift,
  stock_entry_issue: PackageMinus,
};

export interface TypeStats {
  total: number;
  completed: number;
  avgPercent: number;
}

interface TypeGridProps {
  stats: Record<string, TypeStats | undefined>;
  loadingStats: boolean;
  onSelect: (key: string) => void;
}

export function TypeGrid({ stats, loadingStats, onSelect }: TypeGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {STEP_ERP_TYPES.map((type, i) => {
        const Icon = TYPE_ICONS[type.key] ?? PackageSearch;
        const s = stats[type.key];
        return (
          <motion.button
            key={type.key}
            onClick={() => onSelect(type.key)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.03 }}
            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-primary" />
            </div>

            <h3 className="mt-3 text-sm font-semibold text-gray-900">{type.label}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">{type.description}</p>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
                {type.steps.length} Steps
              </span>
              {!loadingStats && s && s.total > 0 && (
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
                  {s.total} Entri
                </span>
              )}
            </div>

            <div className="mt-3 border-t border-gray-100 pt-3">
              {loadingStats ? (
                <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-100" />
              ) : s && s.total > 0 ? (
                <ProgressBar percent={s.avgPercent} done={s.completed} total={s.total} size="sm" showLabel={false} />
              ) : (
                <p className="text-[11px] text-gray-300">Belum ada data</p>
              )}
              {!loadingStats && s && s.total > 0 && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Rata-rata {s.avgPercent}% · {s.completed} selesai
                </p>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
