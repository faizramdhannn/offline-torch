"use client";

import { LucideIcon, Inbox } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Generic empty-state panel: icon, title, optional description and CTA.
 * Used when filtered data returns no results or the list is empty.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <Icon className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {description && (
          <p className="mt-1 max-w-xs text-xs text-gray-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}