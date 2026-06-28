"use client";

import { Info } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";

interface CategoryDetail {
  category: string;
  description: string;
  example: string;
}

export function InfoModal({
  open,
  onClose,
  categoryDetails,
}: {
  open: boolean;
  onClose: () => void;
  categoryDetails: CategoryDetail[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Info}
      title="Petty Cash Category Information"
      description="Referensi kategori dan contoh penggunaannya"
      maxWidth="max-w-3xl"
      footer={
        <Button variant="secondary" className="ml-auto justify-center" onClick={onClose}>
          Close
        </Button>
      }
    >
      {categoryDetails.length === 0 ? (
        <EmptyState icon={Info} title="Belum ada informasi kategori" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Category</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Description</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryDetails.map((detail, index) => (
                <tr key={index} className="transition-colors hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800">{detail.category}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{detail.description}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{detail.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
