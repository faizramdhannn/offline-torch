"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  FileText,
  Truck,
  Hash,
  Tag,
  Receipt,
  Calendar,
  User,
  Building2,
  MapPin,
  Weight,
  MessageSquare,
  UserCog,
  Clock,
} from "lucide-react";
import { ExpeditionBadge, TypeReasonBadge, CopyButton, ShipmentStatusBadge } from "./DomainBadges";
import { Badge } from "./Badge";

interface TrackingItem {
  id: string;
  date: string;
  assigned_to: string;
  expedition: string;
  sender: string;
  receiver: string;
  weight: string;
  reason: string;
  type_reason?: string;
  sales_order?: string;
  link_tracking: string;
  request_by: string;
  update_by: string;
  created_at: string;
  update_at: string;
  tracking_number?: string;
  has_processed?: string;
}

function getEmbedUrl(url: string): string {
  if (!url) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  return url;
}

function getDownloadUrl(url: string): string {
  if (!url) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  return url;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      {children}
    </div>
  );
}

export function DetailPopup({
  item,
  onClose,
  copiedId,
  onCopy,
}: {
  item: TrackingItem;
  onClose: () => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const status = item.link_tracking ? "completed" : "pending";
  const isDriveUrl = item.link_tracking?.includes("drive.google.com");
  const embedUrl = getEmbedUrl(item.link_tracking || "");
  const downloadUrl = getDownloadUrl(item.link_tracking || "");
  const isPdf = isDriveUrl
    ? true
    : item.link_tracking?.toLowerCase().includes(".pdf") ||
      item.link_tracking?.toLowerCase().includes("application/pdf") ||
      (item.link_tracking && !item.link_tracking?.match(/\.(png|jpg|jpeg|gif|webp)/i));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm font-semibold text-gray-900">Detail Shipment</h2>
              <Badge variant="neutral" className="font-mono">
                {item.id}
              </Badge>
              <ShipmentStatusBadge status={status} />
              {item.has_processed === "TRUE" && <Badge variant="teal">Diproses</Badge>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Preview pane */}
            <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-100 bg-gray-100">
              {item.link_tracking ? (
                <>
                  <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
                    <span className="text-[11px] font-medium text-gray-500">
                      {isPdf ? "File PDF" : "Bukti Gambar"}
                    </span>
                    <a
                      href={downloadUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download file"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  </div>
                  <div className="flex flex-1 items-center justify-center overflow-auto p-3">
                    {isPdf ? (
                      <iframe src={embedUrl} className="h-full w-full rounded-lg border border-gray-200 bg-white" title="Resi PDF" />
                    ) : (
                      <img src={embedUrl} alt="Bukti Resi" className="max-h-full max-w-full rounded-lg border border-gray-200 object-contain shadow-sm" />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
                  <FileText className="h-12 w-12 opacity-30" strokeWidth={1.2} />
                  <p className="text-xs text-gray-400">Belum ada resi diupload</p>
                </div>
              )}
            </div>

            {/* Detail sidebar */}
            <div className="flex w-64 shrink-0 flex-col overflow-y-auto bg-white">
              <div className="space-y-4 p-4">
                <DetailRow icon={Truck} label="Ekspedisi">
                  <ExpeditionBadge expedition={item.expedition} />
                </DetailRow>

                {item.tracking_number && (
                  <DetailRow icon={Hash} label="No. Resi">
                    <div className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 p-2">
                      <p className="flex-1 select-all break-all font-mono text-xs font-bold text-blue-900">
                        {item.tracking_number}
                      </p>
                      <CopyButton text={item.tracking_number} id={`resi-detail-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                    </div>
                  </DetailRow>
                )}

                <DetailRow icon={Tag} label="Tipe Pengiriman">
                  <TypeReasonBadge typeReason={item.type_reason} />
                </DetailRow>

                {item.sales_order && (
                  <DetailRow icon={Receipt} label="No. Sales Order">
                    <div className="flex items-center gap-1">
                      <p className="flex-1 font-mono text-xs font-semibold text-gray-800">{item.sales_order}</p>
                      <CopyButton text={item.sales_order} id={`so-detail-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                    </div>
                  </DetailRow>
                )}

                <DetailRow icon={Calendar} label="Tanggal">
                  <p className="text-xs text-gray-800">{item.date}</p>
                </DetailRow>

                <DetailRow icon={User} label="Assigned To">
                  <p className="text-xs text-gray-800">{item.assigned_to}</p>
                </DetailRow>

                <DetailRow icon={Building2} label="Pengirim">
                  <p className="text-xs text-gray-800">{item.sender}</p>
                </DetailRow>

                <DetailRow icon={MapPin} label="Penerima">
                  <div className="space-y-1">
                    {item.receiver && (
                      <div className="flex justify-end">
                        <CopyButton text={item.receiver} id={`detail-${item.id}`} copiedId={copiedId} onCopy={onCopy} />
                      </div>
                    )}
                    <p className="select-all whitespace-pre-line rounded-lg border border-gray-100 bg-gray-50 p-2 font-mono text-xs leading-relaxed text-gray-800">
                      {item.receiver || "-"}
                    </p>
                  </div>
                </DetailRow>

                <DetailRow icon={Weight} label="Berat">
                  <p className="text-xs text-gray-800">{item.weight} kg</p>
                </DetailRow>

                <DetailRow icon={MessageSquare} label="Alasan">
                  <p className="text-xs text-gray-800">{item.reason}</p>
                </DetailRow>

                <DetailRow icon={User} label="Request By">
                  <p className="text-xs text-gray-800">{item.request_by}</p>
                </DetailRow>

                {item.update_by && (
                  <DetailRow icon={UserCog} label="Update By">
                    <p className="text-xs text-gray-800">{item.update_by}</p>
                  </DetailRow>
                )}

                <DetailRow icon={Clock} label="Status Proses">
                  <Badge variant={item.has_processed === "TRUE" ? "teal" : "neutral"}>
                    {item.has_processed === "TRUE" ? "Sudah diproses" : "Belum diproses"}
                  </Badge>
                </DetailRow>

                <div className="space-y-1 border-t border-gray-100 pt-2">
                  {item.created_at && (
                    <p className="text-[10px] text-gray-400">Dibuat: {new Date(item.created_at).toLocaleString("id-ID")}</p>
                  )}
                  {item.update_at && (
                    <p className="text-[10px] text-gray-400">Diupdate: {new Date(item.update_at).toLocaleString("id-ID")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
