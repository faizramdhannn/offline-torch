"use client";

import { useEffect, useRef, useState } from "react";

// Cmd+K (Mac) / Ctrl+K (Windows/Linux) — fokus ke kolom search halaman dari
// mana saja, tanpa perlu klik. Dipakai di semua halaman yang punya kolom
// search filter list (Stock, Asset, Customer, dst) supaya perilakunya
// konsisten di seluruh app.
export function useSearchShortcut<T extends HTMLInputElement = HTMLInputElement>() {
  const ref = useRef<T>(null);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    if (/Mac/i.test(navigator.userAgent)) setShortcutLabel("⌘K");
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  return { ref, shortcutLabel };
}
