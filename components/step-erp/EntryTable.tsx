"use client";

import { motion } from "framer-motion";
import { ProgressBar } from "./ProgressBar";
import { computeEntryProgress, type StepErpTypeDef } from "@/lib/stepErpConfig";

interface EntryTableProps {
  entries: Record<string, any>[];
  typeDef: StepErpTypeDef;
  onRowClick: (entry: Record<string, any>) => void;
}

export function EntryTable({ entries, typeDef, onRowClick }: EntryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">ERP Number</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Store</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Dibuat</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500" style={{ minWidth: 170 }}>
              Progress
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, i) => {
            const { done, total, percent } = computeEntryProgress(entry, typeDef);
            return (
              <motion.tr
                key={entry.id ?? i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: Math.min(i, 10) * 0.02 }}
                onClick={() => onRowClick(entry)}
                className="cursor-pointer transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-800">{entry.erp_number}</td>
                <td className="px-4 py-3 text-gray-600">{entry.store}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-400">{entry.created_at}</td>
                <td className="px-4 py-3">
                  <ProgressBar percent={percent} done={done} total={total} size="sm" />
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
