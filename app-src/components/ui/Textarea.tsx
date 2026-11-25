import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { Field, controlClasses } from "./Field";

type Props = { label: string; hint?: string; error?: string; hideLabel?: boolean; wrapperClassName?: string } & Omit<
  ComponentPropsWithoutRef<"textarea">,
  "id"
>;

export function Textarea({ label, hint, error, hideLabel, wrapperClassName, className, rows = 4, ...rest }: Props) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          rows={rows}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClasses, "min-h-24 resize-y py-3 leading-relaxed", className)}
        />
      )}
    </Field>
  );
}
