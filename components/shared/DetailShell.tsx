"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/shared/Button";

interface DetailShellProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
}

/**
 * Shared visual shell for record detail pages (`app/(main)/<menu>/[id]/page.tsx`).
 * Keeps look-and-feel consistent with the rest of the app (white card, small
 * uppercase section labels, same Button component).
 */
export function DetailShell({
  title,
  subtitle,
  backHref,
  backLabel = "Kembali",
  onEdit,
  editLabel = "Edit",
  children,
}: DetailShellProps) {
  const router = useRouter();

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => router.push(backHref)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {backLabel}
            </button>
            <h1 className="text-2xl font-bold text-primary">{title}</h1>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {onEdit && <Button onClick={onEdit}>{editLabel}</Button>}
        </div>

        <div className="bg-white rounded-lg shadow p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-xs text-gray-800 break-words">{value ?? "-"}</p>
    </div>
  );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function DetailLoading() {
  return <div className="p-8 text-center text-sm text-gray-500">Loading...</div>;
}

export function DetailNotFound({ backHref, label }: { backHref: string; label: string }) {
  const router = useRouter();
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">{label} tidak ditemukan.</p>
          <Button variant="secondary" onClick={() => router.push(backHref)}>
            Kembali
          </Button>
        </div>
      </div>
    </div>
  );
}
