import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/NewBadge";

/** Stand-in for marketing / auth pages built in Phases 2–3. */
export function SitePlaceholder({
  title,
  phase,
  designFile,
}: {
  title: string;
  phase: number;
  designFile: string;
}) {
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-frame flex-col items-start justify-center gap-5 px-5 py-16 sm:px-8">
      <Eyebrow>Built in Phase {phase}</Eyebrow>
      <h1 className="m-0 font-display text-[clamp(36px,6vw,64px)] font-semibold leading-none tracking-display">{title}</h1>
      <p className="m-0 max-w-xl text-[17px] leading-relaxed text-graphite">
        This page is a placeholder. The design reference is{" "}
        <code className="rounded bg-mist px-1.5 py-0.5 text-sm">design/{designFile}</code>.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Button href="/styleguide" variant="primary">
          View the style guide
        </Button>
        <Button href="/app/dashboard">Open the app</Button>
      </div>
    </section>
  );
}
