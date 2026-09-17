"use client";

import { cn } from "@/lib/utils";

type ToggleSize = "sm" | "md";

const SIZE_CLASSES: Record<ToggleSize, { track: string; knob: string; translate: string }> = {
  sm: { track: "h-5 w-9", knob: "h-3.5 w-3.5", translate: "translate-x-4" },
  md: { track: "h-6 w-11", knob: "h-4.5 w-4.5", translate: "translate-x-5" },
};

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: ToggleSize;
  className?: string;
  "aria-label"?: string;
}

/** Liquid Glass on/off switch. */
export function Toggle({ checked, onChange, disabled, size = "md", className, ...aria }: ToggleProps) {
  const s = SIZE_CLASSES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "glass-toggle relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        s.track,
        className
      )}
      {...aria}
    >
      <span
        className={cn(
          "glass-toggle-knob inline-block rounded-full transition-transform",
          s.knob,
          checked ? s.translate : "translate-x-0.5"
        )}
      />
    </button>
  );
}
