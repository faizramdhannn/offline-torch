"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface SidebarContextType {
  isOpen: boolean;
  isCollapsed: boolean;
  toggleOpen: () => void;
  toggleCollapsed: () => void;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  isCollapsed: false,
  toggleOpen: () => {},
  toggleCollapsed: () => {},
  setOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // On mobile, default to closed
    const isMobile = window.innerWidth < 768;
    if (isMobile) setIsOpen(false);

    // Restore collapse preference
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setIsCollapsed(true);
  }, []);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider
      value={{ isOpen, isCollapsed, toggleOpen, toggleCollapsed, setOpen: setIsOpen }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);