"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface StockItem {
  sku: string;
  item_name: string;
  hpj: string;
  discount?: string;
  link_url?: string;
  image_url?: string;
}

interface QRLabelPopupProps {
  item: StockItem;
  onClose: () => void;
  toProperCase: (s: string) => string;
  parseDiscount: (v: string | undefined | null) => number;
  parseHarga: (v: string | undefined | null) => number;
  formatRupiah: (v: number) => string;
}

export function QRLabelPopup({
  item,
  onClose,
  toProperCase,
  parseDiscount,
  parseHarga,
  formatRupiah,
}: QRLabelPopupProps) {
  const imageUrl = item.link_url || item.image_url || "";
  const [imgError, setImgError] = useState(false);

  const discountPct = parseDiscount(item.discount);
  const hpjVal = parseHarga(item.hpj);
  const hargaDiskon = discountPct > 0 && hpjVal > 0 ? Math.round(hpjVal * (1 - discountPct / 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ width: "min(500px, 100%)" }}
      >
        {imageUrl && !imgError ? (
          <div className="flex h-40 items-center justify-center overflow-hidden border-b border-gray-100 bg-gray-50">
            <img
              src={imageUrl}
              alt={item.sku}
              className="max-h-40 max-w-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="flex h-16 items-center justify-center border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-400">Tidak ada gambar</span>
          </div>
        )}

        <div className="flex min-h-[140px] items-stretch">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 border-r border-gray-100 p-4">
            <div className="text-[13px] font-bold tracking-wide text-gray-900">{item.sku}</div>
            <div className="text-[11px] font-medium leading-snug text-gray-700">
              {toProperCase(item.item_name)}
            </div>
            {item.hpj && (
              <div className="mt-1.5">
                {discountPct > 0 ? (
                  <>
                    <div className="text-[10px] text-gray-400 line-through">{item.hpj}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded bg-red-500 px-1.5 py-px text-[10px] font-bold text-white">
                        -{discountPct}%
                      </span>
                      <span className="text-[13px] font-bold text-gray-900">{formatRupiah(hargaDiskon)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-[13px] font-bold text-gray-900">{item.hpj}</div>
                )}
              </div>
            )}
          </div>

          <div className="flex w-[130px] shrink-0 items-center justify-center bg-gray-50 p-3">
            <QRCodeSVG value={item.sku} size={106} level="H" includeMargin={false} />
          </div>
        </div>
      </div>
    </div>
  );
}