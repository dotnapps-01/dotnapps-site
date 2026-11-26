"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ACCEPT, uploadFile, type Purpose, type UploadedFile } from "./upload";

/**
 * A button that opens the file picker, uploads the choice and hands back the stored file.
 * The visible button is a real <button>; the file input is kept for screen readers and keyboard users through it.
 */
export function UploadButton({
  purpose,
  label,
  onUploaded,
  variant = "secondary",
  size = "sm",
  disabled,
  className,
}: {
  purpose: Purpose;
  label: string;
  onUploaded: (f: UploadedFile) => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errId = useId();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    const r = await uploadFile(file, purpose);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (r.ok) onUploaded(r.file);
    else setError(r.message);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <input ref={input} type="file" accept={ACCEPT[purpose]} tabIndex={-1} aria-hidden="true" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant={variant} size={size} className={className} disabled={disabled || busy} aria-describedby={error ? errId : undefined} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      {error ? (
        <span id={errId} role="alert" className="max-w-[320px] text-xs leading-snug text-[#A8321F]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
