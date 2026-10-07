"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import "../globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import AttendanceGateModal from "@/components/AttendanceGateModal";
import { useAttendanceGate } from "@/hooks/useAttendanceGate";
import DailyChecklistGateModal from "@/components/DailyChecklistGateModal";
import { useDailyChecklistGate } from "@/hooks/useDailyChecklistGate";
import { isProfileComplete } from "@/lib/profileRules";

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

  // Profil belum lengkap → wajib dilengkapi dulu (halaman lain diarahkan ke /profile).
  // Data lama di browser yang belum punya field profil (undefined) menunggu penyegaran dari server.
  const profileKnown = !!user && user.role !== undefined && user.email !== undefined;
  const profileIncomplete = profileKnown && !isProfileComplete(user);
  useEffect(() => {
    if (mounted && profileIncomplete && pathname !== "/profile") {
      // Redirect keras: banyak halaman memanggil router.replace sendiri saat mount (sinkron filter ke URL)
      // sehingga redirect lunak bisa tertimpa.
      window.location.replace("/profile?required=1");
    }
  }, [mounted, profileIncomplete, pathname, router]);

  useEffect(() => {
    if (mounted && !user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div className="flex h-screen page-bg overflow-hidden relative">
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
      `}</style>
      <div className={entering ? "ml-enter-sidebar" : ""}>
        <Sidebar userName={user.name} permissions={user} />
      </div>
      <main className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 ${entering ? "ml-enter-content" : ""}`}>
        <div className="md:hidden h-12" />
        <TopBar />
        {children}
      </main>

      {/* Attendance gate — only shown when user hasn't checked in yet */}
      {!profileIncomplete && showGate && storeName && (
        <AttendanceGateModal storeName={storeName} onDismiss={dismissGate} />
      )}

      {/* Daily Checklist gate — attendance gate takes priority. Wait until
          attendance's own check has FULLY resolved (attendanceChecked) before
          ever showing this, otherwise a faster daily-job-checklist fetch can
          flash this gate before attendance status is confirmed — showing the
          two gates in the wrong order. */}
      {!profileIncomplete && attendanceChecked && !showGate && showChecklistGate && (
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