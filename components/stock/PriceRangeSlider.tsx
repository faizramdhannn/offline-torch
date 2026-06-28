"use client";

import { useCallback, useId, useMemo, useState } from "react";

interface PriceRangeSliderProps {
  label: string;
  min: number;
  max: number;
  /** Current selected [min, max]. Pass the full [min, max] bounds when "no filter" is desired. */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Step size for dragging. Defaults to a sensible value based on the range. */
  step?: number;
  formatValue?: (v: number) => string;
}

/**
 * Dual-handle range slider built from two overlapping native <input type="range">
 * elements. No extra dependency needed — keeps full control over styling so it
 * matches the rest of the Stock filter bar (rounded-lg, gray-200 borders, primary accent).
 */
export function PriceRangeSlider({
  label,
  min,
  max,
  value,
  onChange,
  step,
  formatValue = (v) => v.toLocaleString("id-ID"),
}: PriceRangeSliderProps) {
  const reactId = useId();
  const safeMax = Math.max(max, min + 1);
  const effectiveStep = step ?? Math.max(1, Math.round((safeMax - min) / 100));

  const [localMin, localMax] = value;

  const minPct = useMemo(
    () => ((localMin - min) / (safeMax - min)) * 100,
    [localMin, min, safeMax]
  );
  const maxPct = useMemo(
    () => ((localMax - min) / (safeMax - min)) * 100,
    [localMax, min, safeMax]
  );

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.min(Number(e.target.value), localMax);
      onChange([next, localMax]);
    },
    [localMax, onChange]
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.max(Number(e.target.value), localMin);
      onChange([localMin, next]);
    },
    [localMin, onChange]
  );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        <span className="text-[10px] font-medium text-gray-500">
          Rp {formatValue(localMin)} – Rp {formatValue(localMax)}
        </span>
      </div>

      <div className="relative h-[36px] sm:h-[30px]">
        {/* Track */}
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200" />
        {/* Active range fill */}
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
        />

        <input
          id={`${reactId}-min`}
          type="range"
          min={min}
          max={safeMax}
          step={effectiveStep}
          value={localMin}
          onChange={handleMinChange}
          className="price-range-thumb pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent"
          style={{ zIndex: localMin > safeMax - effectiveStep ? 5 : 3 }}
          aria-label={`${label} minimum`}
        />
        <input
          id={`${reactId}-max`}
          type="range"
          min={min}
          max={safeMax}
          step={effectiveStep}
          value={localMax}
          onChange={handleMaxChange}
          className="price-range-thumb pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 w-full -translate-y-1/2 appearance-none bg-transparent"
          style={{ zIndex: 4 }}
          aria-label={`${label} maximum`}
        />
      </div>

      <style jsx>{`
        .price-range-thumb {
          pointer-events: none;
        }
        .price-range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #0d334d;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          margin-top: 0;
        }
        .price-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #0d334d;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
        .price-range-thumb::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
