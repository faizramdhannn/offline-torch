"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import "../globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import AttendanceGateModal from "@/components/AttendanceGateModal";
import { useAttendanceGate } from "@/hooks/useAttendanceGate";
import DailyChecklistGateModal from "@/components/DailyChecklistGateModal";
import { useDailyChecklistGate } from "@/hooks/useDailyChecklistGate";

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  // Hanya true sesaat setelah proses login sukses (ditandai login/page.tsx
  // lewat sessionStorage), untuk memicu animasi masuk satu kali: sidebar
  // meluncur dari kiri, konten dari kanan. Navigasi biasa antar halaman
  // tidak memicu animasi ini lagi.
  const [entering, setEntering] = useState(false);

  const { showGate, storeName, dismissGate, checked: attendanceChecked } = useAttendanceGate();
  // Checklist gate is only shown once the attendance gate isn't currently
  // blocking (attendance gate takes priority — see composition below).
  const { showGate: showChecklistGate, dismissGate: dismissChecklistGate } = useDailyChecklistGate();

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem("justLoggedIn") === "1") {
      sessionStorage.removeItem("justLoggedIn");
      setEntering(true);
      const t = setTimeout(() => setEntering(false), 700);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      <style>{`
        @keyframes mlEnterLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        @keyframes mlEnterRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .ml-enter-sidebar { animation: mlEnterLeft 0.45s cubic-bezier(.32,.72,.35,1) both; }
        .ml-enter-content { animation: mlEnterRight 0.45s cubic-bezier(.32,.72,.35,1) 0.12s both; }

        /* Blurred colour blobs spread down the full height of the sidebar —
           without these, the sidebar's frosted-glass backdrop-blur has
           nothing but flat colour behind it and looks plain instead of
           "glass". Sized/positioned so at least one sits behind the sidebar
           at any scroll position or collapsed width. */
        .ml-blob { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
        .ml-blob-1 { width: 420px; height: 420px; background: rgba(96,165,250,0.55); top: -140px; left: -140px; }
        .ml-blob-2 { width: 380px; height: 380px; background: rgba(167,139,250,0.5); top: 30%; left: -120px; }
        .ml-blob-3 { width: 400px; height: 400px; background: rgba(244,114,182,0.45); bottom: -140px; left: -100px; }
      `}</style>
      <div className="ml-blob ml-blob-1" />
      <div className="ml-blob ml-blob-2" />
      <div className="ml-blob ml-blob-3" />
      <div className={entering ? "ml-enter-sidebar" : ""}>
        <Sidebar userName={user.name} permissions={user} />
      </div>
      <main className={`flex-1 overflow-auto min-w-0 ${entering ? "ml-enter-content" : ""}`}>
        <div className="md:hidden h-12" />
        {children}
      </main>

      {/* Attendance gate — only shown when user hasn't checked in yet */}
      {showGate && storeName && (
        <AttendanceGateModal storeName={storeName} onDismiss={dismissGate} />
      )}

      {/* Daily Checklist gate — attendance gate takes priority. Wait until
          attendance's own check has FULLY resolved (attendanceChecked) before
          ever showing this, otherwise a faster daily-job-checklist fetch can
          flash this gate before attendance status is confirmed — showing the
          two gates in the wrong order. */}
      {attendanceChecked && !showGate && showChecklistGate && (
        <DailyChecklistGateModal onDismiss={dismissChecklistGate} />
      )}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </UserProvider>
  );
}