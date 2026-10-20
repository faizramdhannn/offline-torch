"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  // `origin` = titik klik (px) — peralihan tema membuka lingkaran dari titik itu.
  toggleTheme: (origin?: { x: number; y: number }) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    }
  }, []);

  const toggleTheme = (origin?: { x: number; y: number }) => {
    const next: Theme = theme === "light" ? "dark" : "light";
    const apply = () => {
      setTheme(next);
      try { localStorage.setItem("theme", next); } catch {}
      document.documentElement.classList.toggle("dark", next === "dark");
    };

    // Peralihan layar: View Transitions API (Chrome/Edge/Safari 18+). Tanpa dukungan / gerak dikurangi → langsung ganti.
    const doc = document as any;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce) { apply(); return; }

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = doc.startViewTransition(() => { flushSync(apply); });
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);