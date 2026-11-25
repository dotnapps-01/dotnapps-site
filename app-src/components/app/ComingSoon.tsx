import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

/** Placeholder body for routes whose real screen lands in a later build phase. */
export function ComingSoon({ name, phase, designFile }: { name: string; phase: number; designFile: string }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-start gap-4 p-6">
        <Pill tone="info">PHASE {phase}</Pill>
        <h2 className="m-0 font-display text-[28px] font-semibold tracking-sub">{name}</h2>
        <p className="m-0 text-[15px] leading-relaxed text-graphite">
          This screen is built in Phase {phase}. The design reference is{" "}
          <code className="rounded bg-mist px-1.5 py-0.5 text-[13px]">design/{designFile}</code>.
        </p>
        <Button href="/app/dashboard" size="sm">
          Back to dashboard
        </Button>
      </div>
    </Card>
  );
}
