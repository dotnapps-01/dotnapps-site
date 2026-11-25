"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/** Six single-digit boxes with auto-advance, backspace, arrow keys, paste and SMS/WhatsApp autofill. */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (digits: string, at: number) => {
    const chars = value.padEnd(length, " ").split("");
    const clean = digits.replace(/\D/g, "");
    if (!clean) {
      chars[at] = " ";
    } else {
      // handles typing one digit, pasting several, or OS autofill into a single box
      for (let k = 0; k < clean.length && at + k < length; k++) chars[at + k] = clean[k];
    }
    const next = chars.join("").replace(/ +$/, "");
    onChange(next.replace(/ /g, ""));
    if (clean) focus(Math.min(at + clean.length, length - 1));
    const full = chars.join("").replace(/ /g, "");
    if (clean && full.length === length && !chars.includes(" ")) onComplete?.(full);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace" && !value[i]) {
      e.preventDefault();
      if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault();
    commit(e.clipboardData.getData("text"), i);
  };

  return (
    <div role="group" aria-label="One-time code" className="flex gap-2.5">
      {Array.from({ length }, (_, i) => (
        <label key={i} className="contents">
          <span className="sr-only">
            Digit {i + 1} of {length}
          </span>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            value={value[i] ?? ""}
            onChange={(e) => commit(e.target.value, i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            onFocus={(e) => e.target.select()}
            className={cn(
              "tabular h-[60px] w-full min-w-0 max-w-14 flex-1 rounded-input border border-track bg-white text-center text-2xl disabled:bg-paper",
              invalid && "border-danger-fg",
            )}
          />
        </label>
      ))}
    </div>
  );
}
