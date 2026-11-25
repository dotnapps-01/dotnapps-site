import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Soft white card: 1px line border, 16px radius (20px with `large`). */
export function Card({
  large,
  className,
  ...rest
}: { large?: boolean } & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...rest}
      className={cn(
        "min-w-0 overflow-hidden border border-line bg-surface",
        large ? "rounded-panel" : "rounded-card",
        className,
      )}
    />
  );
}

/** Card header row (".ch" in the app screens): title left, actions right. */
export function CardHeader({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...rest}
      className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-line px-[18px] py-3.5", className)}
    />
  );
}

export function CardTitle({ className, ...rest }: ComponentPropsWithoutRef<"h2">) {
  return <h2 {...rest} className={cn("m-0 text-[15px] font-semibold", className)} />;
}
