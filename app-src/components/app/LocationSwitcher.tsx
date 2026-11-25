"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Loc = { id: string; name: string };

/** Location dropdown in the sidebar header. Button + listbox, closes on Esc / outside click. */
export function LocationSwitcher({
  locations,
  defaultId,
  onChange,
}: {
  locations: Loc[];
  defaultId?: string;
  onChange?: (id: string) => void;
}) {
  const [selected, setSelected] = useState(defaultId ?? locations[0]?.id);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = locations.find((l) => l.id === selected) ?? locations[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    setSelected(id);
    setOpen(false);
    trigger.current?.focus();
    onChange?.(id);
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-input border border-line bg-paper px-3 text-left text-ink hover:bg-mist"
      >
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">Location</span>
          <span className="truncate text-[13px] font-semibold">{current?.name}</span>
        </span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={cn("flex-none text-graphite transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Switch location"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 m-0 list-none overflow-hidden rounded-input border border-line bg-surface p-1 shadow-soft"
        >
          {locations.map((l) => {
            const on = l.id === selected;
            return (
              <li key={l.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(l.id)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] hover:bg-mist"
                >
                  <span className={cn("truncate", on && "font-semibold")}>{l.name}</span>
                  {on ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
