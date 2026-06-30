"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StoreEntry } from "@/components/attendance/types";
import { WeeklySchedule } from "@/components/attendance/WeeklySchedule";
import { MonthlyReport } from "@/components/attendance/MonthlyReport";
import { FullReport } from "@/components/attendance/FullReport";

export default function AttendancePage() {
  const router = useRouter();
  const [user,        setUser]        = useState<any>(null);
  const [isStoreUser, setIsStoreUser] = useState(false);
  const [myStoreName, setMyStoreName] = useState('');
  const [activeTab,   setActiveTab]   = useState<'weekly'|'monthly'|'report'>('weekly');
  useSessionGuard();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.attendance) { router.push("/dashboard"); return; }
    setUser(parsed);

    fetch('/api/attendance/meta?type=store_list')
      .then(r => r.json())
      .then((stores: StoreEntry[]) => {
        const match = stores.find(
          s => s.store_name?.toLowerCase() === parsed.user_name?.toLowerCase()
        );
        if (match) {
          setIsStoreUser(true);
          setMyStoreName(match.store_name);
        }
      });
  }, []);

  if (!user) return null;

  const tabs = [
    { key: 'weekly',  label: 'Weekly'  },
    { key: 'monthly', label: 'Monthly' },
    ...(user.attendance_report ? [{ key: 'report', label: 'Report' }] : []),
  ] as { key: 'weekly'|'monthly'|'report'; label: string }[];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-primary">Attendance</h1>
              <div className="flex gap-0.5 bg-white rounded-lg p-0.5 shadow border border-gray-100">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-900 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'weekly'  && <WeeklySchedule  user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
            {activeTab === 'monthly' && <MonthlyReport   user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
            {activeTab === 'report'  && user.attendance_report && <FullReport user={user} />}
          </div>
        </div>
      </div>
    </div>
  );
}
