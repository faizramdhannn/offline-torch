// ─── File Icon ───────────────────────────────────────────────────────────────
// Distinctive PDF / slides icon, kept from the original asset page design —
// just dropped the unused `isDark` styling since the colors are fixed either way.

export function FileIcon({ url, size = 36 }: { url: string; size?: number }) {
  const isPresentation = url.includes("presentation") || url.includes("slides");

  if (isPresentation) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="8" fill="#f59e0b" />
        <rect x="8" y="10" width="32" height="24" rx="2" fill="white" fillOpacity="0.2" />
        <rect x="8" y="10" width="32" height="7" fill="white" fillOpacity="0.3" />
        <circle cx="24" cy="28" r="5" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="2" />
        <line x1="22" y1="38" x2="24" y2="34" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="26" y1="38" x2="24" y2="34" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#ef4444" />
      <rect x="10" y="8" width="20" height="28" rx="2" fill="white" fillOpacity="0.2" />
      <path d="M30 8l8 8h-8V8z" fill="white" fillOpacity="0.3" />
      <text x="11" y="42" fontSize="9" fontWeight="800" fill="white" fillOpacity="0.85" fontFamily="sans-serif">PDF</text>
      <rect x="14" y="18" width="12" height="2" rx="1" fill="white" fillOpacity="0.5" />
      <rect x="14" y="22" width="16" height="2" rx="1" fill="white" fillOpacity="0.4" />
    </svg>
  );
}
