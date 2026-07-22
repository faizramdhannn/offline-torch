"use client";

/**
 * Chart tick & tooltip renderers for recharts — moved verbatim from the
 * original page (no visual or logic changes) so the Store/PCA charts
 * keep their exact appearance and behavior.
 */

export const CustomXTick = ({ x, y, payload }: any) => {
  const name: string = payload.value || "";
  const maxLen = 11;
  const label = name.length > maxLen ? name.slice(0, maxLen) + "…" : name;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={8.5}>
        {label}
      </text>
    </g>
  );
};

export const CustomTooltip = ({ active, payload, label, metricLabel = "Stock" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          padding: "10px 14px",
          minWidth: "140px",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{metricLabel}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>
              {payload[0].value.toLocaleString()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>SKU</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>
              {payload[0].payload.sku}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const PCATooltip = ({ active, payload, label, metricLabel = "Stock" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          padding: "10px 14px",
          minWidth: "140px",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{metricLabel}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>
            {payload[0].value.toLocaleString()}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const CategoryTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const half = Math.ceil(payload.length / 2);
    const col1 = payload.slice(0, half);
    const col2 = payload.slice(half);
    return (
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          padding: "10px 14px",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>{label}</p>
        <div style={{ display: "flex", gap: 20 }}>
          {[col1, col2]
            .filter((col) => col.length > 0)
            .map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {col.map((p: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: p.color,
                        flexShrink: 0,
                        opacity: Number(p.value) === 0 ? 0.25 : 1,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        width: 72,
                        color: Number(p.value) === 0 ? "#475569" : "#94a3b8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.dataKey}:
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        minWidth: 28,
                        textAlign: "right",
                        color: Number(p.value) === 0 ? "#334155" : "#e2e8f0",
                      }}
                    >
                      {Number(p.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    );
  }
  return null;
};