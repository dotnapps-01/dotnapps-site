import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { PERMISSION_TEXT, ROLE_LABEL, type Permission, type Role } from "@/lib/permissions";

/** What a screen shows when the person's role doesn't allow it. */
export function NoAccess({ role, need }: { role: Role; need: Permission }) {
  return (
    <>
      <PageHeader eyebrow="Restricted" title="This screen isn't available to your role" />
      <PageBody>
        <div role="status" className="flex max-w-[560px] flex-col gap-3 rounded-card border border-line bg-surface p-[22px]">
          <p className="m-0 text-[15px] leading-[1.6] text-graphite">
            You&rsquo;re signed in as <strong className="text-ink">{ROLE_LABEL[role]}</strong>, and that role can&rsquo;t {PERMISSION_TEXT[need]}. Ask the owner if you need it: they can change your role in Settings → Team &amp; roles.
          </p>
          <div>
            <a href="/app/dashboard" className={buttonClasses({ variant: "primary", size: "sm" })}>
              Back to the dashboard
            </a>
          </div>
        </div>
      </PageBody>
    </>
  );
}
