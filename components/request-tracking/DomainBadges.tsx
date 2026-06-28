"use client";

import { Copy, Check, PackageSearch, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "./Badge";

const EXPEDITION_LOGO: Record<string, string> = {
  SiCepat: "/Logo Sicepat.png",
  Lion: "/Logo Lion.png",
};

export function ExpeditionBadge({ expedition }: { expedition: string }) {
  const logo = EXPEDITION_LOGO[expedition];
  if (logo) {
    return (
      <img src={logo} alt={expedition} title={expedition} className="h-5 w-auto object-contain" />
    );
  }
  return <Badge variant="neutral">{expedition}</Badge>;
}

const TYPE_REASON_VARIANT: Record<string, "info" | "warning" | "purple" | "pink" | "neutral"> = {
  Order: "info",
  Retur: "warning",
  "Request Product": "purple",
  "Free Gift": "pink",
  "Sending Document": "neutral",
};

export function TypeReasonBadge({ typeReason }: { typeReason?: string }) {
  if (!typeReason) return <span className="text-xs text-gray-300">—</span>;
  return <Badge variant={TYPE_REASON_VARIANT[typeReason] ?? "neutral"}>{typeReason}</Badge>;
}

export function ShipmentStatusBadge({ status }: { status: "completed" | "pending" }) {
  return status === "completed" ? (
    <Badge variant="success" dot>
      Selesai
    </Badge>
  ) : (
    <Badge variant="warning" dot>
      Pending
    </Badge>
  );
}

export function CopyButton({
  text,
  id,
  copiedId,
  onCopy,
}: {
  text: string;
  id: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(text, id)}
      title="Copy"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-gray-200"
    >
      {copiedId === id ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 text-gray-400" />
      )}
    </button>
  );
}

export function CheckResiButton({
  trackingNumber,
  onCheck,
}: {
  trackingNumber: string;
  onCheck: (resi: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheck(trackingNumber)}
      title="Cek resi"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-blue-100"
    >
      <PackageSearch className="h-3 w-3 text-blue-500" />
    </button>
  );
}

export function ProcessToggle({
  isProcessed,
  onToggle,
}: {
  isProcessed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isProcessed ? "Tandai belum diproses" : "Tandai sudah diproses"}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
    >
      {isProcessed ? (
        <CheckCircle2 className="h-4 w-4 text-teal-600" />
      ) : (
        <Circle className="h-4 w-4 text-gray-300 transition-colors hover:text-gray-400" />
      )}
    </button>
  );
}
