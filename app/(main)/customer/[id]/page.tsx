"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Customer } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

// Customer records don't have a unique `id` in the sheet — phone_number is
// the closest stable identifier (used elsewhere in this menu too), so the
// [id] route param here is actually a URL-encoded phone_number.
export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const phoneNumber = decodeURIComponent(params?.id as string);

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.customer) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, []);

  const fetchData = async (username: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/customer?username=${username}&view=list`);
      const result = await response.json();
      const found = (result.data as Customer[])?.find(
        (c) => c.phone_number === phoneNumber
      );
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch customer:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/customer" label="Customer" />;

  const hasFollowup =
    item.followup === "TRUE" || item.followup === "True" || item.followup === "true";

  return (
    <DetailShell
      title={item.customer_name || item.phone_number}
      subtitle="Detail Customer"
      backHref="/customer"
    >
      <DetailSection title="Informasi Customer">
        <DetailField label="Phone Number" value={item.phone_number} />
        <DetailField label="Customer Name" value={item.customer_name} />
        <DetailField label="Store" value={item.location_store} />
        <DetailField label="Total Order" value={item.total_order} />
        <DetailField label="Total Value" value={item.total_value} />
        <DetailField label="Average Value" value={item.average_value} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Followup">
        <DetailField label="Followup Done" value={hasFollowup ? "Ya" : "Belum"} />
        <DetailField label="Result" value={item.result} />
        <DetailField label="Note / Keterangan" value={item.ket} />
        <DetailField
          label="File"
          value={
            item.link_url ? (
              <a
                href={item.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Lihat file
              </a>
            ) : (
              "-"
            )
          }
        />
        <DetailField label="Update By" value={item.update_by} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="customer" entityId={item.phone_number} />
    </DetailShell>
  );
}
