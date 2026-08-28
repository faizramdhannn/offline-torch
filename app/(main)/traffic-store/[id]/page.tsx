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

interface TrafficEntry {
  id: string;
  date: string;
  store_location: string;
  taft_name: string;
  customer_convert: string;
  traffic_source: string;
  wag_addition: string;
  eiger_addition: string;
  organic_addition: string;
  brand_competitor: string;
  intention: string;
  case: string;
  notes: string;
  sales_order: string;
  created_at: string;
  update_at: string;
  value_order?: string;
  discount_code?: string;
  customer_segment?: string;
  product_category?: string;
  product_detail?: string;
  reason_not_buy?: string;
  budget_range?: string;
  alt_purchase_channel?: string;
  reason_buy?: string;
  phone_number?: string;
}

export default function TrafficStoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<TrafficEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.traffic_store && !parsed.report_store) { router.push("/dashboard"); return; }
    setUser(parsed);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/traffic-store");
      const result = await res.json();
      const list: TrafficEntry[] = Array.isArray(result) ? result : [];
      const found = list.find((r) => String(r.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch traffic entry:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/traffic-store" label="Data traffic" />;

  const canEdit = !!user.traffic_store;

  return (
    <DetailShell
      title={item.taft_name}
      subtitle="Detail Traffic Store"
      backHref="/traffic-store"
      onEdit={canEdit ? () => router.push("/traffic-store") : undefined}
      editLabel="Kelola di List"
    >
      <DetailSection title="Informasi Traffic">
        <DetailField label="Tanggal" value={item.date} />
        <DetailField label="Store" value={item.store_location} />
        <DetailField label="Nama (Taft)" value={item.taft_name} />
        <DetailField label="Customer Convert" value={item.customer_convert} />
        <DetailField label="Traffic Source" value={item.traffic_source} />
        <DetailField label="WAG Addition" value={item.wag_addition} />
        <DetailField label="Eiger Referral Addition" value={item.eiger_addition} />
        <DetailField label="Organic Addition" value={item.organic_addition} />
        <DetailField label="Brand Kompetitor" value={item.brand_competitor} />
        <DetailField label="Intensi" value={item.intention} />
        <DetailField label="Case" value={item.case} />
        <DetailField label="Notes" value={item.notes} />
        <DetailField label="Sales Order" value={item.sales_order} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Survey Tambahan">
        <DetailField label="Customer Segment" value={item.customer_segment} />
        <DetailField label="Kategori Produk" value={item.product_category} />
        <DetailField label="Detail Produk" value={item.product_detail} />
        <DetailField label="Alasan Tidak Beli" value={item.reason_not_buy} />
        <DetailField label="Budget Range" value={item.budget_range} />
        <DetailField label="Alt. Purchase Channel" value={item.alt_purchase_channel} />
        <DetailField label="Alasan Beli" value={item.reason_buy} />
        <DetailField label="No. Telepon" value={item.phone_number} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Formula (read-only)">
        <DetailField label="Value Order" value={item.value_order} />
        <DetailField label="Discount Code" value={item.discount_code} />
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="traffic_store" entityId={String(item.id)} />
    </DetailShell>
  );
}
