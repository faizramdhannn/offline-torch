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

interface InvoiceItem {
  product_name: string;
  qty: number;
  unit_price: number;
  total_price?: number;
}

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_address: string;
  subtotal: string | number;
  tax_percent: string | number;
  tax_amount: string | number;
  grand_total: string | number;
  amount_in_words: string;
  status: string;
  doc_type?: string;
  created_at: string;
  signature_store?: string;
  signature_pic?: string;
  items?: InvoiceItem[];
}

function formatRupiah(val: number | string): string {
  const number = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, "") || "0");
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(number);
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const u = JSON.parse(userData);
    if (!u.invoice) { router.push("/dashboard"); return; }
    setUser(u);
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoice?id=${id}`);
      if (!res.ok) { setItem(null); return; }
      const data = await res.json();
      setItem(data || null);
      setItems(data?.items || []);
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/invoice" label="Invoice" />;

  return (
    <DetailShell
      title={item.invoice_number}
      subtitle="Detail Invoice"
      backHref="/invoice"
    >
      <DetailSection title="Informasi Invoice">
        <DetailField label="Invoice Number" value={item.invoice_number} />
        <DetailField label="Tanggal" value={item.invoice_date} />
        <DetailField label="Tipe Dokumen" value={item.doc_type || "invoice"} />
        <DetailField label="Status" value={item.status} />
        <DetailField label="Customer" value={item.customer_name} />
        <DetailField label="Alamat Customer" value={item.customer_address} />
        <DetailField label="Signature Store" value={item.signature_store} />
        <DetailField label="Signature PIC" value={item.signature_pic} />
        <DetailField label="Dibuat Pada" value={item.created_at} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Item
        </label>
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-1.5 text-left">Produk</th>
                <th className="px-3 py-1.5 text-right">Qty</th>
                <th className="px-3 py-1.5 text-right">Harga</th>
                <th className="px-3 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{it.product_name}</td>
                  <td className="px-3 py-1.5 text-right">{it.qty}</td>
                  <td className="px-3 py-1.5 text-right">{formatRupiah(it.unit_price)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">
                    {formatRupiah(it.total_price || it.qty * it.unit_price)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-gray-400">Tidak ada item</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 space-y-1 text-xs text-right">
          <p>Sub Total: <span className="font-semibold">{formatRupiah(item.subtotal)}</span></p>
          <p>Pajak ({item.tax_percent || 0}%): <span className="font-semibold">{formatRupiah(item.tax_amount)}</span></p>
          <p className="text-primary font-bold">Grand Total: {formatRupiah(item.grand_total)}</p>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="invoice" entityId={item.invoice_id} />
    </DetailShell>
  );
}
