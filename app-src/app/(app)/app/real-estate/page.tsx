import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { PageBody, PageHeader } from "@/components/app/PageHeader";
import { PlotBoard } from "@/components/realestate/PlotBoard";
import { PlotImport } from "@/components/realestate/PlotImport";
import { ProjectBar } from "@/components/realestate/ProjectBar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { KpiStrip, KpiTile } from "@/components/ui/KpiTile";
import { Pill } from "@/components/ui/Pill";
import { Table, TableBody, TableHead, TableRow, Td, Th } from "@/components/ui/Table";
import { currentWorkspace } from "@/lib/auth/current";
import { priceText } from "@/lib/ops-input";
import { listEnquiries, listPlots, listProjects, projectStats } from "@/lib/realestate";

export const metadata: Metadata = { title: "Real estate plots" };
export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-IN");

export default async function RealEstatePage({ searchParams }: { searchParams: Promise<{ project?: string; plot?: string; new?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const projects = await listProjects(ws.id);
  const current = projects.find((p) => p.id === sp.project) ?? projects[0] ?? null;
  const [plots, stats, enquiries] = current ? await Promise.all([listPlots(ws.id, current.id), projectStats(ws.id, current.id), listEnquiries(ws.id, current.id)]) : [[], null, []];
  const plotNo = Number(sp.plot);

  return (
    <>
      <PageHeader
        eyebrow="Operate"
        title="Real estate plots"
        actions={
          <>
            {current && can(ws.role, "build") ? (
              <Link href={`/app/real-estate?project=${current.id}#import`} className="inline-flex min-h-10 items-center rounded-full border border-ink bg-white px-4 text-[15px] font-medium text-ink no-underline hover:bg-mist">
                Import plots CSV
              </Link>
            ) : null}
          </>
        }
      />
      <PageBody>
        {!current && !can(ws.role, "build") ? (
          <p role="status" className="m-0 rounded-card border border-line bg-white p-5 text-sm text-graphite">No projects yet. The owner or a manager sets projects and plots up; they will show here once they do.</p>
        ) : null}
        <ProjectBar projects={projects} current={current} startOpen={sp.new === "1"} canBuild={can(ws.role, "build")} />
        {current && stats ? (
          <>
            <KpiStrip>
              <KpiTile variant="cell" label="Plots" value={fmt(stats.plots)} delta={current.name} tone="flat" />
              <KpiTile variant="cell" label="Available" value={fmt(stats.available)} delta={`${stats.availablePct}%`} tone="flat" />
              <KpiTile variant="cell" label="Booked / sold" value={fmt(stats.bookedSold)} delta={stats.valueLakh === null ? "₹[0.0] Cr value" : `${priceText(stats.valueLakh)} value`} tone="flat" />
              <KpiTile variant="cell" label="Plot QR scans" value={fmt(stats.scans30)} delta="last 30 days" tone="flat" />
              <KpiTile variant="cell" label="Site visits asked" value={fmt(stats.visits)} delta="from QR enquiries" tone="flat" />
            </KpiStrip>
            <PlotBoard key={current.id} project={current} plots={plots} initialNumber={Number.isInteger(plotNo) ? plotNo : null} canBuild={can(ws.role, "build")} />
            {can(ws.role, "build") ? <PlotImport projectId={current.id} /> : null}
            <Card>
              <CardHeader>
                <CardTitle>Enquiries from plot QR codes</CardTitle>
                <Link href="/app/leads" className="text-[13px] font-semibold">
                  Open in Leads →
                </Link>
              </CardHeader>
              <Table caption="Plot enquiries">
                <TableHead>
                  <TableRow>
                    <Th>Buyer</Th>
                    <Th>Plot</Th>
                    <Th>Asked for</Th>
                    <Th>Source</Th>
                    <Th>Site visit</Th>
                    <Th>Owner</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enquiries.length === 0 ? (
                    <TableRow>
                      <Td colSpan={6} className="text-muted">
                        No enquiries yet. Make a QR for a plot, put it on the plot stone, and buyers&rsquo; questions land here and in Leads.
                      </Td>
                    </TableRow>
                  ) : (
                    enquiries.map((e) => (
                      <TableRow key={e.id}>
                        <Td className="font-semibold">
                          {e.name}
                          <div className="tabular text-[11px] font-normal text-muted">{e.phone}</div>
                        </Td>
                        <Td className="tabular">{e.plotNumber}</Td>
                        <Td>{e.ask}</Td>
                        <Td>
                          <Pill>{e.source}</Pill>
                        </Td>
                        <Td>{e.visit || "—"}</Td>
                        <Td>{e.owner || "Unassigned"}</Td>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {can(ws.role, "build") ? (
              <p role="note" className="m-0 border-t border-line-soft px-[18px] py-3 text-xs text-muted">
                A QR code is made per plot from the panel above (it uses one of your dynamic codes). Printing a whole sheet of plot QRs at once needs bulk creation, which isn&rsquo;t built yet.
              </p>
              ) : null}
            </Card>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
