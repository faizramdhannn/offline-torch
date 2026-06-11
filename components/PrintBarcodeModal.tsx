"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface StockItem {
  sku: string;
  item_name: string;
  category?: string;
  grade?: string;
  link_url?: string;
  image_url?: string;
}

interface SelectedItem {
  sku: string;
  item_name: string;
  qty: number;
}

interface PaperSize {
  id: string;
  label: string;
  w: number; // mm
  h: number; // mm
}

interface Props {
  items: StockItem[];
  onClose: () => void;
}

const PAPER_SIZES: PaperSize[] = [
  { id: "a4", label: "A4", w: 210, h: 297 },
  { id: "a5", label: "A5", w: 148, h: 210 },
  { id: "a6", label: "A6", w: 105, h: 148 },
  { id: "f4", label: "F4", w: 210, h: 330 },
];

const LABEL_W_MM = 20;
const LABEL_H_MM = 25;
const MARGIN_MM  = 5;

function calcGrid(paper: PaperSize) {
  const cols = Math.floor((paper.w - MARGIN_MM * 2) / LABEL_W_MM);
  const rows = Math.floor((paper.h - MARGIN_MM * 2) / LABEL_H_MM);
  return { cols, rows, max: cols * rows };
}

function toProperCase(str: string) {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Render QRCodeCanvas offscreen, ambil dataURL via ref
function useQRDataUrl(sku: string, size: number) {
  const [dataUrl, setDataUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // QRCodeCanvas merender ke DOM — kita buat container sementara
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:-9999px";
    document.body.appendChild(container);

    // Buat canvas element
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    // Render QR ke canvas menggunakan qrcode.react internal API
    // Cara paling reliable: buat QRCodeCanvas via ReactDOM
    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        // @ts-ignore
        <QRCodeCanvas
          value={sku}
          size={size}
          level="H"
          includeMargin={false}
          ref={(el: HTMLCanvasElement | null) => {
            if (el) {
              setDataUrl(el.toDataURL("image/png"));
            }
          }}
        />
      );
      setTimeout(() => {
        root.unmount();
        document.body.removeChild(container);
      }, 500);
    });
  }, [sku, size]);

  return dataUrl;
}

// Preview label tunggal di modal
function LabelPreview({
  sku,
  item_name,
  width,
  height,
}: {
  sku: string;
  item_name: string;
  width: number;
  height: number;
}) {
  const qrSize = Math.floor(width - 4);

  return (
    <div
      style={{
        width,
        height,
        border: "0.5px dashed #bfdbfe",
        background: "#eff6ff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 1,
        overflow: "hidden",
        gap: 1,
        position: "absolute",
      }}
    >
      <QRCodeCanvas
        value={sku}
        size={qrSize}
        level="H"
        includeMargin={false}
        style={{ width: qrSize, height: qrSize }}
      />
      <div
        style={{
          fontSize: Math.max(4, width * 0.075),
          color: "#1f2937",
          textAlign: "center",
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingInline: 1,
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {item_name.toUpperCase()}
      </div>
    </div>
  );
}

// Helper: render QRCodeCanvas ke offscreen canvas dan ambil dataURL
async function getQRDataUrl(sku: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:-9999px;visibility:hidden";
    document.body.appendChild(container);

    import("react-dom/client").then(({ createRoot }) => {
      const root = createRoot(container);

      const Capture = () => {
        const ref = useCallback((canvas: HTMLCanvasElement | null) => {
          if (canvas) {
            // tunggu render selesai
            requestAnimationFrame(() => {
              const url = canvas.toDataURL("image/png");
              resolve(url);
              root.unmount();
              document.body.removeChild(container);
            });
          }
        }, []);

        return (
          <QRCodeCanvas
            value={sku}
            size={size}
            level="H"
            includeMargin={false}
            // @ts-ignore — qrcode.react v3 meneruskan ref ke canvas element
            ref={ref}
          />
        );
      };

      root.render(<Capture />);
    });
  });
}

