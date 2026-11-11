"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface PopoverLine { primary: string; secondary?: string }

// Sel tabel "N product ▾" / "N category ▾": klik membuka daftar rincian (seperti Shopify). Panel dirender lewat portal
// supaya tidak terpotong pembungkus tabel yang bisa digeser (overflow).
export function ItemsPopover({ label, title, lines }: { label: string; title: string; lines: PopoverLine[] }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rect) return;
    const close = () => setRect(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const onScroll = (e: Event) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [rect]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setRect((r) => (r ? null : btnRef.current?.getBoundingClientRect() ?? null))}
        aria-expanded={!!rect}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 ${rect ? "bg-gray-200" : ""}`}
      >
        {label}
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${rect ? "rotate-180" : ""}`} />
      </button>
      {rect &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setRect(null)} />
            <div
              ref={panelRef}
              role="dialog"
              aria-label={title}
              className="modal-solid fixed z-[61] w-80 max-w-[92vw] rounded-xl border border-gray-200 p-2 shadow-xl"
              style={{ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)) }}
            >
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
              <ul className="max-h-64 divide-y divide-gray-100 overflow-auto">
                {lines.map((l, i) => (
                  <li key={i} className="px-2 py-1.5 text-[11px]">
                    <span className="font-medium text-gray-800">{l.primary}</span>
                    {l.secondary && <span className="ml-1.5 text-gray-400">{l.secondary}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
