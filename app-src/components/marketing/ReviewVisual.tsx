import { Mono, Stars } from "@/components/marketing/parts";
import { cn } from "@/lib/cn";
import { reviewLikes } from "@/lib/content/module-reviews";

/** Phone + stat cards illustration for the Review Assistant module hero. */
export function ReviewVisual() {
  return (
    <div
      role="img"
      aria-label="Preview of the rating page: five stars, tap-to-pick chips, an AI-suggested review and a Copy and post on Google button, next to monthly review stats."
      className="flex flex-wrap items-center justify-center gap-7 border-t border-line bg-marble px-6 py-12 md:border-l md:border-t-0"
    >
      <div className="box-border flex h-[500px] w-[250px] max-w-full flex-col gap-4 rounded-[36px] border border-ink bg-white px-5 py-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-ink text-[13px] font-semibold text-white">[B]</div>
          <div>
            <div className="text-[13px] font-semibold">[Business name]</div>
            <Mono className="block text-[10px] text-muted">Table 4</Mono>
          </div>
        </div>
        <div className="disp text-2xl leading-[1.1]">How was your visit today?</div>
        <Stars size={30} gap="gap-1.5" />
        <Mono className="text-[10px] text-muted">WHAT DID YOU LIKE?</Mono>
        <div className="flex flex-wrap gap-1.5">
          {reviewLikes.map((l) => (
            <span
              key={l.t}
              className={cn(
                "border px-[9px] py-1.5 text-[11px]",
                l.on ? "border-ink bg-mist text-info-fg" : "border-line bg-white text-graphite",
              )}
            >
              {l.t}
            </span>
          ))}
        </div>
        <div className="bg-paper p-2.5 text-[11px] leading-[1.5] text-graphite">
          “Loved the filter coffee and the quick service. Staff were very friendly!”
          <Mono className="mt-1.5 block text-[9px] text-ink">AI SUGGESTION · EDIT FREELY</Mono>
        </div>
        <Mono className="mt-auto bg-ink py-[13px] text-center text-[11px] text-white">COPY &amp; POST ON GOOGLE</Mono>
      </div>
      <div className="flex flex-col gap-3">
        <div className="box-border w-[220px] max-w-full overflow-hidden rounded-card border border-line bg-white px-4 py-3.5">
          <Mono className="block text-[10px] text-muted">THIS MONTH</Mono>
          <div className="disp text-[34px] font-medium">[000]</div>
          <div className="text-xs text-graphite">new Google reviews</div>
        </div>
        <div className="box-border w-[220px] max-w-full overflow-hidden rounded-card border border-line bg-white px-4 py-3.5">
          <Mono className="block text-[10px] text-muted">AVG RATING</Mono>
          <div className="disp text-[34px] font-medium">[0.0]★</div>
          <div className="text-xs text-graphite">across 3 locations</div>
        </div>
        <div className="box-border w-[220px] max-w-full overflow-hidden rounded-card border border-ink bg-ink px-4 py-3.5 text-white">
          <Mono className="block text-[10px] text-lilac">PRIVATE FEEDBACK</Mono>
          <div className="mt-1.5 text-[13px]">4 open · 2 resolved today</div>
        </div>
      </div>
    </div>
  );
}
