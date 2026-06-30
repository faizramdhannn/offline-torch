"use client";

import { useState } from "react";
import { BookOpenCheck, ChevronDown } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { STEP_ERP_TYPES } from "@/lib/stepErpConfig";

const OWNER_BADGE: Record<string, "info" | "purple" | "teal" | "warning"> = {
  Requester: "info",
  Sender: "purple",
  Receiver: "teal",
  "Head Office": "warning",
};

interface MasterChecklistGuideProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Read-only reference popup — shows every Step ERP type from the master
 * checklist config (lib/stepErpConfig.ts) along with the full list of steps
 * and who owns each step. Doesn't touch any entry data; purely informational.
 */
export function MasterChecklistGuide({ open, onClose }: MasterChecklistGuideProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(STEP_ERP_TYPES[0]?.key ?? null);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={BookOpenCheck}
      title="Master Checklist — Step ERP"
      description={`${STEP_ERP_TYPES.length} tipe proses, lengkap dengan urutan langkah dan penanggung jawabnya`}
      maxWidth="max-w-2xl"
      footer={
        <Button variant="primary" className="ml-auto" onClick={onClose}>
          Mengerti
        </Button>
      }
    >
      <div className="space-y-2">
        {STEP_ERP_TYPES.map((t) => {
          const isOpen = expandedKey === t.key;
          return (
            <div
              key={t.key}
              className="overflow-hidden rounded-xl border border-gray-100"
            >
              <button
                type="button"
                onClick={() => toggle(t.key)}
                className="flex w-full items-center justify-between gap-3 bg-gray-50/60 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{t.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-400">{t.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="neutral">{t.steps.length} langkah</Badge>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {isOpen && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {t.steps.map((step, i) => (
                    <li key={step.key} className="flex items-start gap-3 px-3.5 py-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] leading-relaxed text-gray-700">{step.label}</p>
                        <Badge variant={OWNER_BADGE[step.owner] ?? "neutral"} className="mt-1">
                          {step.owner}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
