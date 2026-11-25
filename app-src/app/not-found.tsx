import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <h1 className="m-0 font-display text-[clamp(32px,7vw,56px)] font-semibold leading-none tracking-display">We couldn&rsquo;t find that page.</h1>
      <p className="m-0 max-w-sm text-base text-graphite">The link may be wrong, or the QR code may have been removed.</p>
      <Button href="/" variant="primary">
        Go to Skanor
      </Button>
    </main>
  );
}
