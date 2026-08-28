"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import { STEP_ERP_TYPES, computeEntryProgress } from "@/lib/stepErpConfig";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

export default function StepErpDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [entry, setEntry] = useState<Record<string, any> | null>(null);
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.step_erp) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Entries are per-type sheets; search each type until we find this id.
      for (const t of STEP_ERP_TYPES) {
        const res = await fetch(`/api/step-erp?type=${t.key}`);
        const rows = await res.json();
        const found = (Array.isArray(rows) ? rows : []).find((r: any) => String(r.id) === String(id));
        if (found) {
          setEntry(found);
          setTypeKey(t.key);
          setLoading(false);
          return;
        }
      }
      setEntry(null);
    } catch (error) {
      console.error("Failed to fetch step-erp entry:", error);
      setEntry(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!entry) return <DetailNotFound backHref="/step-erp" label="Entry Step ERP" />;

  const typeDef = STEP_ERP_TYPES.find((t) => t.key === typeKey)!;
  const progress = computeEntryProgress(entry, typeDef);

  return (
    <DetailShell
      title={entry.erp_number || `Entry #${entry.id}`}
      subtitle={`Detail Step ERP — ${typeDef.label}`}
      backHref="/step-erp"
    >
      <DetailSection title="Informasi">
        <DetailField label="No. ERP" value={entry.erp_number} />
        <DetailField label="Store" value={entry.store} />
        <DetailField label="Tipe Proses" value={typeDef.label} />
        <DetailField label="Progress" value={`${progress.done}/${progress.total} (${progress.percent}%)`} />
        <DetailField label="Created By" value={entry.created_by} />
        <DetailField label="Created At" value={entry.created_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Checklist Step
        </label>
        <div className="space-y-1">
          {typeDef.steps.map((s) => {
            const done = entry[s.key] === "TRUE";
            return (
              <div key={s.key} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">
                  {s.label} <span className="text-gray-400">({s.owner})</span>
                </span>
                {done ? (
                  <span className="flex items-center gap-1 text-green-700 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Selesai
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400 font-semibold">
                    <X className="w-3.5 h-3.5" /> Belum
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[entry.erp_number, String(entry.id)]} />
    </DetailShell>
  );
}
