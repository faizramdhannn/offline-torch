"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { UserProvider, useUser } from "@/context/UserContext";

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  // Render layout immediately with user from localStorage.
  // If no user, render nothing (redirect will fire in useEffect).
  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar is mounted ONCE and never unmounts on page changes */}
      <Sidebar userName={user.name} permissions={user} />
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top padding for hamburger button */}
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