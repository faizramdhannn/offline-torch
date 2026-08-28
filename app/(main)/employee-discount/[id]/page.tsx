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

interface EDItem {
  id: string;
  name: string;
  assigned_to: string;
  user_name: string;
  taft_by: string;
  item_sku: string;
  item_name: string;
  item_qty: string;
  discount_code: string;
  status_request: string;
  type_reason: string;
  sales_order: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  link_drive: string;
}

export default function EmployeeDiscountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [groupItems, setGroupItems] = useState<EDItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.employee_discount && !u.employee_discount_approval) { router.push("/dashboard"); return; }
    setUser(u);
    fetchData(u);
  }, [id]);

  const fetchData = async (u: any) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/employee-discount?userName=${encodeURIComponent(u?.user_name || "")}&isAll=${!!u?.employee_discount_approval}`
      );
      const rows: EDItem[] = await res.json();
      const matches = (Array.isArray(rows) ? rows : []).filter((r) => String(r.id) === String(id));
      setGroupItems(matches);
    } catch (error) {
      console.error("Failed to fetch employee discount:", error);
      setGroupItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (groupItems.length === 0) return <DetailNotFound backHref="/employee-discount" label="Employee discount" />;

  const head = groupItems[0];
  const totalQty = groupItems.reduce((sum, g) => sum + (Number(g.item_qty) || 0), 0);

  return (
    <DetailShell
      title={head.name || `Employee Discount #${head.id}`}
      subtitle="Detail Employee Discount"
      backHref="/employee-discount"
    >
      <DetailSection title="Informasi Request">
        <DetailField label="Nama" value={head.name} />
        <DetailField label="Assigned To" value={head.assigned_to} />
        <DetailField label="Taft By" value={head.taft_by} />
        <DetailField label="Discount Code" value={head.discount_code} />
        <DetailField label="Type Reason" value={head.type_reason} />
        <DetailField label="Sales Order" value={head.sales_order} />
        <DetailField label="Status Request" value={head.status_request} />
        <DetailField
          label="Foto"
          value={
            head.link_drive ? (
              <a href={head.link_drive} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Lihat foto
              </a>
            ) : "-"
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Item ({totalQty} total qty)
        </label>
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-1.5 text-left">SKU</th>
                <th className="px-3 py-1.5 text-left">Nama Item</th>
                <th className="px-3 py-1.5 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {groupItems.map((g, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 font-mono">{g.item_sku}</td>
                  <td className="px-3 py-1.5">{g.item_name}</td>
                  <td className="px-3 py-1.5 text-right">{g.item_qty}</td>
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

      <ActivityHistory entityType="employee_discount" entityId={String(head.id)} />
    </DetailShell>
  );
}
