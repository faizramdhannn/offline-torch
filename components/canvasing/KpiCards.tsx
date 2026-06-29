"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface KpiCard {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

interface KpiCardsProps {
  cards: KpiCard[];
}

/**
 * Row of 4 animated KPI summary cards at the top of the canvasing page.
 */
export function KpiCards({ cards }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              {card.label}
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.color}`}
            >
              <card.icon className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
            {card.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}