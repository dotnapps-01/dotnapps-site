import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { Field, controlClasses } from "./Field";

type Props = { label: string; hint?: string; error?: string; hideLabel?: boolean; wrapperClassName?: string } & Omit<
  ComponentPropsWithoutRef<"select">,
  "id"
>;

/** Native <select> (best on phones) with a custom chevron. */
export function Select({ label, hint, error, hideLabel, wrapperClassName, className, children, ...rest }: Props) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            {...rest}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlClasses, "appearance-none pr-10", className)}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-graphite"
          />
        </div>
      )}
    </Field>
  );
}
