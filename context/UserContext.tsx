"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface UserContextType {
  user: any | null;
  setUser: (u: any) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  // Initialize directly from localStorage — no async, no flicker
  const [user, setUserState] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const router = useRouter();

  // Sesi dicabut/kedaluwarsa di server (401 dari /api/*) → langsung ke halaman login,
  // tidak menunggu pengecekan berkala. /api/auth/login dikecualikan (401 = password salah).
  useEffect(() => {
    const w = window as any;
    if (w.__fetch401Patched) return;
    w.__fetch401Patched = true;
    const original = window.fetch.bind(window);
    // Setelah user mengubah data di 4 menu "request", segarkan angka pending di sidebar (digabung 1,2 detik).
    const PENDING_APIS = ["/api/request-store", "/api/request-tracking", "/api/material-issue", "/api/employee-discount"];
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      try {
        const init = args[1];
        const input0 = args[0];
        const method = String(init?.method || (input0 instanceof Request ? input0.method : "GET")).toUpperCase();
        if (res.ok && method !== "GET") {
          const u = typeof input0 === "string" ? input0 : input0 instanceof URL ? input0.pathname : (input0 as Request).url;
          const pth = u.startsWith("http") ? new URL(u).pathname : u;
          if (PENDING_APIS.some((a) => pth.startsWith(a))) {
            if (pendingTimer) clearTimeout(pendingTimer);
            pendingTimer = setTimeout(() => window.dispatchEvent(new Event("pending:refresh")), 1200);
          }
        }
      } catch {}
      if (res.status === 401) {
        const input = args[0];
        const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : (input as Request).url;
        const path = url.startsWith("http") ? new URL(url).pathname : url;
        if (path.startsWith("/api/") && !path.startsWith("/api/auth/login") && !window.location.pathname.startsWith("/login")) {
          try { localStorage.removeItem("user"); } catch {}
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?reason=session_expired&next=${next}`;
        }
      }
      return res;
    };
  }, []);

  const setUser = (u: any) => {
    setUserState(u);
  };

  const logout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("user");
    setUserState(null);
    router.push("/login");
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);