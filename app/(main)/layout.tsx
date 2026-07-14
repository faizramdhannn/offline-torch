"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import "../globals.css";
import { UserProvider, useUser } from "@/context/UserContext";
import AttendanceGateModal from "@/components/AttendanceGateModal";
import { useAttendanceGate } from "@/hooks/useAttendanceGate";

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

  const { showGate, storeName, dismissGate } = useAttendanceGate();

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
      router.push("/login");
    }
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
      <main className={`flex-1 overflow-auto min-w-0 ${entering ? "ml-enter-content" : ""}`}>
        <div className="md:hidden h-12" />
        {children}
      </main>

      {/* Attendance gate — only shown when user hasn't checked in yet */}
      {showGate && storeName && (
        <AttendanceGateModal storeName={storeName} onDismiss={dismissGate} />
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