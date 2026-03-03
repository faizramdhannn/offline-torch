"use client";

import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebar } from "@/context/SidebarContext";

interface PageLayoutProps {
  userName: string;
  permissions: any;
  children: ReactNode;
}

export default function PageLayout({ userName, permissions, children }: PageLayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar userName={userName} permissions={permissions} />

      {/* Main content area */}
      <main
        className={`
          flex-1 overflow-auto
          transition-all duration-300
          min-w-0
        `}
      >
        {/* Mobile top padding for hamburger */}
        <div className="md:hidden h-12" />
        
        {children}
      </main>
    </div>
  );
}