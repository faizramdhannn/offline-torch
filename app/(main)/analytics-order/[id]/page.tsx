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

interface Row {
  Name?: string;
  "Created at"?: string;
  "Paid at"?: string;
  "Financial Status"?: string;
  Subtotal?: string;
  Notes?: string;
  "Discount Code"?: string;
  "Discount Amount"?: string;
  "Lineitem name"?: string;
  "Lineitem quantity"?: string;
  "Lineitem price"?: string;
  Employee?: string;
  Location?: string;
  [key: string]: string | null | undefined;
}

function formatRupiah(val: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
}

function parseSubtotal(val: string | null | undefined): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function cleanLocationName(loc: string | null | undefined): string {
  if (!loc) return "Unknown";
  return loc.replace(/Torch Store\s*/i, "").replace(/Torch\s*/i, "").split(" - ")[0].trim() || loc;
}

// Analytics-order is derived from a raw imported Shopify export (no per-record
// CRUD in this app) — orders are identified by their `Name` (e.g. "#1001").
// The [id] param here is that URL-encoded order name.
export default function AnalyticsOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderName = decodeURIComponent(params?.id as string);

  const [user, setUser] = useState<any>(null);
  const [orderRows, setOrderRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.analytics_order) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [orderName]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // No date filter — search the widest range so the order can be found
      // regardless of which dates the list page currently has filtered.
      const res = await fetch(`/api/shopify-analytics?from=&to=`);
      const data = await res.json();
      const rows: Row[] = Array.isArray(data) ? data : [];
      setOrderRows(rows.filter((r) => r.Name === orderName));
    } catch (error) {
      console.error("Failed to fetch order:", error);
      setOrderRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (orderRows.length === 0) return <DetailNotFound backHref="/analytics-order" label="Order" />;

  const first = orderRows[0];
  const subtotal = parseSubtotal(first.Subtotal);
  const lineitems = orderRows.map((r) => ({
    name: r["Lineitem name"] || "-",
    qty: parseInt(r["Lineitem quantity"] || "1") || 1,
    price: parseSubtotal(r["Lineitem price"]),
  }));

  return (
    <DetailShell title={orderName} subtitle="Detail Order" backHref="/analytics-order">
      <DetailSection title="Informasi Order">
        <DetailField label="Order" value={orderName} />
        <DetailField label="Created At" value={first["Created at"]} />
        <DetailField label="Paid At" value={first["Paid at"]} />
        <DetailField label="Financial Status" value={first["Financial Status"]} />
        <DetailField label="Subtotal" value={formatRupiah(subtotal)} />
        <DetailField label="Discount Code" value={first["Discount Code"]} />
        <DetailField label="Discount Amount" value={first["Discount Amount"]} />
        <DetailField label="Employee" value={first.Employee} />
        <DetailField label="Location" value={cleanLocationName(first.Location)} />
        <DetailField label="Notes" value={first.Notes} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Line Items ({lineitems.length})
        </label>
        <div className="space-y-1.5">
          {lineitems.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {item.qty}
                </span>
                <p className="text-xs text-gray-700 truncate font-medium">{item.name}</p>
              </div>
              <p className="text-xs font-semibold text-gray-700 flex-shrink-0">{formatRupiah(item.price)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="analytics_order" entityId={orderName} />
    </DetailShell>
  );
}
