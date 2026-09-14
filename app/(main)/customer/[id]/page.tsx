"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerBadge } from "@/types";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

interface OrderLineItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderDetail {
  sales_order: string;
  store_name: string;
  financial_status: string;
  fulfillment_status: string;
  total: number;
  total_formatted: string;
  created_at: string | null;
  paid_at: string | null;
  qty: number;
  line_items: OrderLineItem[];
}

interface CrmRow {
  store_name: string;
  followup: boolean;
  result: string;
  ket: string;
  link_url: string;
  update_by: string;
  update_at: string;
}

interface CustomerDetail {
  phone_number: string;
  customer_name: string;
  email: string;
  stores: string[];
  total_order: number;
  total_qty: number;
  total_value: number;
  total_value_formatted: string;
  average_value_formatted: string;
  first_purchase: string | null;
  last_purchase: string | null;
  badges: string[];
  orders: OrderDetail[];
  crm: CrmRow[];
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRupiah(v: number) {
  return "Rp" + Math.round(v).toLocaleString("id-ID");
}

// Customer records don't have a unique `id` in the sheet — phone_number is
// the closest stable identifier (used elsewhere in this menu too), so the
// [id] route param here is actually a URL-encoded phone_number.
export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const phoneNumber = decodeURIComponent(params?.id as string);

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<CustomerDetail | null>(null);
  const [badgeMap, setBadgeMap] = useState<Record<string, CustomerBadge>>({});
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.customer) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
    fetchBadgeMap();
  }, []);

  const fetchBadgeMap = async () => {
    try {
      const res = await fetch("/api/customer/badges");
      const result = await res.json();
      const map: Record<string, CustomerBadge> = {};
      (result.data || []).forEach((b: any) => {
        map[b.badge_key] = { key: b.badge_key, label: b.label, type: b.badge_type, logo_url: b.logo_url || "" };
      });
      setBadgeMap(map);
    } catch (error) {
      console.error("Failed to fetch badge map:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/customer/detail?phone=${encodeURIComponent(phoneNumber)}`);
      if (!response.ok) {
        setItem(null);
        return;
      }
      const result = await response.json();
      setItem(result);
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

  return (
    <DetailShell
      title={item.customer_name || item.phone_number}
      subtitle="Detail Customer"
      backHref="/customer"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {item.badges.map((key) => {
          const b = badgeMap[key];
          if (!b) return null;
          return (
            <span
              key={key}
              title={b.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700"
            >
              {b.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_url} alt={b.label} className="h-4 w-4 rounded-full object-cover" />
              ) : null}
              {b.label}
            </span>
          );
        })}
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Informasi Customer">
        <DetailField label="Phone Number" value={item.phone_number} />
        <DetailField label="Customer Name" value={item.customer_name} />
        <DetailField label="Email" value={item.email || "-"} />
        <DetailField label="Store" value={item.stores.join(", ") || "-"} />
        <DetailField label="First Purchase" value={formatDate(item.first_purchase)} />
        <DetailField label="Last Purchase" value={formatDate(item.last_purchase)} />
        <DetailField label="Total Order" value={String(item.total_order)} />
        <DetailField label="Total Qty" value={String(item.total_qty)} />
        <DetailField label="Total Value" value={item.total_value_formatted} />
        <DetailField label="Average Value" value={item.average_value_formatted} />
      </DetailSection>

      {item.crm.length > 0 && (
        <>
          <div className="border-t border-dashed border-gray-200" />
          <DetailSection title="Followup">
            {item.crm.map((c) => (
              <div key={c.store_name} className="col-span-2 rounded-lg border border-gray-100 p-3 text-[11px]">
                <div className="mb-1 font-semibold text-gray-700">{c.store_name}</div>
                <div className="grid grid-cols-2 gap-2 text-gray-500">
                  <div>Followup: {c.followup ? "Ya" : "Belum"}</div>
                  <div>Result: {c.result || "-"}</div>
                  <div className="col-span-2">Note: {c.ket || "-"}</div>
                  {c.link_url && (
                    <div className="col-span-2">
                      <a href={c.link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Lihat file
                      </a>
                    </div>
                  )}
                  <div>Update by: {c.update_by || "-"}</div>
                  <div>Update at: {c.update_at || "-"}</div>
                </div>
              </div>
            ))}
          </DetailSection>
        </>
      )}

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Riwayat Order ({item.orders.length})
        </h3>
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <div className="w-24 flex-none">Sales Order</div>
            <div className="w-28 flex-none">Store</div>
            <div className="w-28 flex-none">Paid At</div>
            <div className="w-16 flex-none text-right">Qty</div>
            <div className="w-24 flex-none text-right">Total</div>
            <div className="w-16 flex-none" />
          </div>
          {item.orders.map((o) => {
            const isOpen = expandedOrder === o.sales_order;
            return (
              <div key={o.sales_order} className="border-t border-gray-50">
                <div
                  onClick={() => setExpandedOrder(isOpen ? null : o.sales_order)}
                  className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-[11px] hover:bg-gray-50"
                >
                  <div className="w-24 flex-none truncate font-medium text-gray-700" title={o.sales_order}>
                    {o.sales_order}
                  </div>
                  <div className="w-28 flex-none truncate text-gray-500" title={o.store_name}>
                    {o.store_name}
                  </div>
                  <div className="w-28 flex-none truncate text-gray-500">{formatDateTime(o.paid_at)}</div>
                  <div className="w-16 flex-none text-right text-gray-600">{o.qty}</div>
                  <div className="w-24 flex-none text-right font-semibold text-gray-800">{o.total_formatted}</div>
                  <div className="w-16 flex-none text-right text-gray-400">{isOpen ? "Tutup" : "Detail"}</div>
                </div>
                {isOpen && (
                  <div className="bg-gray-50/60 px-3 py-2">
                    <div className="flex items-center gap-3 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      <div className="w-32 flex-none">SKU</div>
                      <div className="min-w-[160px] flex-1">Item Name</div>
                      <div className="w-14 flex-none text-right">Qty</div>
                      <div className="w-24 flex-none text-right">Price</div>
                    </div>
                    {o.line_items.map((li, i) => (
                      <div key={i} className="flex items-center gap-3 px-1 py-1 text-[11px]">
                        <div className="w-32 flex-none truncate text-gray-500" title={li.sku}>
                          {li.sku || "-"}
                        </div>
                        <div className="min-w-[160px] flex-1 truncate text-gray-700" title={li.name}>
                          {li.name}
                        </div>
                        <div className="w-14 flex-none text-right text-gray-600">{li.quantity}</div>
                        <div className="w-24 flex-none text-right text-gray-600">{formatRupiah(li.price)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="customer" entityId={item.phone_number} />
    </DetailShell>
  );
}
