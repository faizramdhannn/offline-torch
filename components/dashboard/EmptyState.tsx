"use client";

import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon = Inbox, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon className="h-7 w-7 text-gray-300" strokeWidth={1.5} />
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}