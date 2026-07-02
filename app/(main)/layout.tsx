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

  const { showGate, storeName, dismissGate } = useAttendanceGate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      <main className="flex-1 overflow-auto min-w-0">
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