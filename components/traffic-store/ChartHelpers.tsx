"use client";

export const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 160 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.name || p.dataKey}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: p.fill || p.color || p.stroke || "#60a5fa" }}>
            {p.value?.toLocaleString?.() ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const PieSliceTooltip = ({ active, payload, total }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = total ? ((Number(item.value) / total) * 100).toFixed(1) : "0";
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", minWidth: 180 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{item.name}</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Jumlah</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: item.payload?.fill || "#60a5fa" }}>{Number(item.value).toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>Persentase</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{pct}%</span>
      </div>
    </div>
  );
};

export function PieLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
          <span className="text-[11px] text-gray-500">{d.name}</span>
        </div>
      ))}
    </div>
  );
}
