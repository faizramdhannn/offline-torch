"use client";

import { useRouter, usePathname } from "next/navigation";

interface SidebarProps {
  userName: string;
  permissions: {
    dashboard: boolean;
    order_report: boolean;
    stock: boolean;
    registration_request: boolean;
    user_setting: boolean;
    petty_cash?: boolean;
    customer?: boolean;
    voucher?: boolean;
    bundling?: boolean;
  };
}

export default function Sidebar({ userName, permissions }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", permission: "dashboard" },
    { name: "Order Report", path: "/order-report", permission: "order_report" },
    { name: "Stock", path: "/stock", permission: "stock" },
    { name: "Petty Cash", path: "/petty-cash", permission: "petty_cash" },
    { name: "Customer", path: "/customer", permission: "customer" },
    { name: "Voucher", path: "/voucher", permission: "voucher" },
    { name: "Bundling", path: "/bundling", permission: "bundling" },
    { name: "Registration Requests", path: "/registration", permission: "registration_request" },
    { name: "Settings", path: "/settings", permission: "user_setting" },
  ];

  return (
    <div className="w-48 bg-primary text-white h-screen flex flex-col text-sm">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-secondary font-bold text-lg">Offline Torch</h1>
        <p className="text-xs text-gray-300 mt-1">{userName}</p>
      </div>

      <nav className="flex-1 py-2">
        {menuItems.map((item) => {
          const hasPermission = permissions[item.permission as keyof typeof permissions];
          if (!hasPermission) return null;

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${
                pathname === item.path 
                  ? "bg-secondary/20 text-secondary" 
                  : "hover:bg-white/10"
              }`}
            >
              {item.name}
            </button>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="m-4 py-2 px-4 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
      >
        Logout
      </button>
    </div>
  );
}