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
  Archive,
  Camera,
  Map,
  ClipboardCheck,
  ListChecks,
  ClipboardList,
  LineChart,
  UserPlus,
  FileText,
  PackageMinus,
  Percent,
  BarChart3,
  DollarSign,
  Share2,
  Send,
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
  { label: "Capture Attendance", href: "/capture-attendance", icon: Camera, permissions: ["attendance_store"] },
  { label: "Cancel Order", href: "/request-store", icon: PackageSearch, permissions: ["request", "edit_request"] },
  { label: "Shipment", href: "/request-tracking", icon: Truck, permissions: ["request_tracking", "tracking_edit"] },
  { label: "Invoice", href: "/invoice", icon: FileText, permissions: ["invoice"] },
  { label: "Material Issue", href: "/material-issue", icon: PackageMinus, permissions: ["material_issue"] },
  { label: "Employee Discount", href: "/employee-discount", icon: Percent, permissions: ["employee_discount", "employee_discount_approval"] },
  { label: "Customer", href: "/customer", icon: Users, permissions: ["customer"] },
  { label: "Affiliate", href: "/affiliate", icon: Share2, permissions: ["affiliate_view"] },
  { label: "Jastiper", href: "/jastiper", icon: Send, permissions: ["jastiper"] },
  { label: "Order Report", href: "/order-report", icon: TrendingUp, permissions: ["order_report"] },
  { label: "Analytics Order", href: "/analytics-order", icon: BarChart3, permissions: ["analytics_order"] },
  { label: "Sales", href: "/sales", icon: DollarSign, permissions: ["sales_view", "sales_view_all"] },
  { label: "Voucher", href: "/voucher", icon: Boxes, permissions: ["voucher"] },
  { label: "Petty Cash", href: "/petty-cash", icon: Wallet, permissions: ["petty_cash"] },
  { label: "Stock", href: "/stock", icon: Package, permissions: ["stock"] },
  { label: "Stock Opname", href: "/stock-opname", icon: ClipboardList, permissions: ["stock_opname"] },
  { label: "Bundling", href: "/bundling", icon: Package, permissions: ["bundling"] },
  { label: "Asset", href: "/asset", icon: Archive, permissions: ["asset_store"] },
  { label: "Canvasing", href: "/canvasing", icon: Map, permissions: ["canvasing"] },
  { label: "Daily Job", href: "/daily-job/checklist", icon: ClipboardCheck, permissions: ["daily_checklist"] },
  { label: "Step ERP", href: "/step-erp", icon: ListChecks, permissions: ["step_erp"] },
  { label: "Survey Store", href: "/traffic-store", icon: LineChart, permissions: ["traffic_store"] },
  { label: "Registration", href: "/registration", icon: UserPlus, permissions: ["registration_request"] },
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
    // Grid cuma 3 kolom tetap (bukan viewport-based md:grid-cols-8) karena
    // sejak layout bento, kartu ini cuma ~1/3 lebar halaman di layar besar —
    // breakpoint berbasis viewport sebelumnya maksa 8 kolom di ruang sempit,
    // bikin tile-nya bertumpukan.
    <div className="grid grid-cols-4 gap-2">
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
            className="flex flex-col items-center gap-1 rounded-xl border border-white/40 bg-white/50 px-1.5 py-2.5 text-center shadow-sm backdrop-blur-sm transition-shadow duration-200 hover:shadow-lg hover:bg-white/70"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <action.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[9.5px] font-medium leading-tight text-gray-600">
              {action.label}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
