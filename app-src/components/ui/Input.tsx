import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { Field, controlClasses } from "./Field";

type Props = { label: string; hint?: string; error?: string; hideLabel?: boolean; wrapperClassName?: string; labelClassName?: string } & Omit<
  ComponentPropsWithoutRef<"input">,
  "id"
>;

export function Input({ label, hint, error, hideLabel, wrapperClassName, labelClassName, className, ...rest }: Props) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName} labelClassName={labelClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClasses, className)}
        />
      )}
    </Field>
  );
}
