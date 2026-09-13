"use client";

import { useEffect, useState } from "react";
import { Customer } from "@/types";

interface FollowupMessageModalProps {
  customer: Customer;
  username: string;
  onClose: () => void;
}

// wa.me butuh nomor internasional tanpa "+"/"0" depan — nomor Indonesia yang
// diawali "0" diganti jadi "62".
function toWaNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  return digits;
}

export function FollowupMessageModal({ customer, username, onClose }: FollowupMessageModalProps) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [message, setMessage] = useState("");
  const [followupId, setFollowupId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/customer/followup-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: customer.phone_number,
            store_name: customer.location_store,
            customer_name: customer.customer_name,
            total_order: Number(customer.total_order) || 0,
            badges: customer.badges || [],
            last_purchase_iso: customer.last_purchase_iso,
            username,
          }),
        });
        const result = await res.json();
        if (res.ok) {
          setFollowupId(result.id);
          setAnalysis(result.analysis);
          setMessage(result.message);
        }
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, [customer.phone_number]);

  const handleSend = async () => {
    setSending(true);
    try {
      if (followupId) {
        await fetch("/api/customer/followup-message", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: followupId, message }),
        });
      }
      const waNumber = toWaNumber(customer.phone_number);
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, "_blank");
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Followup WhatsApp</h2>
            <p className="text-[11px] text-gray-400">
              {customer.customer_name || customer.phone_number} · {customer.phone_number}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-400">Menganalisis customer...</div>
        ) : (
          <>
            <div className="mb-3 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-600">
              <span className="font-semibold text-gray-500">Analisis: </span>
              {analysis}
            </div>

            <label className="mb-1 block text-[10px] font-medium text-gray-500">
              Pesan (bisa diedit sebelum dikirim)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? "Membuka WhatsApp..." : "Kirim via WhatsApp"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
