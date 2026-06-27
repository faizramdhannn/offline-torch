"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  Users,
  UserCheck,
  ClipboardList as Survey,
  Wallet,
  Package,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface QuickActionItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Adjust hrefs to match your actual routes — labels/icons follow the brief.
const ACTIONS: QuickActionItem[] = [
  { label: "Attendance", href: "/attendance", icon: UserCheck },
  { label: "Request", href: "/request", icon: ClipboardList },
  { label: "Customer", href: "/customer", icon: Users },
  { label: "Survey", href: "/survey", icon: Survey },
  { label: "Voucher", href: "/voucher", icon: ClipboardList },
  { label: "Petty Cash", href: "/petty-cash", icon: Wallet },
  { label: "Stock", href: "/stock", icon: Package },
  { label: "Bundling", href: "/bundling", icon: Package },
];

export function QuickAction() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-8">
      {ACTIONS.map((action, i) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.03 }}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200/80 bg-white px-3 py-4 text-center shadow-sm transition-shadow duration-200 hover:shadow-lg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <action.icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-[11px] font-medium text-gray-600">
              {action.label}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}