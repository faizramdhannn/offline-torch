"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AffiliateOrder } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

function formatRupiah(value: string | number): string {
  const number = parseInt(String(value).replace(/[^0-9]/g, "") || "0");
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);
}

export default function AffiliateOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<AffiliateOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (!parsed.affiliate_view) { router.push("/dashboard"); return; }
    setUser(parsed);
    fetchData();
  }, [uuid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/orders");
      const result = await res.json();
      const list: AffiliateOrder[] = Array.isArray(result) ? result : [];
      const found = list.find((o) => String(o.uuid) === String(uuid));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch affiliate order:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/affiliate" label="Order Affiliate" />;

  return (
    <DetailShell
      title={item.sales_order || `Order Affiliate #${item.uuid}`}
      subtitle="Detail Order Affiliate"
      backHref="/affiliate"
    >
      <DetailSection title="Informasi Order">
        <DetailField label="Kode Affiliate" value={item.affiliate_code} />
        <DetailField label="Store" value={item.store_name} />
        <DetailField label="Sales Order" value={item.sales_order} />
        <DetailField label="Tanggal" value={item.order_date} />
        <DetailField label="Value Order" value={formatRupiah(item.value_order)} />
        <DetailField label="Komisi" value={item.commission_rate} />
        <DetailField
          label="Status Redeem"
          value={
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              item.reedem_status === "Sudah Redeem" ? "bg-green-100 text-green-700"
              : item.reedem_status === "Diproses" ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-600"
            }`}>
              {item.reedem_status}
            </span>
          }
        />
        <DetailField label="Catatan" value={item.note} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Metadata">
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.sales_order, item.affiliate_code, String(item.uuid)]} />
    </DetailShell>
  );
}
