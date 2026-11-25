import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "md" | "nav" | "sm";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full border border-ink font-medium whitespace-nowrap no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:border-ink-2 hover:bg-ink-2 hover:text-white",
  secondary: "bg-surface text-ink hover:bg-mist hover:text-ink",
};
const sizes: Record<Size, string> = {
  md: "min-h-12 px-[22px] text-[15px] leading-none",
  nav: "min-h-11 px-[18px] text-[15px] leading-none",
  sm: "min-h-9 px-3.5 text-[13px] leading-none",
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; children?: ReactNode; className?: string };

type ButtonAsButton = CommonProps & Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentPropsWithoutRef<typeof Link>, keyof CommonProps> & { href: string };

/**
 * Pill button. Renders a real <button>, or a <Link> when `href` is given.
 * Primary = black fill, secondary = white with 1px ink border.
 */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant, size, className, children, ...rest } = props;
  const cls = buttonClasses({ variant, size, className });
  if ("href" in rest && rest.href !== undefined) {
    return (
      <Link {...(rest as Omit<ButtonAsLink, keyof CommonProps>)} className={cls}>
        {children}
      </Link>
    );
  }
  const { type = "button", ...btn } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button type={type} {...btn} className={cls}>
      {children}
    </button>
  );
}

/** Square-ish icon-only button. `label` becomes the aria-label (required). */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: { label: string } & Omit<ComponentPropsWithoutRef<"button">, "aria-label">) {
  return (
    <button
      type={type}
      aria-label={label}
      {...rest}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink bg-surface text-ink transition-colors hover:bg-mist",
        className,
      )}
    >
      {children}
    </button>
  );
}
