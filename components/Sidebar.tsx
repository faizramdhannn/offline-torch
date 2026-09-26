"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useState, ReactNode, useRef, useEffect, useCallback } from "react";
import { useSidebar } from "@/context/SidebarContext";
import NotificationListener from "@/components/NotificationListener";
import { Clearance2CatalogPicker } from "@/components/canvasing/Clearance2CatalogPicker";

interface SidebarProps {
  userName: string;
  permissions: {
    dashboard: boolean;
    asset_store?: boolean;
    order_report: boolean;
    analytics_order?: boolean;
    stock: boolean;
    registration_request: boolean;
    user_setting: boolean;
    petty_cash?: boolean;
    customer?: boolean;
    voucher?: boolean;
    bundling?: boolean;
    canvasing?: boolean;
    stock_opname?: boolean;
    stock_opname_report?: boolean;
    request?: boolean;
    edit_request?: boolean;
    traffic_store?: boolean;
    report_store?: boolean;
    request_tracking?: boolean;
    tracking_edit?: boolean;
    attendance?: boolean;
    attendance_store?: boolean;       // ← NEW
    attendance_store_all?: boolean;   // ← NEW
    invoice?: boolean;
    material_issue?: boolean;
    material_issue_all?: boolean;
    sales_view?: boolean;
    sales_view_all?: boolean;
    step_erp?: boolean;
    employee_discount?: boolean;
    employee_discount_approval?: boolean;
    // Daily Job — menu entries/icon are wired in a follow-up frontend pass;
    // these fields exist here only so the interface stays valid for that pass.
    daily_checklist?: boolean;
    daily_checklist_all?: boolean;
    affiliate_view?: boolean;
    jastiper?: boolean;
  };
}

interface MenuItem {
  name: string;
  path: string;
  permission: string;
  icon: ReactNode;
}

