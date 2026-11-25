import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom tokens so later classes override earlier ones.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label"] }],
      rounded: [{ rounded: ["input", "card", "panel", "hero", "frame"] }],
      shadow: [{ shadow: ["soft", "knob"] }],
    },
  },
});

/** Join conditional class names; conflicting Tailwind classes resolve to the last one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
