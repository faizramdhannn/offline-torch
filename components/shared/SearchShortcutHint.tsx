"use client";

// Badge kecil "⌘K"/"Ctrl K" ditaruh di dalam kolom search (pakai wrapper
// position:relative + padding-right di input-nya) — dipakai bareng
// hooks/useSearchShortcut supaya konsisten di semua halaman.
export function SearchShortcutHint({ label }: { label: string }) {
  return (
    <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
      {label}
    </kbd>
  );
}
