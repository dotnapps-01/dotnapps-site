import { Field, bigControl, captionLabel } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/** Indian mobile number input with the fixed +91 prefix (design/SignUp.dc.html). */
export function PhoneField({
  error,
  name = "phone",
  value,
  onChange,
}: {
  error?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Mobile number" error={error} labelClassName={captionLabel}>
      {({ id, describedBy, invalid }) => (
        <div className="flex">
          <span
            aria-hidden="true"
            className="tabular flex min-h-12 items-center rounded-l-input border border-r-0 border-track bg-paper px-3 text-sm"
          >
            +91
          </span>
          <input
            id={id}
            name={name}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label="Mobile number, after +91"
            className={cn(
              "w-full rounded-l-none rounded-r-input border bg-surface px-3.5 text-ink aria-[invalid=true]:border-danger-fg",
              bigControl,
            )}
          />
        </div>
      )}
    </Field>
  );
}
