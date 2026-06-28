"use client";

import { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function FieldHint({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
        <AlertCircle className="h-3 w-3 shrink-0" />
        {error}
      </p>
    );
  }
  if (hint) return <p className="mt-1 text-[11px] text-gray-400">{hint}</p>;
  return null;
}

export const inputClass = (hasError?: boolean) =>
  cn(
    "w-full rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-800 outline-none transition-colors duration-200 hover:bg-white focus:bg-white focus:ring-2",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-primary/40 focus:ring-primary/10"
  );

export function FormSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {title && <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>}
      {children}
    </div>
  );
}

export function FormDivider() {
  return <div className="border-t border-dashed border-gray-200" />;
}
