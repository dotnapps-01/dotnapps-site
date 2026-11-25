"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Visible label. If omitted, pass `aria-label`. */
  label?: string;
  "aria-label"?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/** Switch: a real <button role="switch">, 38×22, black when on. */
export function Toggle({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const id = useId();
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  const toggle = () => {
    const next = !on;
    if (checked === undefined) setInner(next);
    onCheckedChange?.(next);
  };
  const sw = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative inline-block h-[22px] w-[38px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-ink" : "bg-track",
        !label && className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-knob transition-[left]",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
  if (!label) return sw;
  return (
    <span className={cn("inline-flex items-center gap-3 text-sm", className)}>
      {sw}
      <label htmlFor={id} className="cursor-pointer select-none text-graphite">
        {label}
      </label>
    </span>
  );
}
