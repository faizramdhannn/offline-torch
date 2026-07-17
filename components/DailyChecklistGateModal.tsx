"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface DailyChecklistGateModalProps {
  onDismiss: () => void;
}

/**
 * DailyChecklistGateModal — mirrors AttendanceGateModal's visual style, but
 * its CTA sends the user to /daily-job/checklist instead of
 * /capture-attendance.
 */
export default function DailyChecklistGateModal({ onDismiss }: DailyChecklistGateModalProps) {
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

  const handleGoChecklist = () => {
    onDismiss();
    router.push("/daily-job/checklist");
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
            Daily Checklist Diperlukan
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary, #6b7280)" }}>
            Isi <span className="font-semibold">Daily Checklist</span> hari ini sebelum mengakses menu lainnya.
          </p>
        </div>

        {/* Action */}
        <div className="px-5 py-4">
          <button
            onClick={handleGoChecklist}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" />
            </svg>
            Isi Daily Checklist
          </button>
        </div>
      </div>
    </div>
  );
}
