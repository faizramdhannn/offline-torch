"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { UserProvider, useUser } from "@/context/UserContext";

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [user, router, mounted]);

  // Server dan client sama-sama render null dulu → tidak ada mismatch
  if (!mounted) return null;

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="md:hidden h-12" />
        {children}
      </main>
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