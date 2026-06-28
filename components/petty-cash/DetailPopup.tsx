"use client";

import { Receipt, ExternalLink, FileX } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { DriveImage, extractDriveFileId } from "./DriveImage";

interface PettyCash {
  id: string;
  date: string;
  description: string;
  category: string;
  value: string;
  store: string;
  ket: string;
  transfer: string;
  link_url: string;
  update_by: string;
  created_at: string;
  update_at: string;
}

interface DetailPopupProps {
  entry: PettyCash;
  onClose: () => void;
  formatRupiah: (value: string | number) => string;
  toTitleCase: (str: string) => string;
}

function DetailField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  );
}

export function DetailPopup({ entry, onClose, formatRupiah, toTitleCase }: DetailPopupProps) {
  const driveFileId = entry.link_url ? extractDriveFileId(entry.link_url) : null;

  return (
    <Modal
      open
      onClose={onClose}
      icon={Receipt}
      title={toTitleCase(entry.store)}
      description="Detail petty cash entry"
      footer={
        <Button variant="secondary" className="ml-auto justify-center" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-4">
        {entry.link_url && driveFileId ? (
          <div className="flex justify-center rounded-xl border border-gray-100 bg-gray-50 p-3">
            <DriveImage href={entry.link_url} fileId={driveFileId} alt="Receipt" />
          </div>
        ) : entry.link_url ? (
          <div className="flex justify-center rounded-xl border border-gray-100 bg-gray-50 p-4">
            <a href={entry.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
              Lihat Bukti
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-gray-400">
            <FileX className="h-6 w-6" strokeWidth={1.5} />
            <p className="text-xs">Tidak ada bukti</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailField label="Date">
            <p className="text-xs font-medium text-gray-800">{entry.date || "-"}</p>
          </DetailField>
          <DetailField label="Category">
            <Badge variant="info">{entry.category || "-"}</Badge>
          </DetailField>
          <DetailField label="Description" full>
            <p className="text-xs font-medium text-gray-800">{entry.description || "-"}</p>
          </DetailField>
          <DetailField label="Value">
            <p className="text-xs font-semibold text-green-700">{formatRupiah(entry.value)}</p>
          </DetailField>
          <DetailField label="Transfer">
            <Badge variant={entry.transfer === "TRUE" ? "success" : "warning"}>{entry.transfer === "TRUE" ? "Sudah" : "Belum"}</Badge>
          </DetailField>
          {entry.ket && (
            <DetailField label="Dana Talang" full>
              <p className="whitespace-pre-wrap text-xs text-gray-700">{entry.ket}</p>
            </DetailField>
          )}
          <DetailField label="Update By">
            <p className="text-xs text-gray-700">{entry.update_by || "-"}</p>
          </DetailField>
        </div>
      </div>
    </Modal>
  );
}
