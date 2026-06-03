"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface AttendanceGateModalProps {
  storeName: string;
  onDismiss: () => void;
}

export default function AttendanceGateModal({
  storeName,
  onDismiss,
}: AttendanceGateModalProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, []);

  const handleGoAbsen = () => {
    onDismiss();
    router.push("/capture-attendance");
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div
      className="fixed inset-0 z-[99] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xs rounded-2xl shadow-xl overflow-hidden"
        style={{ background: "var(--bg-card, #ffffff)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-color, #e5e7eb)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-secondary, #6b7280)" }}>
            {dateStr}
          </p>
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary, #111827)" }}>
            Absensi Diperlukan
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary, #6b7280)" }}>
            Lakukan absen <span className="font-semibold">OPEN</span> sebelum mengakses menu lainnya.
          </p>
        </div>

        {/* Store info */}
        <div className="px-5 py-3 flex items-center gap-2.5" style={{ background: "var(--hover-bg, #f9fafb)" }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: "var(--text-secondary, #6b7280)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-xs font-medium" style={{ color: "var(--text-primary, #111827)" }}>
            {storeName}
          </span>
        </div>

        {/* Action */}
        <div className="px-5 py-4">
          <button
            onClick={handleGoAbsen}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Absen Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}