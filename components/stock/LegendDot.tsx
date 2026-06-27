"use client";

interface LegendDotProps {
  color: string;
  label: string;
}

export function LegendDot({ color, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}