import { QRMark } from "@/components/qr/QRMark";
import { Logo } from "@/components/site/Logo";
import { AuthForm } from "./AuthForm";

const points = [
  { n: "01", t: "Free forever for one location" },
  { n: "02", t: "Workspace set up for your industry" },
  { n: "03", t: "Works with any phone camera — no app" },
];

/** Two-column sign-up / log-in screen (design/SignUp.dc.html). */
export function AuthScreen({ mode }: { mode: "signup" | "login" }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <div className="flex min-w-0 flex-[1_1_520px] flex-col px-5 py-7 sm:px-[clamp(20px,5vw,72px)]">
        <header>
          <Logo />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-12">
          <AuthForm mode={mode} />
        </main>
      </div>
      <aside
        className="on-dark flex min-w-0 flex-[1_1_480px] flex-col justify-center gap-9 bg-ink p-[clamp(40px,6vw,88px)] text-white"
        style={{ backgroundImage: "radial-gradient(#2A2A30 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        <div className="self-start bg-white p-5">
          <QRMark value="https://skn.to/demo" variant="halftone" size={200} quiet={false} label="Sample Skanor QR code" />
        </div>
        <h2 className="m-0 max-w-[520px] font-display text-[clamp(32px,3.6vw,48px)] font-semibold leading-[1.05] tracking-display">
          One QR. Reviews, leads, loyalty and more.
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {points.map((p) => (
            <li key={p.n} className="flex gap-3 text-[15px] text-[#D6D6DC]">
              <span className="tabular text-lilac">{p.n}</span>
              {p.t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
