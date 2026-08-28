"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bundling } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

const STORE_LIST = [
  { key: "torch_cirebon", label: "Torch Cirebon" },
  { key: "torch_jogja", label: "Torch Jogja" },
  { key: "torch_karawaci", label: "Torch Karawaci" },
  { key: "torch_karawang", label: "Torch Karawang" },
  { key: "torch_lampung", label: "Torch Lampung" },
  { key: "torch_lembong", label: "Torch Lembong" },
  { key: "torch_makassar", label: "Torch Makassar" },
  { key: "torch_malang", label: "Torch Malang" },
  { key: "torch_margonda", label: "Torch Margonda" },
  { key: "torch_medan", label: "Torch Medan" },
  { key: "torch_pekalongan", label: "Torch Pekalongan" },
  { key: "torch_purwokerto", label: "Torch Purwokerto" },
  { key: "torch_surabaya", label: "Torch Surabaya" },
  { key: "torch_tambun", label: "Torch Tambun" },
];

export default function BundlingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Bundling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.bundling) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bundling");
      const result = await response.json();
      const found = (result as Bundling[]).find((b) => b.id === id);
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch bundling data:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/bundling" label="Bundling" />;

  const canEdit = !!user.user_setting;
  const options = [
    item.option_1, item.option_2, item.option_3,
    item.option_4, item.option_5, item.option_6,
  ].filter(Boolean);
  const totalStock = STORE_LIST.reduce(
    (total, store) => total + (parseInt((item[store.key as keyof Bundling] as string) || "0") || 0),
    0
  );

  return (
    <DetailShell
      title={item.bundling_name}
      subtitle="Detail Bundling"
      backHref="/bundling"
      onEdit={canEdit ? () => router.push(`/bundling?edit=${item.id}`) : undefined}
    >
      <DetailSection title="Informasi Bundling">
        <DetailField label="Nama Bundling" value={item.bundling_name} />
        <DetailField
          label="Status"
          value={
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              item.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}>
              {item.status === "active" ? "Active" : "Inactive"}
            </span>
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Item & Diskon per Item">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const option = item[`option_${n}` as keyof Bundling] as string;
          const discount = item[`discount_${n}` as keyof Bundling] as string;
          if (!option) return null;
          return (
            <DetailField
              key={n}
              label={`Option ${n}`}
              value={`${option} (Diskon ${discount || 0}%)`}
            />
          );
        })}
        {options.length === 0 && <p className="text-xs text-gray-400">Tidak ada item</p>}
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Ringkasan Harga">
        <DetailField label="Total HPJ" value={item.total_value} />
        <DetailField label="Diskon (%)" value={`${item.discount_percentage}%`} />
        <DetailField label="Diskon (Rp)" value={item.discount_value} />
        <DetailField label="Harga Final" value={item.value} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Stock per Toko">
        <DetailField label="Total Stock" value={`${totalStock} unit`} />
        {STORE_LIST.filter((s) => parseInt((item[s.key as keyof Bundling] as string) || "0") > 0).map((store) => (
          <DetailField
            key={store.key}
            label={store.label}
            value={`${parseInt((item[store.key as keyof Bundling] as string) || "0")} unit`}
          />
        ))}
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="bundling" entityId={String(item.id)} />
    </DetailShell>
  );
}
