"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useState, ReactNode } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "@/context/ThemeContext";
import NotificationListener from "@/components/NotificationListener";

interface SidebarProps {
  userName: string;
  permissions: {
    dashboard: boolean;
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
    request?: boolean;
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
  const { isOpen, isCollapsed, toggleOpen, toggleCollapsed } = useSidebar();
  const { isDark, toggleTheme } = useTheme();

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

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

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
    } catch (error) {
      alert("Failed to generate e-catalog");
    } finally {
      setGeneratingCatalog(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      name: "Dashboard",
      path: "/dashboard",
      permission: "dashboard",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: "Order Report",
      path: "/order-report",
      permission: "order_report",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: "Analytics Order",
      path: "/analytics-order",
      permission: "analytics_order",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: "Stock",
      path: "/stock",
      permission: "stock",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      name: "Petty Cash",
      path: "/petty-cash",
      permission: "petty_cash",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: "Customer",
      path: "/customer",
      permission: "customer",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: "Voucher",
      path: "/voucher",
      permission: "voucher",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
    },
    {
      name: "Bundling",
      path: "/bundling",
      permission: "bundling",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      name: "Canvasing",
      path: "/canvasing",
      permission: "canvasing",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      name: "Request",
      path: "/request-store",
      permission: "request",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      name: "Stock Opname",
      path: "/stock-opname",
      permission: "stock_opname",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Registration",
      path: "/registration",
      permission: "registration_request",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
    {
      name: "Settings",
      path: "/settings",
      permission: "user_setting",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const navigate = (path: string) => {
    router.push(path);
    if (window.innerWidth < 768) {
      toggleOpen();
    }
  };

  return (
    <>
      {/* NotificationListener */}
      {permissions?.request && (
        <NotificationListener username={loginName} />
      )}

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={toggleOpen}
        />
      )}

      {/* Mobile hamburger button */}
      <button
        onClick={toggleOpen}
        className={`
          fixed top-3 left-3 z-50 md:hidden
          w-9 h-9 flex items-center justify-center rounded-lg
          bg-primary text-white shadow-lg
          transition-all duration-200
          ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
        `}
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-40
          flex flex-col h-screen
          bg-primary text-white
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${isCollapsed ? "md:w-14" : "w-48"}
          shrink-0
        `}
      >
        {/* Header */}
        <div
          className={`border-b border-white/10 ${
            isCollapsed ? "p-2" : "p-3"
          } flex items-center justify-between`}
        >
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <Image
                src="/logo_offline_torch.png"
                alt="Offline Torch"
                width={90}
                height={60}
                className="object-contain mx-auto"
              />
              <p className="text-[10px] text-white/50 mt-1 text-center truncate">
                {userName}
              </p>
            </div>
          )}

          {isCollapsed && (
            <div className="w-full flex justify-center py-1">
              <span className="text-xs font-bold text-white/50 tracking-widest">
                OT
              </span>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            className={`
              hidden md:flex items-center justify-center
              w-6 h-6 rounded-md hover:bg-white/10
              transition-colors shrink-0
              ${isCollapsed ? "w-full mt-1" : "ml-1"}
            `}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`w-3.5 h-3.5 text-white/50 transition-transform ${
                isCollapsed ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7M18 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            onClick={toggleOpen}
            className="md:hidden flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/10 ml-1 shrink-0"
            aria-label="Close menu"
          >
            <svg
              className="w-4 h-4 text-white/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-1.5 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const hasPermission =
              permissions[item.permission as keyof typeof permissions];
            if (!hasPermission) return null;
            const isActive = pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.name : undefined}
                className={`
                  w-full flex items-center gap-3 transition-colors
                  ${
                    isCollapsed
                      ? "justify-center px-0 py-2.5"
                      : "px-4 py-2.5"
                  }
                  ${
                    isActive
                      ? "bg-white/15 text-white border-r-2 border-white"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  }
                `}
              >
                <span
                  className={`shrink-0 ${
                    isActive ? "opacity-100" : "opacity-70"
                  }`}
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-xs truncate font-normal">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}

          {/* E-Catalog — hanya tampil di halaman canvasing */}
          {permissions?.canvasing && pathname === "/canvasing" && (
            <button
              onClick={handleGenerateCatalog}
              disabled={generatingCatalog}
              title={isCollapsed ? "E-Catalog" : undefined}
              className={`
                w-full flex items-center gap-3 transition-colors mt-1
                text-white/60 hover:text-white hover:bg-white/8
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isCollapsed ? "justify-center px-0 py-2.5" : "px-4 py-2.5"}
              `}
            >
              <span className="shrink-0 opacity-70">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="text-xs truncate">
                  {generatingCatalog ? "Generating..." : "E-Catalog"}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Footer: dark mode + logout */}
        <div
          className={`border-t border-white/10 ${
            isCollapsed
              ? "p-2 flex flex-col gap-2"
              : "p-3 flex items-center gap-2"
          }`}
        >
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            className={`
              flex items-center justify-center rounded-lg
              text-white/60 hover:text-white
              bg-white/8 hover:bg-white/15
              transition-all duration-200
              ${isCollapsed ? "w-full h-8" : "w-8 h-8 shrink-0"}
            `}
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          {/* Logout */}
          {!isCollapsed ? (
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white rounded text-xs transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          ) : (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-full h-8 flex items-center justify-center text-white/60 hover:text-white bg-white/8 hover:bg-red-500/80 rounded-lg transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}