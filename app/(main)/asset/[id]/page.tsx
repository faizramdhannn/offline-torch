"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Asset } from "@/components/asset/types";
import { FileIcon } from "@/components/asset/FileIcon";
import { Badge } from "@/components/shared/Badge";
import { getTypeBadgeVariant } from "@/components/asset/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (!parsed.asset_store) { router.push("/dashboard"); return; }
    setUser(parsed);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/asset");
      const result = await res.json();
      const found = (result as Asset[]).find((a) => String(a.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch asset:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/asset" label="Asset" />;

  const canEdit = user.user_setting === true || user.user_setting === "true";

  return (
    <DetailShell
      title={item.asset_name}
      subtitle="Detail Asset"
      backHref="/asset"
      onEdit={canEdit ? () => router.push("/asset") : undefined}
      editLabel="Kelola di List"
    >
      <div className="flex items-center gap-3">
        <FileIcon url={item.link_url} size={40} />
        <div>
          <Badge variant={getTypeBadgeVariant(item.type_asset)} dot>
            {item.type_asset}
          </Badge>
        </div>
      </div>

      <DetailSection title="Informasi Asset">
        <DetailField label="Nama Asset" value={item.asset_name} />
        <DetailField label="Tipe Asset" value={item.type_asset} />
        <DetailField
          label="Link"
          value={
            <a
              href={item.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Buka file <ExternalLink className="w-3 h-3" />
            </a>
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="asset" entityId={String(item.id)} />
    </DetailShell>
  );
}