export default function Sidebar({ userName, permissions }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [generatingCatalog, setGeneratingCatalog] = useState(false);
  const [generatingIhlsCatalog, setGeneratingIhlsCatalog] = useState(false);
  const [generatingClearanceCatalog, setGeneratingClearanceCatalog] = useState(false);
  const [generatingPasarayaCatalog, setGeneratingPasarayaCatalog] = useState(false);
  const [showClearance2Picker, setShowClearance2Picker] = useState(false);

  const initialGroup = (() => {
    if (
      pathname === "/request-store" ||
      pathname === "/request-tracking" ||
      pathname === "/invoice"
    )
      return "request";
    if (
      pathname === "/analytics-order" ||
      pathname === "/order-report" ||
      pathname === "/sales"
    )
      return "order";
    if (
      pathname.startsWith("/affiliate") ||
      pathname.startsWith("/customer") ||
      pathname.startsWith("/jastiper")
    )
      return "customer";
    return null;
  })();

  const [openGroup, setOpenGroup] = useState<"request" | "order" | "customer" | null>(
    initialGroup
  );

  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    const isRequestPath =
      pathname === "/request-store" ||
      pathname === "/request-tracking" ||
      pathname === "/invoice" ||
      pathname === "/material-issue";
    const isOrderPath =
      pathname === "/analytics-order" ||
      pathname === "/order-report" ||
      pathname === "/sales";
    const isCustomerPath =
      pathname.startsWith("/affiliate") ||
      pathname.startsWith("/customer") ||
      pathname.startsWith("/jastiper");

    const wasRequestPath =
      prev === "/request-store" ||
      prev === "/request-tracking" ||
      prev === "/invoice" ||
      prev === "/material-issue";
    const wasOrderPath =
      prev === "/analytics-order" ||
      prev === "/order-report" ||
      prev === "/sales";
    const wasCustomerPath =
      prev.startsWith("/affiliate") || prev.startsWith("/customer") || prev.startsWith("/jastiper");

    if (isRequestPath && !wasRequestPath) {
      setOpenGroup("request");
    } else if (isOrderPath && !wasOrderPath) {
      setOpenGroup("order");
    } else if (isCustomerPath && !wasCustomerPath) {
      setOpenGroup("customer");
    } else if (
      !isRequestPath &&
      !isOrderPath &&
      !isCustomerPath &&
      (wasRequestPath || wasOrderPath || wasCustomerPath)
    ) {
      setOpenGroup(null);
    }
  }, [pathname]);

  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const { isOpen, isCollapsed, toggleOpen, toggleCollapsed } = useSidebar();

  const handleToggleCollapsed = useCallback(() => {
    toggleCollapsed();
    const btn = collapseButtonRef.current;
    if (!btn) return;
    btn.classList.remove("jelly-btn");
    void btn.offsetWidth;
    btn.classList.add("jelly-btn");
    const onEnd = () => {
      btn.classList.remove("jelly-btn");
      btn.removeEventListener("animationend", onEnd);
    };
    btn.addEventListener("animationend", onEnd);
  }, [toggleCollapsed]);

  const loginName =
    typeof window !== "undefined"
      ? (() => {
          try {
            return (
              JSON.parse(localStorage.getItem("user") || "{}").user_name ||
              userName
            );
          } catch {
            return userName;
          }
        })()
      : userName;

  const jellyNavigate = useCallback(
    (path: string) => {
      const el = document.querySelector<HTMLElement>(
        `[data-navpath="${CSS.escape(path)}"]`
      );
      if (el) {
        el.classList.remove("menu-item-jelly");
        void el.offsetWidth;
        el.classList.add("menu-item-jelly");
        const onEnd = () => {
          el.classList.remove("menu-item-jelly");
          el.removeEventListener("animationend", onEnd);
        };
        el.addEventListener("animationend", onEnd);
      }
      setTimeout(() => {
        router.push(path);
        if (window.innerWidth < 768) toggleOpen();
      }, 160);
    },
    [router, toggleOpen]
  );

  const handleGenerateCatalog = async () => {
    setGeneratingCatalog(true);
    try {
      const response = await fetch("/api/canvasing/ecatalog/generate", {
        method: "POST",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Torch_E-Catalog_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to generate e-catalog");
      }
    } catch {
      alert("Failed to generate e-catalog");
    } finally {
      setGeneratingCatalog(false);
    }
  };

  const handleGenerateIhlsCatalog = async () => {
    setGeneratingIhlsCatalog(true);
    try {
      const response = await fetch("/api/canvasing/ecatalog-ihls/generate", {
        method: "POST",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `IHLS_E-Catalog_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to generate IHLS e-catalog");
      }
    } catch {
      alert("Failed to generate IHLS e-catalog");
    } finally {
      setGeneratingIhlsCatalog(false);
    }
  };

  const handleGenerateClearanceCatalog = async () => {
    setGeneratingClearanceCatalog(true);
    try {
      const response = await fetch("/api/canvasing/ecatalog-clearance/generate", {
        method: "POST",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Torch_E-Catalog_Clearance_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to generate clearance e-catalog");
      }
    } catch {
      alert("Failed to generate clearance e-catalog");
    } finally {
      setGeneratingClearanceCatalog(false);
    }
  };

  const handleGeneratePasarayaCatalog = async () => {
    setGeneratingPasarayaCatalog(true);
    try {
      const response = await fetch("/api/canvasing/ecatalog-pasaraya/generate", {
        method: "POST",
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Pasaraya_E-Catalog_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to generate Pasaraya e-catalog");
      }
    } catch {
      alert("Failed to generate Pasaraya e-catalog");
    } finally {
      setGeneratingPasarayaCatalog(false);
    }
  };

  const handleGenerateClearance2Catalog = () => {
    setShowClearance2Picker(true);
  };

  const hasRequestAccess = !!(permissions.request || permissions.edit_request);
  const hasTrackingAccess = !!(
    permissions.request_tracking || permissions.tracking_edit
  );
  const hasInvoiceAccess = !!permissions.invoice;
  const hasMaterialIssueAccess = !!permissions.material_issue;
  const hasEmployeeDiscountAccess =
    !!permissions.employee_discount || !!permissions.employee_discount_approval;
  const showRequestGroup =
    hasRequestAccess || hasTrackingAccess || hasInvoiceAccess || hasMaterialIssueAccess || hasEmployeeDiscountAccess;
  const isRequestActive =
    pathname === "/request-store" ||
    pathname === "/request-tracking" ||
    pathname === "/invoice" ||
    pathname === "/material-issue" ||
    pathname === "/employee-discount";

  const hasAffiliateAccess = !!permissions.affiliate_view;
  const hasCustomerSegAccess = !!permissions.customer;
  const hasJastiperAccess = !!permissions.jastiper;
  const showCustomerGroup = hasAffiliateAccess || hasCustomerSegAccess || hasJastiperAccess;
  const isCustomerGroupActive =
    pathname.startsWith("/affiliate") || pathname.startsWith("/customer") || pathname.startsWith("/jastiper");

  const hasAnalyticsAccess = !!permissions.analytics_order;
  const hasOrderReportAccess = !!permissions.order_report;
  const hasSalesAccess = !!(permissions.sales_view || permissions.sales_view_all);
  const showOrderGroup =
    hasAnalyticsAccess || hasOrderReportAccess || hasSalesAccess;
  const isOrderActive =
    pathname === "/analytics-order" ||
    pathname === "/order-report" ||
    pathname === "/sales";

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/dashboard",
      permission: "dashboard",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
     {
      name: "QR Code",
      path: "/qr-code",
      permission: "dashboard",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h6v6H4V4zm0 10h6v6H4v-6zm10-10h6v6h-6V4zm0 10h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z" />
        </svg>
      ),
    },
     {
      name: "Asset",
      path: "/asset",
      permission: "asset_store",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: "Attendance",
      path: "/attendance",
      permission: "attendance",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    // ── NEW: Capture Attendance ──────────────────────────────────────────────
    {
      name: "Capture Attendance",
      path: "/capture-attendance",
      permission: "attendance_store",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: "Bundling",
      path: "/bundling",
      permission: "bundling",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      name: "Canvasing",
      path: "/canvasing",
      permission: "canvasing",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      name: "Daily Job",
      path: "/daily-job/checklist",
      permission: "daily_checklist",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Petty Cash",
      path: "/petty-cash",
      permission: "petty_cash",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: "Step ERP",
      path: "/step-erp",
      permission: "step_erp",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 6l1.5 1.5L9 5M5 12l1.5 1.5L9 11M5 18l1.5 1.5L9 17M12 6h7M12 12h7M12 18h7" />
        </svg>
      ),
    },
    {
      name: "Stock",
      path: "/stock",
      permission: "stock",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      name: "Stock Opname",
      path: "/stock-opname",
      permission: "stock_opname",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Survey Store",
      path: "/traffic-store",
      permission: "traffic_store",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      name: "Voucher",
      path: "/voucher",
      permission: "voucher",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
    },
    {
      name: "Registration",
      path: "/registration",
      permission: "registration_request",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      path: "/settings",
      permission: "user_setting",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const requestGroupIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );

  const orderGroupIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const customerGroupIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );


  const checkPermission = (item: MenuItem): boolean => {
    if (item.permission === "traffic_store")
      return !!(permissions.traffic_store || permissions.report_store);
    if (item.permission === "attendance_store")
      return !!(permissions.attendance_store || permissions.attendance_store_all);
    if (item.permission === "daily_checklist")
      return !!(permissions.daily_checklist || permissions.daily_checklist_all);
    return !!permissions[item.permission as keyof typeof permissions];
  };

  const MenuButton = ({ item }: { item: MenuItem }) => {
    const isActive = pathname === item.path;
    return (
      <button
        data-navpath={item.path}
        onClick={() => jellyNavigate(item.path)}
        title={isCollapsed ? item.name : undefined}
        className={`
          menu-btn w-full flex items-center gap-3
          ${isCollapsed ? "justify-center px-0 py-2" : "px-3 py-2"}
          ${isActive ? "active text-gray-900" : "text-gray-500"}
        `}
      >
        <span className={`shrink-0 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-60"}`}>
          {item.icon}
        </span>
        {!isCollapsed && (
          <span className="text-[11px] tracking-wide truncate font-normal">
            {item.name}
          </span>
        )}
        {!isCollapsed && isActive && (
          <span className="ml-auto w-1 h-1 rounded-full bg-[#0d334d]/70 shrink-0" />
        )}
      </button>
    );
  };

  const CollapsedFlyout = ({
    groupIcon,
    label,
    items,
  }: {
    groupIcon: ReactNode;
    label: string;
    items: { path: string; label: string; icon: ReactNode; show: boolean; badge?: number }[];
  }) => {
    const isActive = items.some((i) => i.show && pathname === i.path);
    return (
      <div className="relative group">
        <button
          title={label}
          className={`menu-btn w-full flex items-center justify-center px-0 py-2 transition-colors ${isActive ? "active text-gray-900" : "text-gray-500"}`}
        >
          <span className={`shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`}>
            {groupIcon}
          </span>
        </button>
        <div
          className="absolute left-full top-0 ml-1.5 z-50 hidden group-hover:block submenu-pop"
          style={{ minWidth: "160px" }}
        >
          <div className="glass-panel rounded-lg shadow-xl overflow-hidden py-1">
            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {label}
            </p>
            {items.map(
              (sub) =>
                sub.show && (
                  <button
                    key={sub.path}
                    data-navpath={sub.path}
                    onClick={() => jellyNavigate(sub.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${pathname === sub.path ? "bg-black/5 text-gray-900" : "text-gray-600 hover:bg-black/5 hover:text-gray-900"}`}
                  >
                    <span className="shrink-0">{sub.icon}</span>
                    <span className="truncate min-w-0 flex-1 text-left">{sub.label}</span>
                    {typeof sub.badge === "number" && sub.badge > 0 && (
                      <span className="ml-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shrink-0">
                        {sub.badge > 9 ? "9+" : sub.badge}
                      </span>
                    )}
                  </button>
                )
            )}
          </div>
        </div>
      </div>
    );
  };

  const ExpandedGroup = ({
    groupIcon,
    label,
    isActive,
    isOpen: open,
    onToggle,
    items,
  }: {
    groupIcon: ReactNode;
    label: string;
    isActive: boolean;
    isOpen: boolean;
    onToggle: () => void;
    items: { path: string; label: string; icon: ReactNode; show: boolean; badge?: number }[];
  }) => {
    const prevOpenRef = useRef(open);
    const justOpened = open && !prevOpenRef.current;
    useEffect(() => {
      prevOpenRef.current = open;
    });

    return (
      <div>
        <button
          onClick={onToggle}
          className={`menu-btn w-full flex items-center gap-3 px-3 py-2 transition-colors ${isActive || open ? "text-gray-900" : "text-gray-500 hover:text-gray-900"} ${isActive ? "active" : ""}`}
        >
          <span className={`shrink-0 transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-60"}`}>
            {groupIcon}
          </span>
          <span className="text-[11px] tracking-wide truncate font-normal flex-1 text-left">
            {label}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {isActive && <span className="w-1 h-1 rounded-full bg-[#0d334d]/70" />}
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
        {open && (
          <div className={`overflow-hidden ${justOpened ? "submenu-enter" : ""}`}>
            <div className="bg-black/15 border-l-2 border-black/10 ml-4 mr-2 rounded-r-lg mb-0.5">
              {items.map(
                (sub) =>
                  sub.show && (
                    <button
                      key={sub.path}
                      data-navpath={sub.path}
                      onClick={() => jellyNavigate(sub.path)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors rounded-r-lg ${pathname === sub.path ? "bg-black/5 text-gray-900 font-medium" : "text-gray-500 hover:bg-black/5 hover:text-gray-900"}`}
                    >
                      <span className="shrink-0">{sub.icon}</span>
                      <span className="truncate min-w-0 flex-1 text-left">{sub.label}</span>
                      {typeof sub.badge === "number" && sub.badge > 0 && (
                        <span className="min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shrink-0">
                          {sub.badge > 9 ? "9+" : sub.badge}
                        </span>
                      )}
                      {pathname === sub.path && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                      )}
                    </button>
                  )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const cancelOrderIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
  const invoiceIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  const materialIssueIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h1a2 2 0 002-2v-3a2 2 0 00-2-2h-1m-16 0h1a2 2 0 012 2v3a2 2 0 01-2 2H4m16 0v1a2 2 0 01-2 2h-3a2 2 0 01-2-2v-1m6 0H9" />
    </svg>
  );
  const employeeDiscountIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5-.5h.01M14.5 14.5h.01M4 4h6.586a2 2 0 011.414.586l7.414 7.414a2 2 0 010 2.828l-6.586 6.586a2 2 0 01-2.828 0L2.586 14A2 2 0 012 12.586V6a2 2 0 012-2z" />
    </svg>
  );
  const shipmentIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  );
  const analyticsIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
  const reportIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  const salesIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

  const affiliateIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM1 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M17 8l2 2 4-4" />
    </svg>
  );
  const customerSegIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  const jastiperIcon = (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7h-3V5a3 3 0 00-3-3H10a3 3 0 00-3 3v2H4a1 1 0 00-1 1v10a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 5a1 1 0 011-1h4a1 1 0 011 1v2H9V5z" />
    </svg>
  );

  const customerItems = [
    { path: "/affiliate", label: "Affiliate", icon: affiliateIcon, show: hasAffiliateAccess },
    { path: "/customer", label: "Customer Segmentation", icon: customerSegIcon, show: hasCustomerSegAccess },
    { path: "/jastiper", label: "Jastiper", icon: jastiperIcon, show: hasJastiperAccess },
  ];

  const requestItems = [
    { path: "/request-store", label: "Cancel Order", icon: cancelOrderIcon, show: hasRequestAccess },
    { path: "/invoice", label: "Invoice", icon: invoiceIcon, show: hasInvoiceAccess },
    { path: "/material-issue", label: "Material Issue", icon: materialIssueIcon, show: hasMaterialIssueAccess },
    { path: "/employee-discount", label: "Employee Discount", icon: employeeDiscountIcon, show: hasEmployeeDiscountAccess },
    { path: "/request-tracking", label: "Shipment", icon: shipmentIcon, show: hasTrackingAccess },
  ];

  const orderItems = [
    { path: "/analytics-order", label: "Analytics", icon: analyticsIcon, show: hasAnalyticsAccess },
    { path: "/order-report", label: "Report", icon: reportIcon, show: hasOrderReportAccess },
    { path: "/sales", label: "Sales", icon: salesIcon, show: hasSalesAccess },
  ];



  return (
    <>
      <style>{`
        @keyframes menuJelly {
          0%   { transform: scale(1); }
          20%  { transform: scaleX(0.92) scaleY(1.06); }
          40%  { transform: scaleX(1.06) scaleY(0.95); }
          60%  { transform: scaleX(0.97) scaleY(1.02); }
          80%  { transform: scaleX(1.01) scaleY(0.99); }
          100% { transform: scale(1); }
        }
        .menu-item-jelly {
          animation: menuJelly 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }

        .menu-btn {
          position: relative;
          transition: color 0.18s ease, background-color 0.18s ease;
        }
        .menu-btn::before {
          content: '';
          position: absolute;
          inset: 2px 4px;
          border-radius: 8px;
          background: rgba(255,255,255,0);
          transition: background 0.18s ease;
          pointer-events: none;
        }
        .menu-btn:hover::before { background: rgba(13,51,77,0.06); }
        .menu-btn:hover { color: #111827; }
        .menu-btn.active::before { background: rgba(13,51,77,0.1); }
        .menu-btn.active {
          color: #111827;
          border-right: 2px solid rgba(13,51,77,0.8);
        }

        @keyframes jellyIn {
          0%   { transform: scaleY(0) scaleX(0.85); opacity: 0; transform-origin: top; }
          40%  { transform: scaleY(1.08) scaleX(0.97); opacity: 1; transform-origin: top; }
          65%  { transform: scaleY(0.97) scaleX(1.02); transform-origin: top; }
          80%  { transform: scaleY(1.02) scaleX(0.99); transform-origin: top; }
          90%  { transform: scaleY(0.99) scaleX(1.01); transform-origin: top; }
          100% { transform: scaleY(1) scaleX(1); opacity: 1; transform-origin: top; }
        }
        .submenu-enter {
          animation: jellyIn 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes jellyBtn {
          0%   { transform: scale(1); }
          15%  { transform: scale(0.72, 1.35) rotate(-4deg); }
          30%  { transform: scale(1.25, 0.78) rotate(3deg); }
          45%  { transform: scale(0.88, 1.18) rotate(-2deg); }
          60%  { transform: scale(1.12, 0.92) rotate(1deg); }
          75%  { transform: scale(0.96, 1.05) rotate(-0.5deg); }
          88%  { transform: scale(1.03, 0.98); }
          100% { transform: scale(1); }
        }
        .jelly-btn {
          animation: jellyBtn 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }

        @keyframes popIn {
          0%   { transform: translateX(-6px) scale(0.92); opacity: 0; }
          60%  { transform: translateX(3px) scale(1.03); opacity: 1; }
          80%  { transform: translateX(-1px) scale(0.99); }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
        .submenu-pop {
          animation: popIn 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }

        /* ── Liquid Glass — tint dari warna app-shell (Icy Blue #A4D8FF /
           Gunmetal #35393C), bukan putih generik, supaya sidebar menyatu
           dengan background di belakangnya. ── */
        .glass-sidebar {
          /* Neutral (no Icy Blue tint like .topbar-glass) — same transparency
             LEVEL as the top bar, just colorless glass instead of colored.
             TIDAK set position di sini — <aside> sudah punya "fixed
             md:relative" dari Tailwind (off-canvas di mobile, static di
             desktop); "position: relative" tanpa media-query di sini pernah
             menimpa .fixed di mobile (sama specificity, <style> ini render
             setelah stylesheet Tailwind) sehingga sidebar gagal off-canvas
             dan selalu memakan lebar layout walau ditranslate keluar layar. */
          background: rgba(255,255,255,0.22);
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 8px 32px rgba(15,23,42,0.1);
        }
        .glass-sidebar > * { position: relative; z-index: 1; }

        .glass-fab {
          background: linear-gradient(160deg, rgba(164,216,255,0.9) 0%, rgba(164,216,255,0.65) 100%);
          backdrop-filter: blur(18px) saturate(180%);
          -webkit-backdrop-filter: blur(18px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.75);
          box-shadow: 0 4px 16px rgba(15,23,42,0.15);
        }
        .glass-panel {
          background: linear-gradient(160deg, rgba(164,216,255,0.9) 0%, rgba(164,216,255,0.75) 100%);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.75) !important;
          box-shadow: 0 8px 24px rgba(15,23,42,0.15);
        }

        /* ── Dark mode: Gunmetal tint (bukan slate generik) so the
           (already-light, via globals.css) menu text stays readable.
           The earlier "sidebar looks different from the page" bug was a
           duplicate/conflicting html.dark .bg-gray-50 rule elsewhere in
           globals.css silently overriding the page's real background color
           (now fixed) — it was never the sidebar's own translucency, so it's
           safe to match .topbar-glass's alpha/blur here for one consistent
           transparency level across both surfaces. saturate() stays at 100%
           (not light mode's 180%) since Gunmetal's slight blue channel bias
           gets exaggerated by extra saturation boost. ── */
        html.dark .glass-sidebar {
          /* Neutral black glass (no Gunmetal tint), same transparency level. */
          background: rgba(0,0,0,0.32);
          backdrop-filter: blur(14px) saturate(100%);
          -webkit-backdrop-filter: blur(14px) saturate(100%);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        }
        html.dark .glass-fab {
          background: linear-gradient(160deg, rgba(60,65,68,0.94) 0%, rgba(53,57,60,0.9) 100%);
          backdrop-filter: blur(18px) saturate(100%);
          -webkit-backdrop-filter: blur(18px) saturate(100%);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        html.dark .glass-panel {
          background: linear-gradient(160deg, rgba(60,65,68,0.96) 0%, rgba(53,57,60,0.96) 100%);
          backdrop-filter: blur(24px) saturate(100%);
          -webkit-backdrop-filter: blur(24px) saturate(100%);
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        }
        html.dark .menu-btn:hover::before { background: rgba(255,255,255,0.08); }
        html.dark .menu-btn.active::before { background: rgba(255,255,255,0.14); }
        html.dark .menu-btn.active { border-right: 2px solid rgba(255,255,255,0.7); }
        html.dark .bg-black\/5 { background-color: rgba(255,255,255,0.08) !important; }

        /* Sidebar text: white regardless of the app-wide gray-scale dark
           overrides in globals.css (those are tuned for content cards, not
           this dark-glass sidebar — higher specificity here wins). */
        html.dark .glass-sidebar .text-gray-900,
        html.dark .glass-panel .text-gray-900 { color: #ffffff !important; }
        html.dark .glass-sidebar .text-gray-600,
        html.dark .glass-panel .text-gray-600 { color: rgba(255,255,255,0.75) !important; }
        html.dark .glass-sidebar .text-gray-500,
        html.dark .glass-panel .text-gray-500 { color: rgba(255,255,255,0.55) !important; }
        html.dark .glass-sidebar .text-gray-400,
        html.dark .glass-panel .text-gray-400 { color: rgba(255,255,255,0.4) !important; }
        html.dark .border-black\/10 { border-color: rgba(255,255,255,0.14) !important; }
      `}</style>

      {(permissions?.request ||
        permissions?.edit_request ||
        permissions?.request_tracking ||
        permissions?.tracking_edit) && (
        <NotificationListener username={loginName} />
      )}

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggleOpen}
        />
      )}

      <button
        onClick={toggleOpen}
        className={`fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] z-50 md:hidden w-9 h-9 flex items-center justify-center rounded-lg glass-fab text-gray-900 shadow-lg transition-all duration-200 ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <aside
        className={`
          fixed md:relative z-40 flex flex-col h-screen md:h-[calc(100vh-1.5rem)]
          md:my-3 md:ml-3 rounded-none md:rounded-2xl overflow-hidden
          glass-sidebar text-gray-900
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${isCollapsed ? "md:w-14" : "w-48"} shrink-0
        `}
      >
        {/* Header */}
        <div className={`border-b border-black/10 ${isCollapsed ? "p-2" : "p-3"} flex items-center justify-between`}>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <Image
                src="/logo_offline_torch.png"
                alt="Offline Torch"
                width={90}
                height={60}
                className="object-contain mx-auto"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-center truncate">
                {userName}
              </p>
            </div>
          )}
          {isCollapsed && (
            <div className="w-full flex justify-center py-1">
              <span className="text-xs font-bold text-gray-400 tracking-widest">OT</span>
            </div>
          )}
          <button
            ref={collapseButtonRef}
            onClick={handleToggleCollapsed}
            className={`hidden md:flex items-center justify-center w-6 h-6 rounded-md hover:bg-black/5 transition-colors shrink-0 ${isCollapsed ? "w-full mt-1" : "ml-1"}`}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={toggleOpen}
            className="md:hidden flex items-center justify-center w-7 h-7 rounded-md hover:bg-black/5 ml-1 shrink-0"
            aria-label="Close menu"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-1.5 pb-[env(safe-area-inset-bottom)] overflow-y-auto overflow-x-hidden">
          {checkPermission(menuItems[0]) && <MenuButton item={menuItems[0]} />}

          {/* QR Code, Asset, Attendance, Capture Attendance, Bundling, Canvasing */}
          {menuItems.slice(1, 7).map((item) =>
            checkPermission(item) ? <MenuButton key={item.path} item={item} /> : null
          )}

          {showCustomerGroup && (
            isCollapsed ? (
              <CollapsedFlyout groupIcon={customerGroupIcon} label="Customer" items={customerItems} />
            ) : (
              <ExpandedGroup
                groupIcon={customerGroupIcon}
                label="Customer"
                isActive={isCustomerGroupActive}
                isOpen={openGroup === "customer"}
                onToggle={() =>
                  setOpenGroup((prev) => (prev === "customer" ? null : "customer"))
                }
                items={customerItems}
              />
            )
          )}

          {showOrderGroup && (
            isCollapsed ? (
              <CollapsedFlyout groupIcon={orderGroupIcon} label="Order" items={orderItems} />
            ) : (
              <ExpandedGroup
                groupIcon={orderGroupIcon}
                label="Order"
                isActive={isOrderActive}
                isOpen={openGroup === "order"}
                onToggle={() =>
                  setOpenGroup((prev) => (prev === "order" ? null : "order"))
                }
                items={orderItems}
              />
            )
          )}

          {showRequestGroup && (
            isCollapsed ? (
              <CollapsedFlyout groupIcon={requestGroupIcon} label="Request" items={requestItems} />
            ) : (
              <ExpandedGroup
                groupIcon={requestGroupIcon}
                label="Request"
                isActive={isRequestActive}
                isOpen={openGroup === "request"}
                onToggle={() =>
                  setOpenGroup((prev) => (prev === "request" ? null : "request"))
                }
                items={requestItems}
              />
            )
          )}

          {/* Daily Job, Petty Cash, Step ERP, Stock, Stock Opname, Survey Store, Voucher, Registration, Settings */}
          {menuItems.slice(7).map((item) =>
            checkPermission(item) ? <MenuButton key={item.path} item={item} /> : null
          )}

          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGenerateCatalog}
              disabled={generatingCatalog}
              title={isCollapsed ? "E-Catalog" : undefined}
              className={`w-full flex items-center gap-3 transition-colors mt-1 text-gray-500 hover:text-gray-900 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}`}
            >
              <span className="shrink-0 opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {generatingCatalog ? "Generating..." : "E-Catalog"}
                </span>
              )}
            </button>
          )}

          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGenerateIhlsCatalog}
              disabled={generatingIhlsCatalog}
              title={isCollapsed ? "E-Catalog IHLS" : undefined}
              className={`w-full flex items-center gap-3 transition-colors mt-1 text-gray-500 hover:text-gray-900 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}`}
            >
              <span className="shrink-0 opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {generatingIhlsCatalog ? "Generating..." : "E-Catalog IHLS"}
                </span>
              )}
            </button>
          )}

          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGenerateClearanceCatalog}
              disabled={generatingClearanceCatalog}
              title={isCollapsed ? "E-Catalog Clearance" : undefined}
              className={`w-full flex items-center gap-3 transition-colors mt-1 text-gray-500 hover:text-gray-900 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}`}
            >
              <span className="shrink-0 opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {generatingClearanceCatalog ? "Generating..." : "E-Catalog Clearance"}
                </span>
              )}
            </button>
          )}

          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGeneratePasarayaCatalog}
              disabled={generatingPasarayaCatalog}
              title={isCollapsed ? "E-Catalog Pasaraya" : undefined}
              className={`w-full flex items-center gap-3 transition-colors mt-1 text-gray-500 hover:text-gray-900 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}`}
            >
              <span className="shrink-0 opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {generatingPasarayaCatalog ? "Generating..." : "E-Catalog Pasaraya"}
                </span>
              )}
            </button>
          )}

          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGenerateClearance2Catalog}
              title={isCollapsed ? "E-Catalog Clearance 2" : undefined}
              className={`w-full flex items-center gap-3 transition-colors mt-1 text-gray-500 hover:text-gray-900 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}`}
            >
              <span className="shrink-0 opacity-70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">E-Catalog Clearance 2</span>
              )}
            </button>
          )}

          {showClearance2Picker && (
            <Clearance2CatalogPicker onClose={() => setShowClearance2Picker(false)} />
          )}
        </nav>
      </aside>
    </>
  );
}