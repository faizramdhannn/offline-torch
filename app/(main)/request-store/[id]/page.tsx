"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import { CopyButton } from "@/components/request-tracking/DomainBadges";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

interface RequestItem {
  id: string;
  date: string;
  requester: string;
  assigned_to: string;
  reason_request: string;
  notes: string;
  status: string;
  created_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  sales_order?: string;
  delivery_note?: string;
  sales_invoice?: string;
  image_url?: string;
}

export default function RequestStoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<RequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, copyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(copyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedId(copyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.request) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/request-store");
      const result = await res.json();
      const list: RequestItem[] = Array.isArray(result) ? result : result.data || [];
      const found = list.find((r) => String(r.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch request:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/request-store" label="Request" />;

  const canEdit = !!user.edit_request;

  return (
    <DetailShell
      title={item.reason_request || `Request #${item.id}`}
      subtitle="Detail Request Store"
      backHref="/request-store"
      onEdit={canEdit ? () => router.push("/request-store") : undefined}
      editLabel="Kelola di List"
    >
      <DetailSection title="Informasi Request">
        <DetailField label="Tanggal" value={item.date} />
        <DetailField label="Requester" value={item.requester} />
        <DetailField label="Assigned To" value={item.assigned_to} />
        <DetailField label="Alasan" value={item.reason_request} />
        <DetailField label="Notes" value={item.notes} />
        <DetailField
          label="Status"
          value={
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              item.status === "Completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}>
              {item.status}
            </span>
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Dokumen">
        <DetailField
          label="Sales Order"
          value={
            item.sales_order ? (
              <span className="inline-flex items-center gap-1">
                {item.sales_order}
                <CopyButton text={item.sales_order} id="detail-so" copiedId={copiedId} onCopy={handleCopy} />
              </span>
            ) : undefined
          }
        />
        <DetailField
          label="Delivery Note"
          value={
            item.delivery_note ? (
              <span className="inline-flex items-center gap-1">
                {item.delivery_note}
                <CopyButton text={item.delivery_note} id="detail-dn" copiedId={copiedId} onCopy={handleCopy} />
              </span>
            ) : undefined
          }
        />
        <DetailField
          label="Sales Invoice"
          value={
            item.sales_invoice ? (
              <span className="inline-flex items-center gap-1">
                {item.sales_invoice}
                <CopyButton text={item.sales_invoice} id="detail-inv" copiedId={copiedId} onCopy={handleCopy} />
              </span>
            ) : undefined
          }
        />
        <DetailField
          label="Foto"
          value={
            item.image_url ? (
              <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Lihat foto
              </a>
            ) : "-"
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Metadata">
        <DetailField label="Created By" value={item.created_by} />
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update By" value={item.update_by} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="request_store" entityId={String(item.id)} />
    </DetailShell>
  );
}
