"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function StockOpnamePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock_opname) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
  }, []);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">🚧</div>
          <h1 className="text-3xl font-bold text-primary mb-3">Stock Opname</h1>
          <p className="text-gray-500 text-lg">This page is coming soon.</p>
          <p className="text-gray-400 text-sm mt-1">We're working on it. Stay tuned!</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-8 px-6 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}