"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Canvasing } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

export default function CanvasingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Canvasing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.canvasing) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser.user_name);
  }, [id]);

  const fetchData = async (username: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/canvasing?username=${username}`);
      const result = await response.json();
      const list: Canvasing[] = result.data || [];
      const found = list.find((c) => String(c.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch canvasing entry:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/canvasing" label="Canvasing" />;

  return (
    <DetailShell
      title={item.name}
      subtitle="Detail Canvasing"
      backHref="/canvasing"
    >
      {item.image_url && (
        <a href={item.image_url} target="_blank" rel="noopener noreferrer">
          <img
            src={item.image_url}
            alt={item.name}
            className="h-40 w-40 rounded-xl border border-gray-200 object-cover"
          />
        </a>
      )}

      <DetailSection title="Informasi Canvasing">
        <DetailField label="Store" value={item.store} />
        <DetailField label="Nama" value={item.name} />
        <DetailField label="Contact Person" value={item.contact_person} />
        <DetailField label="Category" value={item.category} />
        <DetailField label="Sub Category" value={item.sub_category} />
        <DetailField label="Canvasser" value={item.canvasser} />
        <DetailField label="Visit At" value={item.visit_at} />
        <DetailField label="Result Status" value={item.result_status} />
        <DetailField label="Notes" value={item.notes} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Metadata">
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.name, String(item.id), item.contact_person]} />
    </DetailShell>
  );
}