export default function PrintBarcodeModal({ items, onClose }: Props) {
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>(PAPER_SIZES[0]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [generating, setGenerating] = useState(false);

  const grid = calcGrid(selectedPaper);
  const totalLabels = selectedItems.reduce((s, i) => s + i.qty, 0);
  const totalPages = Math.max(1, Math.ceil(totalLabels / grid.max));

  const allLabels: SelectedItem[] = [];
  selectedItems.forEach((si) => {
    for (let i = 0; i < si.qty; i++) allLabels.push(si);
  });
  const pageLabels = allLabels.slice(
    (previewPage - 1) * grid.max,
    previewPage * grid.max
  );

  const uniqueItems = items.filter(
    (item, idx, arr) => arr.findIndex((i) => i.sku === item.sku) === idx
  );
  const filteredItems = uniqueItems.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return item.sku.toLowerCase().includes(q) || item.item_name.toLowerCase().includes(q);
  });

  const isSelected = (sku: string) => selectedItems.some((i) => i.sku === sku);

  const addItem = (item: StockItem) => {
    if (isSelected(item.sku)) return;
    setSelectedItems((prev) => [...prev, { sku: item.sku, item_name: item.item_name, qty: 1 }]);
  };

  const removeItem = (sku: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.sku !== sku));
  };

  const setQty = (sku: string, val: number) => {
    const qty = Math.max(0, Math.min(9999, val || 0));
    if (qty === 0) removeItem(sku);
    else setSelectedItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, qty } : i)));
  };

  const handleDownload = useCallback(async () => {
    if (totalLabels === 0) return;
    setGenerating(true);
    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      const orientation = selectedPaper.h > selectedPaper.w ? "portrait" : "landscape";
      const doc = new jsPDF({ orientation, unit: "mm", format: [selectedPaper.w, selectedPaper.h] });
      const { cols, rows } = calcGrid(selectedPaper);

      // Pre-generate semua QR dataURL (200px cukup tajam untuk 2cm di 96dpi+)
      const uniqueSkus = [...new Set(allLabels.map((l) => l.sku))];
      const qrCache: Record<string, string> = {};
      await Promise.all(
        uniqueSkus.map(async (sku) => {
          qrCache[sku] = await getQRDataUrl(sku, 200);
        })
      );

      let labelIdx = 0;
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) doc.addPage([selectedPaper.w, selectedPaper.h], orientation);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (labelIdx >= allLabels.length) break;
            const item = allLabels[labelIdx++];
            const x = MARGIN_MM + c * LABEL_W_MM;
            const y = MARGIN_MM + r * LABEL_H_MM;

            const qrSize = LABEL_W_MM - 2;
            const qrX = x + (LABEL_W_MM - qrSize) / 2;
            const qrY = y + 0.5;
            doc.addImage(qrCache[item.sku], "PNG", qrX, qrY, qrSize, qrSize);

            const nameY = qrY + qrSize + 1.5;
            doc.setFontSize(5);
            doc.setFont("helvetica", "bold");
            doc.text(item.item_name.toUpperCase(), x + LABEL_W_MM / 2, nameY, {
              align: "center",
              maxWidth: LABEL_W_MM - 1,
            });

            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.rect(x, y, LABEL_W_MM, LABEL_H_MM);
          }
        }
      }

      doc.save(`qr_label_${selectedPaper.label.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Gagal generate PDF. Pastikan jspdf sudah terinstall: npm install jspdf");
    } finally {
      setGenerating(false);
    }
  }, [allLabels, selectedPaper, totalLabels, totalPages]);

  const PREVIEW_BOX_W = 320;
  const scale = PREVIEW_BOX_W / selectedPaper.w;
  const previewH = selectedPaper.h * scale;
  const previewLabelW = LABEL_W_MM * scale;
  const previewLabelH = LABEL_H_MM * scale;
  const previewMargin = MARGIN_MM * scale;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full mx-4 flex flex-col"
        style={{ maxWidth: 820, maxHeight: "92vh", overflow: "hidden" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Print QR Label</h2>
            <p className="text-xs text-gray-400 mt-0.5">Label ukuran 2 cm × 2.5 cm · QR code + nama item</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-0">

            {/* Left panel */}
            <div className="flex-1 px-6 py-5 border-r border-gray-100" style={{ minWidth: 0 }}>

              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">1. Ukuran kertas</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PAPER_SIZES.map((p) => {
                  const g = calcGrid(p);
                  const active = p.id === selectedPaper.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPaper(p); setPreviewPage(1); }}
                      className={`rounded-lg border py-2 px-1 text-center transition-all ${
                        active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className={`text-[9px] mt-0.5 ${active ? "text-blue-500" : "text-gray-400"}`}>{p.w / 10}×{p.h / 10} cm</div>
                      <div className={`text-[9px] font-semibold mt-1 ${active ? "text-blue-600" : "text-gray-500"}`}>maks. {g.max} label</div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg bg-gray-50 px-3 py-2 mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{selectedPaper.label}</span>{" "}
                  ({selectedPaper.w / 10}×{selectedPaper.h / 10} cm) — {grid.cols} kolom × {grid.rows} baris ={" "}
                  <span className="font-semibold text-gray-700">{grid.max} label per halaman</span>
                </span>
              </div>

              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">2. Pilih item &amp; jumlah</p>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari SKU atau nama produk…"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />

              <div className="border border-gray-100 rounded-lg overflow-y-auto mb-3" style={{ maxHeight: 180 }}>
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">Tidak ada item ditemukan</div>
                ) : (
                  filteredItems.map((item) => {
                    const sel = isSelected(item.sku);
                    return (
                      <div
                        key={item.sku}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${sel ? "bg-blue-50" : ""}`}
                        onClick={() => (sel ? removeItem(item.sku) : addItem(item))}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"}`}>
                          {sel && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.sku}</p>
                          <p className="text-[10px] text-gray-400 truncate">{toProperCase(item.item_name)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedItems.length > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden mb-3">
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item dipilih ({selectedItems.length})</span>
                  </div>
                  {selectedItems.map((si) => (
                    <div key={si.sku} className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{si.sku}</p>
                        <p className="text-[10px] text-gray-400 truncate">{toProperCase(si.item_name)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setQty(si.sku, si.qty - 1)} className="w-6 h-6 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium">−</button>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={si.qty}
                          onChange={(e) => setQty(si.sku, parseInt(e.target.value) || 0)}
                          className="w-12 h-6 text-center border border-gray-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={() => setQty(si.sku, si.qty + 1)} className="w-6 h-6 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm font-medium">+</button>
                        <button onClick={() => removeItem(si.sku)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors ml-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${
                totalLabels > grid.max ? "bg-amber-50 border border-amber-200"
                : totalLabels > 0 ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-100"
              }`}>
                <span className="text-xs text-gray-600">Total label dipilih</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${totalLabels > grid.max ? "text-amber-600" : totalLabels > 0 ? "text-green-600" : "text-gray-400"}`}>
                    {totalLabels}
                  </span>
                  {totalLabels > grid.max && (
                    <span className="text-[10px] text-amber-500">→ {totalPages} halaman</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right panel — preview */}
            <div className="px-6 py-5" style={{ width: 380, flexShrink: 0 }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">3. Preview tata letak</p>

              <div className="border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center p-3 mb-3" style={{ minHeight: 200 }}>
                <div
                  style={{
                    width: PREVIEW_BOX_W,
                    height: previewH,
                    background: "#fff",
                    border: "1px solid #d1d5db",
                    position: "relative",
                    borderRadius: 2,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {Array.from({ length: grid.rows }).map((_, r) =>
                    Array.from({ length: grid.cols }).map((_, c) => {
                      const idx = r * grid.cols + c;
                      const lbl = pageLabels[idx];
                      const x = previewMargin + c * previewLabelW;
                      const y = previewMargin + r * previewLabelH;
                      if (lbl) {
                        return (
                          <div key={`${r}-${c}`} style={{ position: "absolute", left: x, top: y }}>
                            <LabelPreview
                              sku={lbl.sku}
                              item_name={lbl.item_name}
                              width={previewLabelW}
                              height={previewLabelH}
                            />
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`${r}-${c}`}
                          style={{
                            position: "absolute",
                            left: x,
                            top: y,
                            width: previewLabelW,
                            height: previewLabelH,
                            border: "0.5px dashed #e5e7eb",
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              <div className="text-center mb-3">
                <p className="text-xs text-gray-500">
                  Halaman <span className="font-semibold text-gray-700">{previewPage}</span> dari{" "}
                  <span className="font-semibold text-gray-700">{totalPages}</span>
                  {" · "}
                  <span className="font-semibold text-gray-700">{totalLabels}</span> label total
                </p>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mb-3">
                  <button onClick={() => setPreviewPage((p) => Math.max(1, p - 1))} disabled={previewPage === 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                  <span className="text-xs text-gray-500">{previewPage} / {totalPages}</span>
                  <button onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))} disabled={previewPage === totalPages} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                </div>
              )}

              <div className="rounded-lg bg-gray-50 px-3 py-2.5 space-y-1">
                {[
                  ["Kertas", `${selectedPaper.label} (${selectedPaper.w / 10}×${selectedPaper.h / 10} cm)`],
                  ["Tata letak", `${grid.cols} × ${grid.rows} = ${grid.max} per halaman`],
                  ["Ukuran label", "2 cm × 2.5 cm"],
                  ["Total halaman", `${totalPages}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[10px] text-gray-400">{k}</span>
                    <span className="text-[10px] font-semibold text-gray-600">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={handleDownload}
            disabled={totalLabels === 0 || generating}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating PDF…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download PDF
                {totalLabels > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] rounded px-1.5 py-0.5">
                    {totalLabels} label · {totalPages} hal
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}