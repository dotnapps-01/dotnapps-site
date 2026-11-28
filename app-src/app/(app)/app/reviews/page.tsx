import { NoAccess } from "@/components/app/NoAccess";
import { can } from "@/lib/permissions";
import { Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { PathIcon } from "@/components/marketing/parts";
import { FeedbackList } from "@/components/review/FeedbackList";
import { SettingsForm } from "@/components/review/SettingsForm";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { currentWorkspace } from "@/lib/auth/current";
import { cn } from "@/lib/cn";
import { pctDelta } from "@/lib/analytics-range";
import { chipLabel, T, type IssueKey } from "@/lib/review-i18n";
import { getReviewSettings, getReviewStats, listFeedback, recentResponses, type FeedbackStatus } from "@/lib/reviews";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Reviews & feedback" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "inbox", label: "Inbox" },
  { key: "feedback", label: "Private feedback" },
  { key: "page", label: "Rating page" },
  { key: "staff", label: "Staff" },
  { key: "widgets", label: "Widgets" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmt = (n: number) => n.toLocaleString("en-IN");
const STATUS: Record<FeedbackStatus, { tone: PillTone; text: string }> = {
  open: { tone: "warning", text: "OPEN" },
  in_progress: { tone: "info", text: "IN PROGRESS" },
  resolved: { tone: "success", text: "RESOLVED" },
};

/** "A", "A and B" with each item in bold. */
function Bold({ items }: { items: string[] }) {
  return (
    <>
      {items.map((x, i) => (
        <span key={x}>
          {i > 0 ? " and " : ""}
          <b>{x}</b>
        </span>
      ))}
    </>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= n ? "#0E0E10" : "#E7E7EB"} aria-hidden="true">
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        </svg>
      ))}
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws.role, "reviews")) return <NoAccess role={ws.role} need="reviews" />;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "inbox";

  const [stats, responses, feedback, settings] = await Promise.all([
    getReviewStats(ws.id),
    recentResponses(ws.id, tab === "inbox" ? 12 : 1),
    listFeedback(ws.id),
    getReviewSettings(ws.id),
  ]);

  const avgDelta = stats.avg !== null && stats.prevAvg !== null ? Math.round((stats.avg - stats.prevAvg) * 10) / 10 : null;
  const countDelta = pctDelta(stats.count, stats.prevCount);
  const toGooglePct = stats.highRatings ? Math.round((stats.highToGoogle / stats.highRatings) * 100) : null;
  const total = stats.distribution.reduce((a, b) => a + b, 0);

  // plain-language summary computed from the numbers (not AI-written)
  const likes = stats.topPositive.slice(0, 2).map((t) => chipLabel("en", t.name));
  const gripes = stats.topNegative.slice(0, 2).map((t) => T.en.issues[t.name as IssueKey] ?? t.name);

  return (
    <>
      <PageHeader
        eyebrow="Engage"
        title="Reviews & feedback"
        actions={
          <>
            <Link href="/r/preview" target="_blank" className={buttonClasses()}>
              Preview rating page
            </Link>
            <Link href="/app/studio?type=review" className={buttonClasses({ variant: "primary" })}>
              New review QR
            </Link>
          </>
        }
      />
      <nav aria-label="Reviews sections" className="flex flex-wrap border-b border-line bg-surface px-[clamp(8px,1.6vw,20px)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "inbox" ? "/app/reviews" : `/app/reviews?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] no-underline",
              tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent text-graphite hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "feedback" && stats.feedbackOpen > 0 ? <Pill className="bg-ink text-white">{stats.feedbackOpen}</Pill> : null}
          </Link>
        ))}
      </nav>

      <PageBody>
        {tab === "inbox" && (
          <>
            <KpiStrip>
              <KpiTile
                variant="cell"
                label="Average rating"
                value={stats.avg === null ? "—" : `${stats.avg.toFixed(1)}★`}
                delta={avgDelta === null ? "Last 30 days" : `${avgDelta > 0 ? "▲" : avgDelta < 0 ? "▼" : ""} ${avgDelta === 0 ? "No change" : Math.abs(avgDelta)} vs previous 30 days`}
                tone={avgDelta === null || avgDelta === 0 ? "flat" : avgDelta > 0 ? "up" : "down"}
              />
              <KpiTile variant="cell" label="Ratings received" value={fmt(stats.count)} delta={countDelta?.text ?? "Last 30 days"} tone={countDelta?.dir === "up" ? "up" : countDelta?.dir === "down" ? "down" : "flat"} />
              <KpiTile variant="cell" label="Sent to Google" value={fmt(stats.googleClicks)} delta={toGooglePct === null ? "of 4–5★ visitors" : `${toGooglePct}% of 4–5★ visitors`} tone="flat" />
              <KpiTile variant="cell" label="Private feedback" value={fmt(stats.feedbackCount)} delta={`${stats.feedbackResolved} resolved · ${stats.feedbackOpen} open`} tone={stats.feedbackOpen > 0 ? "warn" : "flat"} />
            </KpiStrip>

            <section aria-labelledby="insight-h" className="overflow-hidden rounded-card border border-ink bg-ink text-white">
              <div className="flex flex-wrap items-start gap-5 px-5 py-[18px]">
                <div className="flex flex-[2_1_380px] flex-col gap-2.5">
                  <h2 id="insight-h" className="tabular m-0 flex items-center gap-2 font-sans text-[11px] font-normal text-lilac">
                    <Zap size={14} strokeWidth={2} aria-hidden="true" />
                    INSIGHTS · LAST 30 DAYS
                  </h2>
                  {stats.count === 0 ? (
                    <p className="m-0 text-base leading-[1.55]">No ratings yet. Create a Review QR and put it on a table or counter. Ratings, topics and complaints will show up here.</p>
                  ) : (
                    <p className="m-0 text-base leading-[1.55]">
                      {fmt(stats.count)} {stats.count === 1 ? "rating" : "ratings"} with an average of <b>{stats.avg?.toFixed(1)}★</b>.{" "}
                      {likes.length ? (
                        <>
                          Customers mention <Bold items={likes} /> most.{" "}
                        </>
                      ) : null}
                      {stats.feedbackCount > 0 ? (
                        <>
                          {stats.feedbackCount} private {stats.feedbackCount === 1 ? "note" : "notes"}
                          {gripes.length ? (
                            <>
                              , mostly about <Bold items={gripes} />
                            </>
                          ) : null}
                          .
                        </>
                      ) : (
                        "No private complaints."
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-[1_1_260px] flex-col gap-2.5">
                  <span className="tabular text-[11px] text-[#B8B8C0]">TOPICS</span>
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {stats.topPositive.map((t) => (
                      <li key={`p-${t.name}`} className="tabular border border-[#2E2E36] px-[9px] py-1.5 text-[11px] text-[#E7E7EB]">
                        + {chipLabel("en", t.name).toLowerCase()} · {t.n}
                      </li>
                    ))}
                    {stats.topNegative.map((t) => (
                      <li key={`n-${t.name}`} className="tabular border border-[#6A4A2A] px-[9px] py-1.5 text-[11px] text-[#F6C894]">
                        − {(T.en.issues[t.name as IssueKey] ?? t.name).toLowerCase()} · {t.n}
                      </li>
                    ))}
                    {stats.topPositive.length + stats.topNegative.length === 0 ? <li className="text-xs text-[#B8B8C0]">Topics appear once customers tap chips.</li> : null}
                  </ul>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-start gap-5">
              <Card className="flex-[2_1_560px]">
                <CardHeader>
                  <CardTitle>Recent ratings</CardTitle>
                  <span className="tabular text-[11px] text-muted">FROM YOUR RATING PAGES</span>
                </CardHeader>
                {responses.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 p-[18px]">
                    <p className="m-0 text-sm text-graphite">Nothing yet. When someone scans a Review QR and taps a star, it appears here.</p>
                    <Link href="/app/studio?type=review" className={buttonClasses({ size: "sm", variant: "primary" })}>
                      Create a review QR
                    </Link>
                  </div>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {responses.map((r) => (
                      <li key={r.id} className="flex flex-col gap-2 border-b border-line-soft px-[18px] py-3.5 last:border-b-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Stars n={r.rating} />
                            <span className="tabular text-[11px] text-muted">
                              {[r.source || r.qrName, r.staff && `with ${r.staff}`, timeAgo(new Date(r.createdAt))].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {r.googleClicked ? <Pill tone="success">WENT TO GOOGLE</Pill> : null}
                            {r.gaveFeedback ? <Pill tone="warning">PRIVATE NOTE</Pill> : null}
                            {!r.googleClicked && !r.gaveFeedback ? <Pill>RATED ONLY</Pill> : null}
                          </div>
                        </div>
                        {r.chips.length ? (
                          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                            {r.chips.map((c) => (
                              <li key={c} className="tabular border border-line bg-white px-2 py-1 text-[11px]">
                                {chipLabel("en", c)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Private feedback</CardTitle>
                    <Link href="/app/reviews?tab=feedback" className="tabular text-[11px] text-ink">
                      ALL FEEDBACK →
                    </Link>
                  </CardHeader>
                  {feedback.length === 0 ? (
                    <p className="m-0 p-[18px] text-sm text-graphite">No private feedback yet.</p>
                  ) : (
                    <ul className="m-0 list-none p-0">
                      {feedback.slice(0, 4).map((f) => (
                        <li key={f.id} className="flex flex-col gap-1.5 border-b border-line-soft px-[18px] py-3 last:border-b-0">
                          <div className="flex justify-between gap-2">
                            <span className="text-[13.5px] font-semibold">“{f.message.length > 60 ? `${f.message.slice(0, 60)}…` : f.message}”</span>
                            <Pill tone={STATUS[f.status].tone}>{STATUS[f.status].text}</Pill>
                          </div>
                          <span className="tabular text-[10.5px] text-muted">{[f.source, f.staff, timeAgo(new Date(f.createdAt))].filter(Boolean).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Rating split</CardTitle>
                    <span className="tabular text-[11px]">{stats.avg === null ? "NO RATINGS" : `${stats.avg.toFixed(1)} AVG`}</span>
                  </CardHeader>
                  <ul className="m-0 flex list-none flex-col gap-2 px-[18px] py-4">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const n = stats.distribution[s - 1];
                      return (
                        <li key={s} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "24px 1fr 40px" }}>
                          <span className="tabular text-xs">{s}★</span>
                          <div className="h-2 bg-mist">
                            <div className="h-2 bg-ink" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                          </div>
                          <span className="tabular text-right text-[11px] text-muted">{fmt(n)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Staff leaderboard</CardTitle>
                    <Link href="/app/reviews?tab=staff" className="tabular text-[11px] text-ink">
                      SEE ALL →
                    </Link>
                  </CardHeader>
                  {stats.staff.length === 0 ? (
                    <p className="m-0 p-[18px] text-sm text-graphite">Add a staff name when you create a Review QR to see who earns the best ratings.</p>
                  ) : (
                    <ol className="m-0 list-none p-0">
                      {stats.staff.slice(0, 4).map((s, i) => (
                        <li key={s.name} className="flex items-center gap-3 border-b border-line-soft px-[18px] py-2.5 last:border-b-0">
                          <span className="tabular w-[18px] text-xs">{String(i + 1).padStart(2, "0")}</span>
                          <span className="flex-1 text-[13.5px]">{s.name}</span>
                          <span className="tabular text-xs">{s.n} ratings</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Google reviews</CardTitle>
                <Pill tone="neutral">NOT CONNECTED</Pill>
              </CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <p className="m-0 max-w-[60ch] text-sm leading-[1.55] text-graphite">
                  Reading and replying to your Google reviews here needs your Google Business Profile connected, which arrives with Integrations. Customers can already post on Google from every rating page.
                </p>
                <Link href="/app/integrations" className={buttonClasses({ size: "sm" })}>
                  See Integrations
                </Link>
              </div>
            </Card>
          </>
        )}

        {tab === "feedback" && (
          <Card>
            <CardHeader>
              <CardTitle>Private feedback</CardTitle>
              <span className="tabular text-[11px] text-muted">
                {stats.feedbackOpen} OPEN · {feedback.length} TOTAL
              </span>
            </CardHeader>
            <FeedbackList items={feedback} />
          </Card>
        )}

        {tab === "page" && (
          <Card>
            <CardHeader>
              <CardTitle>Rating page settings</CardTitle>
              <Link href="/r/preview" target="_blank" className={buttonClasses({ size: "sm" })}>
                Open preview
              </Link>
            </CardHeader>
            <SettingsForm initial={settings} />
          </Card>
        )}

        {tab === "staff" && (
          <Card>
            <CardHeader>
              <CardTitle>Staff leaderboard</CardTitle>
              <span className="tabular text-[11px] text-muted">LAST 30 DAYS</span>
            </CardHeader>
            {stats.staff.length === 0 ? (
              <p className="m-0 p-[18px] text-sm text-graphite">
                Nothing yet. Create a Review QR for each team member (add their name in the “Staff member” field) and place it where they work. Ratings through their code are counted here.
              </p>
            ) : (
              <ol className="m-0 list-none p-0">
                {stats.staff.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-3 border-b border-line-soft px-[18px] py-3 last:border-b-0">
                    <span className="tabular w-[22px] text-xs">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 text-[14px] font-medium">{s.name}</span>
                    <span className="tabular text-xs text-muted">{s.avg.toFixed(1)}★ average</span>
                    <span className="tabular text-xs">{s.n} ratings</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

        {tab === "widgets" && (
          <Card>
            <CardHeader>
              <CardTitle>Review widgets</CardTitle>
              <Pill tone="neutral">SOON</Pill>
            </CardHeader>
            <div className="flex flex-col items-start gap-3 p-5">
              <PathIcon d="M4 4h16v16H4zM8 9h8M8 13h5" size={22} className="text-graphite" />
              <p className="m-0 max-w-[60ch] text-sm leading-[1.55] text-graphite">
                Show your best Google reviews on your own website. Widgets need your Google reviews, so they arrive after Google Business Profile is connected.
              </p>
              <Button disabled>Create widget (soon)</Button>
            </div>
          </Card>
        )}
      </PageBody>
    </>
  );
}
