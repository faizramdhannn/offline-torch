"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Voucher } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

export default function VoucherDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.voucher) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/voucher");
      const result = await response.json();
      const found = (result as Voucher[]).find((v) => String(v.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch voucher:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/voucher" label="Voucher" />;

  const canManage = !!user.user_setting;

  return (
    <DetailShell
      title={item.voucher_name}
      subtitle="Detail Voucher"
      backHref="/voucher"
      onEdit={canManage ? () => router.push("/voucher") : undefined}
      editLabel="Kelola di List"
    >
      <DetailSection title="Informasi Voucher">
        <DetailField label="Voucher Name" value={item.voucher_name} />
        <DetailField label="Category" value={item.category} />
        <DetailField label="Description" value={item.description} />
        <DetailField label="Created At" value={item.created_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.voucher_name, String(item.id)]} />
    </DetailShell>
  );
}
