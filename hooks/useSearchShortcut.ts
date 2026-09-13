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
    const isMac = /Mac/i.test(navigator.userAgent);
    const handleShortcut = (e: KeyboardEvent) => {
      // e.code ("KeyK") targets the physical key regardless of keyboard
      // layout/IME, unlike e.key which can return a different character on
      // some layouts when a modifier is held — using it makes the match
      // precise. Also require exactly Cmd(Mac)/Ctrl(other) with no other
      // modifier and ignore key-repeat, so it never fires on Ctrl+Shift+K /
      // Ctrl+Alt+K (browser/OS shortcuts) or while the key is held down.
      const modifierOk = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (
        modifierOk &&
        !e.altKey &&
        !e.shiftKey &&
        !e.repeat &&
        (e.code === "KeyK" || e.key.toLowerCase() === "k")
      ) {
        // Capture phase + stopPropagation: Cmd+K/Ctrl+K is also a built-in
        // browser accelerator (focus the address bar) in some browsers —
        // preventDefault alone isn't always reliable against it, so we grab
        // the event as early as possible (window, capture: true) and stop
        // it from bubbling further, which is what makes this consistently
        // win over the browser's own shortcut.
        e.preventDefault();
        e.stopPropagation();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", handleShortcut, { capture: true });
    if (isMac) setShortcutLabel("⌘K");
    return () => window.removeEventListener("keydown", handleShortcut, { capture: true });
  }, []);

  return { ref, shortcutLabel };
}
