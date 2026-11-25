"use client";

import { useId, useState } from "react";

/** Footer newsletter box. Not wired to a mailing list yet (Phase 2). */
export function NewsletterForm() {
  const id = useId();
  const [note, setNote] = useState("");
  return (
    <form
      aria-label="Newsletter"
      className="flex max-w-[380px] flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setNote("Newsletter sign-up isn't connected yet. Please check back soon.");
      }}
    >
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder="you@business.com"
        className="min-h-11 flex-[1_1_200px] rounded-input border border-[#3A3A42] bg-[#1A1A1F] px-3.5 text-sm text-white placeholder:text-[#9A9AA3]"
      />
      <button
        type="submit"
        className="min-h-11 rounded-full bg-white px-5 text-xs font-medium uppercase tracking-[0.05em] text-ink hover:bg-mist"
      >
        Subscribe
      </button>
      {note ? (
        <p role="status" className="m-0 w-full text-xs text-[#B8B8C0]">
          {note}
        </p>
      ) : null}
    </form>
  );
}
