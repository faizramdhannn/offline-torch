"use client";

import { useSessionGuard } from "@/hooks/useSessionGuard";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { SectionHeader } from "@/components/shared/SectionHeader";
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
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="space-y-5 p-4">
        <SectionHeader
          icon={CalendarClock}
          title="Attendance"
          description={
            isStoreUser
              ? `Menampilkan data store: ${myStoreName}`
              : "Jadwal, input absensi, dan laporan kehadiran"
          }
          actions={
            <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />

        {activeTab === 'weekly'  && <WeeklySchedule  user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
        {activeTab === 'monthly' && <MonthlyReport   user={user} isStoreUser={isStoreUser} myStoreName={myStoreName} />}
        {activeTab === 'report'  && user.attendance_report && <FullReport user={user} />}
      </div>
    </div>
  );
}
