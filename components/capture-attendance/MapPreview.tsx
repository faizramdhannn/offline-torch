"use client";

export function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200" style={{ height: 160 }}>
      <iframe
        title="location-map"
        width="100%"
        height="160"
        loading="lazy"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.002},${lat - 0.002},${lng + 0.002},${lat + 0.002}&layer=mapnik&marker=${lat},${lng}`}
        style={{ border: 0 }}
      />
    </div>
  );
}