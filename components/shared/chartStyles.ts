/**
 * Shared Recharts chrome (palette, tooltip, axis/grid styling) so every
 * chart in the app (order-report, analytics-order, sales, stock,
 * traffic-store, canvasing) renders with the same look — same font sizes,
 * grid color, tooltip shape — instead of each page inventing its own.
 *
 * Does not apply to attendance's Chart.js dashboards, which use
 * semantically-coded status colors (P/S/F/MF/etc.) on a different
 * charting library — those are intentionally left untouched.
 */
export const CHART_PALETTE = ["#0d334d", "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

export const chartTooltipStyle: Record<string, string | number> = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

export const chartAxisTick = { fontSize: 10, fill: "#94a3b8" };
export const chartGridStroke = "#f1f5f9";
