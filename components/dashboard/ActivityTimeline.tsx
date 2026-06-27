"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
}

interface ActivityTimelineProps {
  logs: ActivityLog[];
}

const METHOD_DOT: Record<string, string> = {
  POST: "bg-green-500",
  PUT: "bg-blue-500",
  DELETE: "bg-red-500",
};

const METHOD_BADGE: Record<string, string> = {
  POST: "bg-green-100 text-green-700",
  PUT: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

export function ActivityTimeline({ logs }: ActivityTimelineProps) {
  return (
    <ol className="relative">
      {logs.map((log, index) => (
        <motion.li
          key={log.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="relative pb-5 pl-6 last:pb-0"
        >
          {/* vertical line */}
          {index !== logs.length - 1 && (
            <span className="absolute left-[5px] top-3 h-full w-px bg-gray-100" />
          )}
          {/* dot */}
          <span
            className={cn(
              "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
              METHOD_DOT[log.method] || "bg-gray-400"
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-800">
              {log.user}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                METHOD_BADGE[log.method] || "bg-gray-100 text-gray-700"
              )}
            >
              {log.method}
            </span>
            <span className="text-[11px] text-gray-400">{log.timestamp}</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-600">{log.activity_log}</p>
        </motion.li>
      ))}
    </ol>
  );
}