"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface MapPreviewProps {
  lat: number;
  lng: number;
  /** px height of the map canvas */
  height?: number;
  /** marker/accent color, defaults to brand primary */
  accent?: string;
  /** explicit "open in maps" link; falls back to a Google Maps query built from lat/lng */
  mapsUrl?: string;
  className?: string;
}

// CARTO basemap tiles — free for reasonable production traffic, no API key
// required, and (unlike tile.openstreetmap.org) explicitly allows being
// embedded directly in apps. Dark mode uses CARTO's own dark_all tileset
// instead of a CSS filter, so both themes render crisp, purpose-made tiles.
const TILE_URL_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_URL_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_SUBDOMAINS = ["a", "b", "c", "d"];
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

function isDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Inline, theme-aware map preview (Leaflet + CARTO basemap tiles). Renders in
 * place — never opens a new tab/window. Dark mode swaps to CARTO's dark_all
 * tileset (no CSS filter needed), toggled automatically whenever the app's
 * `html.dark` class changes.
 */
export function MapPreview({ lat, lng, height = 180, accent = "#0d334d", mapsUrl, className = "" }: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const [dark, setDark] = useState(isDarkMode);
  const [ready, setReady] = useState(false);

  // Follow theme toggles (html.dark class) so the map's tile source flips with the app
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDark(el.classList.contains("dark")));
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Init map once per mount
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: false }).addAttribution(ATTRIBUTION).addTo(map);

      const tileLayer = L.tileLayer(dark ? TILE_URL_DARK : TILE_URL_LIGHT, {
        subdomains: TILE_SUBDOMAINS,
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:26px;height:26px;">
                 <div style="position:absolute;inset:0;border-radius:9999px;background:${accent};opacity:0.18;transform:scale(2.3);"></div>
                 <div style="position:absolute;inset:0;border-radius:9999px;background:${accent};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
               </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([lat, lng], { icon }).addTo(map);

      mapRef.current = map;
      setReady(true);

      // Container size can settle a tick after mount (animations, flex reflow,
      // an initially-hidden panel) — keep the map's canvas in sync.
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Swap tile source when theme changes, without re-creating the whole map
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((mod) => {
      const L = mod.default;
      if (tileLayerRef.current) {
        mapRef.current!.removeLayer(tileLayerRef.current);
      }
      const tileLayer = L.tileLayer(dark ? TILE_URL_DARK : TILE_URL_LIGHT, {
        subdomains: TILE_SUBDOMAINS,
        maxZoom: 19,
      }).addTo(mapRef.current!);
      tileLayerRef.current = tileLayer;
    });
  }, [dark]);

  const externalUrl = mapsUrl || `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="h-full w-full" />

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gray-100 text-gray-400">
          <LocateFixed className="h-4 w-4 animate-pulse" />
          <span className="text-[10px]">Memuat peta…</span>
        </div>
      )}

      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-2 top-2 z-[1000] inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white/95 px-2 py-1 text-[9px] font-semibold text-gray-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-900"
      >
        <ExternalLink className="h-2.5 w-2.5" /> Google Maps
      </a>

      <div className="absolute bottom-2 left-2 z-[1000] rounded-lg border border-gray-200 bg-white/95 px-2 py-1 font-mono text-[9px] text-gray-500 shadow-sm backdrop-blur">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>
    </div>
  );
}