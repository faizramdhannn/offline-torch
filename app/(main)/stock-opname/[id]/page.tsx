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

interface StoReport {
  id: string;
  store: string;
  date_sto: string;
  id_erp: string;
  physical_count_qty: string;
  physical_count_value: string;
  system_stock_qty: string;
  system_stock_value: string;
  variance_qty: string;
  variance_value: string;
  inventory_accuracy_qty_percent: string;
  inventory_accuracy_value_percent: string;
  inventory_accuracy_sku_percent: string;
  matched_skus: string;
  skus_miss_plus_count: string;
  skus_miss_plus_qty: string;
  skus_miss_plus_value: string;
  skus_miss_minus_count: string;
  skus_miss_minus_qty: string;
  skus_miss_minus_value: string;
  total_sku_variance: string;
  total_variance_qty: string;
  total_variance_value: string;
  total_sku: string;
  grand_total_skus: string;
  grand_total_variance_qty: string;
  grand_total_variance_value: string;
}

export default function StockOpnameDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<StoReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock_opname && !parsedUser.stock_opname_report) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData(parsedUser);
  }, [id]);

  const fetchData = async (u: any) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        username: u.user_name || "",
        hasReportAccess: String(u.stock_opname_report === true || u.stock_opname_report === "true"),
      });
      const res = await fetch(`/api/stock-opname/report?${params}`);
      const result = await res.json();
      const list: StoReport[] = Array.isArray(result) ? result : [];
      const found = list.find((r) => String(r.id) === String(id));
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch stock opname report:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/stock-opname" label="Report stock opname" />;

  return (
    <DetailShell
      title={`${item.store} — ${item.date_sto}`}
      subtitle="Detail Stock Opname Report"
      backHref="/stock-opname"
    >
      <DetailSection title="Ringkasan">
        <DetailField label="Store" value={item.store} />
        <DetailField label="Tanggal STO" value={item.date_sto} />
        <DetailField label="ID ERP" value={item.id_erp} />
        <DetailField label="Akurasi Qty" value={item.inventory_accuracy_qty_percent} />
        <DetailField label="Akurasi Value" value={item.inventory_accuracy_value_percent} />
        <DetailField label="Akurasi SKU" value={item.inventory_accuracy_sku_percent} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Physical vs System">
        <DetailField label="Physical Count Qty" value={item.physical_count_qty} />
        <DetailField label="Physical Count Value" value={item.physical_count_value} />
        <DetailField label="System Stock Qty" value={item.system_stock_qty} />
        <DetailField label="System Stock Value" value={item.system_stock_value} />
        <DetailField label="Variance Qty" value={item.variance_qty} />
        <DetailField label="Variance Value" value={item.variance_value} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Miss SKU">
        <DetailField label="Matched SKU" value={item.matched_skus} />
        <DetailField label="Miss Plus (count)" value={item.skus_miss_plus_count} />
        <DetailField label="Miss Plus Qty" value={item.skus_miss_plus_qty} />
        <DetailField label="Miss Plus Value" value={item.skus_miss_plus_value} />
        <DetailField label="Miss Minus (count)" value={item.skus_miss_minus_count} />
        <DetailField label="Miss Minus Qty" value={item.skus_miss_minus_qty} />
        <DetailField label="Miss Minus Value" value={item.skus_miss_minus_value} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Grand Total">
        <DetailField label="Total SKU" value={item.total_sku} />
        <DetailField label="Total SKU Variance" value={item.total_sku_variance} />
        <DetailField label="Total Variance Qty" value={item.total_variance_qty} />
        <DetailField label="Total Variance Value" value={item.total_variance_value} />
        <DetailField label="Grand Total SKU" value={item.grand_total_skus} />
        <DetailField label="Grand Total Variance Qty" value={item.grand_total_variance_qty} />
        <DetailField label="Grand Total Variance Value" value={item.grand_total_variance_value} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory matchTerms={[item.store, item.date_sto, item.id_erp]} />
    </DetailShell>
  );
}
