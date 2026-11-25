import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  href?: string;
  label?: string;
  /** "dark" = black mark on light bg, "light" = white mark on dark bg */
  tone?: "dark" | "light";
  /** mark size in px (26 site, 22 app sidebar) */
  size?: number;
  className?: string;
};

export function LogoMark({ size = 26, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const stroke = tone === "dark" ? "#0E0E10" : "#FFFFFF";
  const fill = tone === "dark" ? "#0E0E10" : "#CDBDFF";
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="22" height="22" fill="none" stroke={stroke} strokeWidth="4" />
      <rect x="9" y="9" width="8" height="8" fill={fill} />
    </svg>
  );
}

export function Logo({ href = "/", label = "Skanor home", tone = "dark", size = 26, className }: Props) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex items-center gap-2.5 no-underline",
        tone === "dark" ? "text-ink hover:text-ink" : "text-white hover:text-white",
        className,
      )}
    >
      <LogoMark size={size} tone={tone} />
      <span
        className="font-display font-semibold leading-none tracking-heading"
        style={{ fontSize: size >= 26 ? 22 : 20 }}
      >
        skanor
      </span>
    </Link>
  );
}
