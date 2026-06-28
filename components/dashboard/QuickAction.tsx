"use client";

import { motion } from "framer-motion";
import {
  UserCheck,
  PackageSearch,
  Truck,
  Users,
  TrendingUp,
  Wallet,
  Package,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@/context/UserContext";

interface QuickActionItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Permission key(s) on the user object — action is shown if the user has
   * ANY of these truthy. Mirrors the access logic in Sidebar.tsx exactly
   * (e.g. "Cancel Order" there is gated by `request || edit_request`).
   */
  permissions: string[];
}

// Routes verified against the real app router (app/(main)/*) and the same
// permission keys Sidebar.tsx uses, so a Quick Action is only shown — and
// only links somewhere real — when the user actually has access to it.
const ACTIONS: QuickActionItem[] = [
  { label: "Attendance", href: "/attendance", icon: UserCheck, permissions: ["attendance"] },
  { label: "Cancel Order", href: "/request-store", icon: PackageSearch, permissions: ["request", "edit_request"] },
  { label: "Shipment", href: "/request-tracking", icon: Truck, permissions: ["request_tracking", "tracking_edit"] },
  { label: "Customer", href: "/customer", icon: Users, permissions: ["customer"] },
  { label: "Order Report", href: "/order-report", icon: TrendingUp, permissions: ["order_report"] },
  { label: "Voucher", href: "/voucher", icon: Boxes, permissions: ["voucher"] },
  { label: "Petty Cash", href: "/petty-cash", icon: Wallet, permissions: ["petty_cash"] },
  { label: "Stock", href: "/stock", icon: Package, permissions: ["stock"] },
  { label: "Bundling", href: "/bundling", icon: Package, permissions: ["bundling"] },
];

export function QuickAction() {
  const { user } = useUser();

  const visibleActions = ACTIONS.filter((action) =>
    action.permissions.some((perm) => !!user?.[perm])
  );

  if (visibleActions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-gray-400">
        Tidak ada quick action yang tersedia untuk akun ini
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-8">
      {visibleActions.map((action, i) => (
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
