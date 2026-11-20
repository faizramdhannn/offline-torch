"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch, Truck, FileText, PackageMinus, Percent, ChevronRight, Inbox, type LucideIcon } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { cn } from "@/lib/utils";
import type { DashboardSummary, PendingItem } from "@/lib/dashboardSummary";

// "Perlu tindakan": angka pending dari menu lain (satu panggilan /api/dashboard/summary, data sheet ter-cache server).
// Di-cache di browser 5 menit (TanStack Query) — pindah menu lalu kembali tidak memanggil server lagi.
const CARDS: { key: keyof DashboardSummary["pending"]; label: string; href: string; icon: LucideIcon; tone: string }[] = [
  { key: "shipment", label: "Resi menunggu", href: "/request-tracking", icon: Truck, tone: "bg-blue-50 text-blue-600" },
  { key: "cancel_order", label: "Cancel Order pending", href: "/request-store", icon: PackageSearch, tone: "bg-orange-50 text-orange-600" },
  { key: "invoice", label: "Invoice butuh approval", href: "/invoice", icon: FileText, tone: "bg-purple-50 text-purple-600" },
  { key: "material_issue", label: "Material Issue belum tuntas", href: "/material-issue", icon: PackageMinus, tone: "bg-green-50 text-green-600" },
  { key: "employee_discount", label: "Employee Discount", href: "/employee-discount", icon: Percent, tone: "bg-pink-50 text-pink-600" },
];

function PreviewList({ title, href, items, total }: { title: string; href: string; items: PendingItem[]; total: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700">{title}</h4>
        <Link href={href} className="flex items-center text-xs text-blue-600 hover:underline">Lihat semua ({total})<ChevronRight className="h-3 w-3" /></Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map((it) => (
          <li key={it.id} className="py-1.5">
            <Link href={href} className="block hover:opacity-80">
              <p className="truncate text-sm text-gray-800">{it.title}</p>
              <p className="truncate text-xs text-gray-400">{[it.created_at.slice(0, 10), it.sub].filter(Boolean).join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/summary");
      if (!r.ok) throw new Error("gagal");
      return r.json();
    },
    staleTime: 60_000, // angka pending cache sheet 5 mnt di server; capture absensi perlu cukup segar
  });
}
export const pendingTotal = (d?: DashboardSummary) => (d ? Object.values(d.pending).reduce((s, n) => s + (n || 0), 0) : undefined);

export function PendingActions({ className }: { className?: string }) {
  const { data, isLoading, isError } = useDashboardSummary();

  const visible = CARDS.filter((c) => data?.pending && data.pending[c.key] !== undefined);
  if (isError || (!isLoading && visible.length === 0)) return null; // user tanpa izin menu terkait → bagian disembunyikan
  const total = visible.reduce((s, c) => s + (data?.pending[c.key] || 0), 0);

  return (
    <SectionCard title="Perlu Tindakan" subtitle={isLoading ? "" : total ? `${total} menunggu` : "semua beres"} icon={Inbox} accent="orange" className={className}>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map(({ key, label, href, icon: Icon, tone }) => {
              const n = data!.pending[key] || 0;
              return (
                <Link key={key} href={href} className="flex items-center gap-3 rounded-xl border border-gray-200/70 bg-gray-50/70 p-3 transition-colors hover:border-cyan-400/60 hover:bg-cyan-50/40">
                  <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className={cn("cc-num block text-xl font-semibold leading-none", n ? "text-gray-900" : "text-gray-300")}>{n}</span>
                    <span className="mt-1 block truncate text-xs text-gray-500">{label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          {((data!.lists.shipment?.length || 0) > 0 || (data!.lists.cancel_order?.length || 0) > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {!!data!.lists.shipment?.length && <PreviewList title="Resi paling lama menunggu" href="/request-tracking" items={data!.lists.shipment} total={data!.pending.shipment || 0} />}
              {!!data!.lists.cancel_order?.length && <PreviewList title="Cancel Order paling lama pending" href="/request-store" items={data!.lists.cancel_order} total={data!.pending.cancel_order || 0} />}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
