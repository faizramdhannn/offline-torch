"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

interface MIItem {
  id: string;
  name: string;
  user_name: string;
  item_sku: string;
  item_name: string;
  item_qty: string;
  item_hpj: string;
  request_by: string;
  request_number: string;
  status_request: string;
  issue_number: string;
  status_issue: string;
  type_reason: string;
  reason: string;
  has_processed: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  assigned_to: string;
}

export default function MaterialIssueDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [groupItems, setGroupItems] = useState<MIItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.material_issue && !u.material_issue_all) { router.push("/dashboard"); return; }
    setUser(u);
    fetchData(u);
  }, [id]);

  const fetchData = async (u: any) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/material-issue?userName=${encodeURIComponent(u?.user_name || "")}&isAll=${!!u?.material_issue_all}`
      );
      const rows: MIItem[] = await res.json();
      const matches = (Array.isArray(rows) ? rows : []).filter((r) => String(r.id) === String(id));
      setGroupItems(matches);
    } catch (error) {
      console.error("Failed to fetch material issue:", error);
      setGroupItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (groupItems.length === 0) return <DetailNotFound backHref="/material-issue" label="Material issue" />;

  const head = groupItems[0];
  const totalQty = groupItems.reduce((sum, g) => sum + (Number(g.item_qty) || 0), 0);

  return (
    <DetailShell
      title={`Material Issue #${head.request_number || head.id}`}
      subtitle="Detail Material Issue"
      backHref="/material-issue"
    >
      <DetailSection title="Informasi Request">
        <DetailField label="Assigned To" value={head.assigned_to} />
        <DetailField label="Request By" value={head.request_by} />
        <DetailField label="No. Request" value={head.request_number} />
        <DetailField label="Status Request" value={head.status_request} />
        <DetailField label="No. Issue" value={head.issue_number} />
        <DetailField label="Status Issue" value={head.status_issue} />
        <DetailField label="Type Reason" value={head.type_reason} />
        <DetailField label="Reason" value={head.reason} />
        <DetailField label="Sudah Diproses" value={head.has_processed === "TRUE" ? "Ya" : "Belum"} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Item ({totalQty} total qty)
        </label>
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">SKU</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Nama Item</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Qty</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">HPJ</th>
              </tr>
            </thead>
            <tbody>
              {groupItems.map((g, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1 font-mono">{g.item_sku}</td>
                  <td className="px-2 py-1">{g.item_name}</td>
                  <td className="px-2 py-1 text-right">{g.item_qty}</td>
                  <td className="px-2 py-1 text-right">{g.item_hpj}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Metadata">
        <DetailField label="Created By" value={head.created_by} />
        <DetailField label="Created At" value={head.created_at} />
        <DetailField label="Update By" value={head.update_by} />
        <DetailField label="Update At" value={head.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="material_issue" entityId={String(head.id)} />
    </DetailShell>
  );
}
