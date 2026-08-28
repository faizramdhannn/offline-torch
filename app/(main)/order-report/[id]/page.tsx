"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderReport } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

// OrderReport records don't have a unique `id` — sales_order is the closest
// stable identifier (also unique per row in this sheet), so the [id] route
// param here is a URL-encoded sales_order.
export default function OrderReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const salesOrder = decodeURIComponent(params?.id as string);

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<OrderReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.order_report) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [salesOrder]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/order-report");
      const result = await response.json();
      const list: OrderReport[] = Array.isArray(result) ? result : result.data || [];
      const found = list.find((r) => r.sales_order === salesOrder);
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch order report:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/order-report" label="Order" />;

  return (
    <DetailShell
      title={item.sales_order}
      subtitle="Detail Order Report"
      backHref="/order-report"
    >
      <DetailSection title="Informasi Order">
        <DetailField label="Order Date" value={item.order_date} />
        <DetailField label="Sales Order" value={item.sales_order} />
        <DetailField label="Warehouse" value={item.warehouse} />
        <DetailField label="Status" value={item.status} />
        <DetailField label="Sales Channel" value={item.sales_channel} />
        <DetailField label="Channel Name" value={item.channel_name} />
        <DetailField label="Payment Method" value={item.payment_method} />
        <DetailField label="Value Amount" value={item.value_amount} />
        <DetailField label="Delivery Note" value={item.delivery_note} />
        <DetailField label="Sales Invoice" value={item.sales_invoice} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.sales_order, item.delivery_note, item.sales_invoice]} />
    </DetailShell>
  );
}
