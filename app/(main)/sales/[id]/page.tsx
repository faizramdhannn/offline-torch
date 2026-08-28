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

interface SpreadsheetEntry {
  id: string;
  month: string;
  year: string;
  store: string;
  spreadsheet_link_url: string;
  spreadsheet_id: string;
}

export default function SalesSpreadsheetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<SpreadsheetEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsed = JSON.parse(userData);
    if (!parsed.sales_view && !parsed.sales_view_all) { router.push("/dashboard"); return; }
    setUser(parsed);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales?type=all");
      const json = await res.json();
      const list: SpreadsheetEntry[] = json.spreadsheetSales || [];
      const found = list.find((r) => String(r.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch sales spreadsheet:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/sales" label="Spreadsheet sales" />;

  return (
    <DetailShell title={`${item.store} — ${item.month} ${item.year}`} subtitle="Detail Sales Spreadsheet" backHref="/sales">
      <DetailSection title="Informasi">
        <DetailField label="Store" value={item.store} />
        <DetailField label="Bulan" value={item.month} />
        <DetailField label="Tahun" value={item.year} />
        <DetailField
          label="Link Spreadsheet"
          value={
            <a href={item.spreadsheet_link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Buka spreadsheet
            </a>
          }
        />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="sales" entityId={String(item.id)} />
    </DetailShell>
  );
}
