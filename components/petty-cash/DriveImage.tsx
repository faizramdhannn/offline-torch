"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

export function extractDriveFileId(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function DriveImage({ href, fileId, alt }: { href: string; fileId: string; alt: string }) {
  const proxyUrl = `/api/drive-image?id=${fileId}`;
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.min(z + 0.25, 3));
  };
  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom((z) => Math.max(z - 0.25, 0.5));
  };
  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom(1);
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleReset}
          className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
        >
          <ExternalLink className="h-3 w-3" />
          Buka
        </a>
      </div>
      <div className="flex max-h-72 max-w-full items-center justify-center overflow-auto rounded-xl border border-gray-200 bg-gray-50">
        <img
          src={proxyUrl}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s ease" }}
          className="h-auto max-h-72 w-auto max-w-full cursor-zoom-in rounded-xl object-contain"
          onClick={handleZoomIn}
        />
      </div>
    </div>
  );
}
