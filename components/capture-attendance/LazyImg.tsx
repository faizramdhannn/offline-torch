"use client";

import { useEffect, useRef, useState, CSSProperties, ReactNode } from "react";
import { Camera } from "lucide-react";

export function LazyImg({
  src,
  alt,
  className,
  style,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {visible && !errored ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : errored ? (
        fallback || <span className="flex h-full w-full items-center justify-center text-xs text-gray-300">—</span>
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-100" />
      )}
    </div>
  );
}

export function SelfiePlaceholderSm() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
      <Camera className="h-4 w-4 text-gray-300" />
    </div>
  );
}

export function SelfiePlaceholderMd() {
  return (
    <div
      className="mb-2 flex w-full flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-100"
      style={{ aspectRatio: "4/3" }}
    >
      <Camera className="mb-1 h-6 w-6 text-gray-300" />
      <span className="text-[10px] text-gray-400">Foto tidak tersedia</span>
    </div>
  );
}