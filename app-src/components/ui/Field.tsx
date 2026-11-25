import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** receives the ids to wire onto the control */
  children: (a11y: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  /** hide the visible label but keep it for screen readers */
  hideLabel?: boolean;
  labelClassName?: string;
};

/** Shared real-<label> wrapper for Input, Select and Textarea. */
export function Field({ label, hint, error, className, children, hideLabel, labelClassName }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-[13px] font-semibold text-ink", labelClassName, hideLabel && "sr-only")}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-err`} className="m-0 text-xs text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClasses =
  "w-full min-h-11 rounded-input border border-line bg-surface px-3.5 text-sm font-normal text-ink placeholder:text-faint disabled:bg-paper disabled:text-muted aria-[invalid=true]:border-danger-fg";
