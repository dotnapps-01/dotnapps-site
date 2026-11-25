"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { T, type IssueKey } from "@/lib/review-i18n";
import type { FeedbackItem, FeedbackStatus } from "@/lib/reviews";

const TONE: Record<FeedbackStatus, { tone: PillTone; text: string }> = {
  open: { tone: "warning", text: "OPEN" },
  in_progress: { tone: "info", text: "IN PROGRESS" },
  resolved: { tone: "success", text: "RESOLVED" },
};

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/** Private feedback inbox: read each note and move it open, in progress or resolved. */
export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [note, setNote] = useState("");
  const shown = items.filter((i) => filter === "all" || i.status === filter);

  async function setStatus(id: string, status: FeedbackStatus) {
    setNote("");
    const res = await fetch(`/api/feedback/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) router.refresh();
    else setNote("We couldn't update that. Please try again.");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[18px] py-3">
        <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} wrapperClassName="w-auto min-w-[180px]" className="min-h-10 text-sm">
          <option value="all">All feedback ({items.length})</option>
          <option value="open">Open ({items.filter((i) => i.status === "open").length})</option>
          <option value="in_progress">In progress ({items.filter((i) => i.status === "in_progress").length})</option>
          <option value="resolved">Resolved ({items.filter((i) => i.status === "resolved").length})</option>
        </Select>
        {note ? (
          <p role="alert" className="m-0 text-sm text-danger-fg">
            {note}
          </p>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="m-0 p-[18px] text-sm text-graphite">{items.length === 0 ? "No private feedback yet. It lands here when a customer who rates 1–3 stars chooses “Send to the manager”." : "Nothing in this view."}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {shown.map((f) => (
            <li key={f.id} id={`fb-${f.id}`} className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="m-0 max-w-[60ch] text-[14.5px] font-medium leading-[1.5]">“{f.message}”</p>
                <Pill tone={TONE[f.status].tone}>{TONE[f.status].text}</Pill>
              </div>
              {f.chips.length ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {f.chips.map((c) => (
                    <li key={c} className="tabular border border-line bg-white px-2 py-1 text-[11px]">
                      {T.en.issues[c as IssueKey] ?? c}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="tabular text-[11px] text-muted">
                {[f.rating ? `${f.rating}★` : null, f.source || f.qrName, f.staff && `with ${f.staff}`, ago(f.createdAt)].filter(Boolean).join(" · ")}
                {f.phone ? (
                  <>
                    {" · "}
                    <a href={`tel:${f.phone}`} className="font-semibold text-ink underline underline-offset-2">
                      {f.phone}
                    </a>
                  </>
                ) : null}
              </div>
              <Select
                label={`Status for feedback: ${f.message.slice(0, 40)}`}
                hideLabel
                value={f.status}
                onChange={(e) => setStatus(f.id, e.target.value as FeedbackStatus)}
                wrapperClassName="w-auto max-w-[200px]"
                className="min-h-9 text-[13px]"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
