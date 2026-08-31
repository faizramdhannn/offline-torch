"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { ActivityHistory } from "@/components/shared/ActivityHistory";
import { Button } from "@/components/shared/Button";
import { QRLabelPopup } from "@/components/stock/QRLabelPopup";
import {
  DetailShell,
  DetailField,
  DetailSection,
  DetailLoading,
  DetailNotFound,
} from "@/components/shared/DetailShell";

function toProperCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function parseHarga(val: string | undefined | null): number {
  if (!val) return 0;
  return parseInt(String(val).replace(/[^0-9]/g, "")) || 0;
}

function parseDiscount(val: string | undefined | null): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function formatRupiah(val: number): string {
  return "Rp " + val.toLocaleString("id-ID");
}

interface StockItem {
  sku: string;
  SKU?: string;
  stock: string;
  Stock?: string;
  item_name: string;
  Product_name?: string;
  category: string;
  Category?: string;
  grade: string;
  Grade?: string;
  tier_product: string;
  Tier_product?: string;
  tier_phase: string;
  Tier_phase?: string;
  hpp: string;
  HPP?: string;
  hpt: string;
  HPT?: string;
  hpj: string;
  HPJ?: string;
  warehouse?: string;
  link_url?: string;
  image_url?: string;
}

// Stock master data is fetched per-view (`type` query param); this detail
// page uses the default "result_stock" view (aggregated stock) and matches
// by SKU — best-effort since the same SKU can also appear per-warehouse.
export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sku = decodeURIComponent(params?.id as string);

  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) { router.push("/login"); return; }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock) { router.push("/dashboard"); return; }
    setUser(parsedUser);
    fetchData();
  }, [sku]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stock?type=result_stock");
      const result = await response.json();
      const found = (Array.isArray(result) ? result : []).find(
        (r: any) => String(r.sku || r.SKU) === sku
      );
      setItem(found || null);
    } catch (error) {
      console.error("Failed to fetch stock item:", error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <DetailLoading />;
  if (!item) return <DetailNotFound backHref="/stock" label="Item stock" />;

  const sk = item.sku || item.SKU || sku;
  const name = item.item_name || item.Product_name || sk;

  return (
    <>
    <DetailShell title={name} subtitle="Detail Stock" backHref="/stock">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        {(item.link_url || item.image_url) ? (
          <img
            src={item.link_url || item.image_url}
            alt={sk}
            className="h-48 w-48 rounded-xl border border-gray-100 object-cover"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-xs text-gray-400">
            Tidak ada gambar
          </div>
        )}
        <Button icon={ScanLine} variant="outline" onClick={() => setShowBarcode(true)}>
          Lihat Barcode
        </Button>
      </div>

      <DetailSection title="Informasi Item">
        <DetailField label="SKU" value={sk} />
        <DetailField label="Nama Produk" value={name} />
        <DetailField label="Category" value={item.category || item.Category} />
        <DetailField label="Grade" value={item.grade || item.Grade} />
        <DetailField label="Tier Product" value={item.tier_product || item.Tier_product} />
        <DetailField label="Tier Phase" value={item.tier_phase || item.Tier_phase} />
        <DetailField label="Stock" value={item.stock || item.Stock} />
        <DetailField label="Warehouse" value={item.warehouse} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <DetailSection title="Harga">
        <DetailField label="HPP" value={item.hpp || item.HPP} />
        <DetailField label="HPT" value={item.hpt || item.HPT} />
        <DetailField label="HPJ" value={item.hpj || item.HPJ} />
      </DetailSection>

      <div className="border-t border-dashed border-gray-200" />

      <ActivityHistory entityType="stock" entityId={sk} />
    </DetailShell>

    {showBarcode && (
      <QRLabelPopup
        item={{
          sku: sk,
          item_name: name,
          hpj: item.hpj || item.HPJ || "",
          link_url: item.link_url,
          image_url: item.image_url,
        }}
        onClose={() => setShowBarcode(false)}
        toProperCase={toProperCase}
        parseDiscount={parseDiscount}
        parseHarga={parseHarga}
        formatRupiah={formatRupiah}
      />
    )}
    </>
  );
}
