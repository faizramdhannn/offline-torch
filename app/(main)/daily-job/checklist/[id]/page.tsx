"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

interface ChecklistRow {
  id: string;
  created_at: string;
  update_at: string;
  taft_by: string;
  role_taft: string;
  name: string;
  checklist_opening: string;
  checklist_operational: string;
  checklist_closing: string;
}

const CATEGORIES = [
  { key: "checklist_opening", label: "Opening Store" },
  { key: "checklist_operational", label: "Operational Store" },
  { key: "checklist_closing", label: "Closing Store" },
] as const;

function parseItems(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function ChecklistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<ChecklistRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.daily_checklist && !u.daily_checklist_all) { router.push("/dashboard"); return; }
    setUser(u);
    fetchData(u);
  }, [id]);

  const fetchData = async (u: any) => {
    setLoading(true);
    try {
      const url = `/api/daily-job/checklist?all=true&userName=${encodeURIComponent(u.user_name || "")}&name=${encodeURIComponent(u.name || "")}`;
      const res = await fetch(url);
      const rows: ChecklistRow[] = await res.json();
      const found = (Array.isArray(rows) ? rows : []).find((r) => String(r.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch checklist:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/daily-job/checklist" label="Checklist" />;

  return (
    <DetailShell
      title={item.name}
      subtitle="Detail Daily Checklist"
      backHref="/daily-job/checklist"
    >
      <DetailSection title="Informasi">
        <DetailField label="Nama" value={item.name} />
        <DetailField label="Taft By" value={item.taft_by} />
        <DetailField label="Role" value={item.role_taft} />
        <DetailField label="Tanggal" value={item.created_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      {CATEGORIES.map((c) => {
        const items = parseItems(item[c.key]);
        return (
          <div key={c.key}>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {c.label}
            </label>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Tidak ada item.</p>
            ) : (
              <div className="space-y-1">
                {items.map((it) => (
                  <div key={it} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-700">{it}</span>
                    <span className="flex items-center gap-1 text-green-700 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Selesai
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.name, String(item.id)]} />
    </DetailShell>
  );
}
