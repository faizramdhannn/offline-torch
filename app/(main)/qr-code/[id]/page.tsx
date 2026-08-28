"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

const TORCH_LOGO_URL = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";

interface QrCodeItem {
  uuid: string;
  name: string;
  url: string;
  created_at: string;
  update_at: string;
}

interface AnalyticsSummary {
  total_scans: number;
  by_device: Record<string, number>;
  by_country: Record<string, number>;
  by_browser: Record<string, number>;
}

function trackingLink(uuid: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/r/${uuid}`;
}

export default function QrCodeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<QrCodeItem | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.dashboard) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [uuid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr-code");
      const result = await res.json();
      const list: QrCodeItem[] = Array.isArray(result) ? result : [];
      const found = list.find((r) => r.uuid === uuid);
      setItem(found || null);

      if (found) {
        try {
          const aRes = await fetch(`/api/qr-code/analytics?qr_uuid=${encodeURIComponent(uuid)}`);
          if (aRes.ok) setAnalytics(await aRes.json());
        } catch {}
      }
    } catch (error) {
      console.error("Failed to fetch QR code:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/qr-code" label="QR Code" />;

  return (
    <DetailShell title={item.name} subtitle="Detail QR Code" backHref="/qr-code">
      <div className="flex justify-center">
        <QRCodeCanvas
          value={trackingLink(item.uuid)}
          size={140}
          level="H"
          imageSettings={{ src: TORCH_LOGO_URL, height: 20, width: 60, excavate: true, crossOrigin: "anonymous" }}
        />
      </div>

      <DetailSection title="Informasi QR Code">
        <DetailField label="Nama" value={item.name} />
        <DetailField label="URL Tujuan" value={item.url} />
        <DetailField label="Tracking Link" value={trackingLink(item.uuid)} />
        <DetailField label="Created At" value={item.created_at} />
        <DetailField label="Update At" value={item.update_at} />
      </DetailSection>

      {analytics && (
        <>
          <div className="border-t border-dashed border-gray-200" />
          <DetailSection title="Ringkasan Analitik">
            <DetailField label="Total Scan" value={analytics.total_scans} />
            <DetailField
              label="Top Device"
              value={Object.entries(analytics.by_device || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"}
            />
            <DetailField
              label="Top Country"
              value={Object.entries(analytics.by_country || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"}
            />
            <DetailField
              label="Top Browser"
              value={Object.entries(analytics.by_browser || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"}
            />
          </DetailSection>
        </>
      )}

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="qr_code" entityId={item.uuid} />
    </DetailShell>
  );
}
