"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function StockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
  }, []);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Stock Management</h1>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">
              Stock management features will be implemented here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
