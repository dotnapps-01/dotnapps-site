import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Scrolls horizontally on narrow screens instead of breaking the layout. */
export function Table({
  caption,
  className,
  children,
  ...rest
}: { caption?: string } & ComponentPropsWithoutRef<"table">) {
  return (
    <div className="overflow-x-auto">
      <table {...rest} className={cn("w-full border-collapse", className)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export const TableHead = (p: ComponentPropsWithoutRef<"thead">) => <thead {...p} />;
export const TableBody = (p: ComponentPropsWithoutRef<"tbody">) => <tbody {...p} />;
export const TableRow = (p: ComponentPropsWithoutRef<"tr">) => <tr {...p} />;

export function Th({ className, scope = "col", ...rest }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      scope={scope}
      {...rest}
      className={cn(
        "whitespace-nowrap border-b border-line-soft bg-thead px-[18px] py-3 text-left text-[11px] font-medium uppercase tracking-[0.02em] text-muted",
        className,
      )}
    />
  );
}

export function Td({ className, ...rest }: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      {...rest}
      className={cn("whitespace-nowrap border-b border-line-soft px-[18px] py-3 text-left text-[13.5px]", className)}
    />
  );
}
