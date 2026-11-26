import "server-only";
import { query, tx } from "@/lib/db";
import { upsertContact } from "@/lib/engage";
import { ENQUIRY_ASKS, VISIT_SLOTS, priceText, type EnquiryInput, type PlotInput, type PlotRow as PlotImportRow, type PlotStatus, type ProjectInput } from "@/lib/ops-input";

const uuidRe = /^[0-9a-f-]{36}$/i;
const isUuid = (v: string) => uuidRe.test(v);

/* ---------- projects ---------- */

export type ProjectRecord = {
  id: string; name: string; approval: string; columns: number; roadAfter: number[]; brochureUrl: string; whatsapp: string;
  plots: number; available: number; hold: number; booked: number; sold: number;
};
type ProjectRow = { id: string; name: string; approval: string; columns: number; road_after: number[]; brochure_url: string; whatsapp: string; plots: number; available: number; hold: number; booked: number; sold: number };
const PROJECT_SELECT = `
  select p.id, p.name, p.approval, p.columns, p.road_after, p.brochure_url, p.whatsapp,
         count(l.id)::int as plots,
         count(l.id) filter (where l.status = 'available')::int as available,
         count(l.id) filter (where l.status = 'hold')::int as hold,
         count(l.id) filter (where l.status = 'booked')::int as booked,
         count(l.id) filter (where l.status = 'sold')::int as sold
    from re_projects p left join plots l on l.project_id = p.id`;
const toProject = (r: ProjectRow): ProjectRecord => ({
  id: r.id, name: r.name, approval: r.approval, columns: r.columns, roadAfter: r.road_after, brochureUrl: r.brochure_url, whatsapp: r.whatsapp,
  plots: r.plots, available: r.available, hold: r.hold, booked: r.booked, sold: r.sold,
});

export async function listProjects(workspaceId: string): Promise<ProjectRecord[]> {
  return (await query<ProjectRow>(`${PROJECT_SELECT} where p.workspace_id = $1 group by p.id order by p.created_at`, [workspaceId])).map(toProject);
}
export async function getProject(workspaceId: string, id: string): Promise<ProjectRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<ProjectRow>(`${PROJECT_SELECT} where p.id = $1 and p.workspace_id = $2 group by p.id`, [id, workspaceId]);
  return r ? toProject(r) : null;
}

export async function createProject(workspaceId: string, p: ProjectInput): Promise<string> {
  return tx(async (q) => {
    const [r] = await q.query<{ id: string }>(
      "insert into re_projects (workspace_id, name, approval, columns, road_after, brochure_url, whatsapp) values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [workspaceId, p.name, p.approval, p.columns, p.roadAfter, p.brochureUrl, p.whatsapp],
    );
    await q.query("insert into plots (workspace_id, project_id, number, approval) select $1, $2, n, $3 from generate_series(1, $4::int) n", [workspaceId, r.id, p.approval, p.plotCount ?? 0]);
    return r.id;
  });
}
export async function updateProject(workspaceId: string, id: string, p: ProjectInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query("update re_projects set name=$3, approval=$4, columns=$5, road_after=$6, brochure_url=$7, whatsapp=$8 where id=$1 and workspace_id=$2 returning id", [id, workspaceId, p.name, p.approval, p.columns, p.roadAfter, p.brochureUrl, p.whatsapp]);
  return rows.length > 0;
}
/** Deleting a project removes its plots. Refused while a live QR code points at one of them. */
export async function deleteProject(workspaceId: string, id: string): Promise<"ok" | "in_use" | "not_found"> {
  if (!(await getProject(workspaceId, id))) return "not_found";
  const [u] = await query<{ n: number }>(
    "select count(*)::int as n from qr_codes q join plots l on l.id::text = q.config->>'plotId' where q.workspace_id = $1 and q.status <> 'archived' and l.project_id = $2",
    [workspaceId, id],
  );
  if (u.n > 0) return "in_use";
  await query("delete from re_projects where id = $1 and workspace_id = $2", [id, workspaceId]);
  return "ok";
}

/* ---------- plots ---------- */

export type PlotRecord = {
  id: string; projectId: string; number: number; sizeSqft: number | null; dims: string; facing: string; priceLakh: number | null; approval: string; corner: boolean; status: PlotStatus;
  scans: number; enquiries: number; qrCodes: number; shortCode: string | null;
};
type PlotRow = { id: string; project_id: string; number: number; size_sqft: number | null; dims: string; facing: string; price_lakh: string | null; approval: string; corner: boolean; status: PlotStatus; scans: number; enquiries: number; qr_codes: number; short_code: string | null };
const PLOT_SELECT = `
  select l.id, l.project_id, l.number, l.size_sqft, l.dims, l.facing, l.price_lakh::text as price_lakh, l.approval, l.corner, l.status,
         (select count(*)::int from scans s join qr_codes q on q.id = s.qr_id where q.workspace_id = l.workspace_id and q.config->>'plotId' = l.id::text) as scans,
         (select count(*)::int from plot_enquiries e where e.plot_id = l.id) as enquiries,
         (select count(*)::int from qr_codes q where q.workspace_id = l.workspace_id and q.status <> 'archived' and q.config->>'plotId' = l.id::text) as qr_codes,
         (select q.short_code from qr_codes q where q.workspace_id = l.workspace_id and q.status = 'active' and q.config->>'plotId' = l.id::text order by q.created_at limit 1) as short_code
    from plots l`;
const toPlot = (r: PlotRow): PlotRecord => ({
  id: r.id, projectId: r.project_id, number: r.number, sizeSqft: r.size_sqft, dims: r.dims, facing: r.facing, priceLakh: r.price_lakh === null ? null : Number(r.price_lakh), approval: r.approval,
  corner: r.corner, status: r.status, scans: r.scans, enquiries: r.enquiries, qrCodes: r.qr_codes, shortCode: r.short_code,
});

export async function listPlots(workspaceId: string, projectId: string): Promise<PlotRecord[]> {
  if (!isUuid(projectId)) return [];
  return (await query<PlotRow>(`${PLOT_SELECT} where l.workspace_id = $1 and l.project_id = $2 order by l.number`, [workspaceId, projectId])).map(toPlot);
}
export async function getPlot(workspaceId: string, id: string): Promise<PlotRecord | null> {
  if (!isUuid(id)) return null;
  const [r] = await query<PlotRow>(`${PLOT_SELECT} where l.id = $1 and l.workspace_id = $2`, [id, workspaceId]);
  return r ? toPlot(r) : null;
}
export async function updatePlot(workspaceId: string, id: string, p: PlotInput): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await query("update plots set size_sqft=$3, dims=$4, facing=$5, price_lakh=$6, approval=$7, corner=$8, status=$9 where id=$1 and workspace_id=$2 returning id", [id, workspaceId, p.sizeSqft, p.dims, p.facing, p.priceLakh, p.approval, p.corner, p.status]);
  return rows.length > 0;
}
export async function importPlots(workspaceId: string, projectId: string, rows: PlotImportRow[]): Promise<{ added: number; updated: number } | null> {
  if (!(await getProject(workspaceId, projectId))) return null;
  return tx(async (q) => {
    let added = 0, updated = 0;
    for (const r of rows) {
      const [x] = await q.query<{ inserted: boolean }>(
        `insert into plots (workspace_id, project_id, number, size_sqft, dims, facing, price_lakh, approval, corner, status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (project_id, number) do update set size_sqft = excluded.size_sqft, dims = excluded.dims, facing = excluded.facing, price_lakh = excluded.price_lakh,
           approval = excluded.approval, corner = excluded.corner, status = excluded.status
         returning (xmax = 0) as inserted`,
        [workspaceId, projectId, r.number, r.sizeSqft, r.dims, r.facing, r.priceLakh, r.approval, r.corner, r.status],
      );
      if (x.inserted) added++;
      else updated++;
    }
    return { added, updated };
  });
}

export type ProjectStats = { plots: number; available: number; availablePct: number; bookedSold: number; valueLakh: number | null; scans30: number; visits: number };
export async function projectStats(workspaceId: string, projectId: string): Promise<ProjectStats> {
  const [r] = await query<{ plots: number; available: number; booked_sold: number; value: string | null; priced: number; scans30: number; visits: number }>(
    `select count(*)::int as plots,
            count(*) filter (where status = 'available')::int as available,
            count(*) filter (where status in ('booked','sold'))::int as booked_sold,
            sum(price_lakh) filter (where status in ('booked','sold'))::text as value,
            count(*) filter (where status in ('booked','sold') and price_lakh is not null)::int as priced,
            (select count(*)::int from scans s join qr_codes q on q.id = s.qr_id join plots l2 on l2.id::text = q.config->>'plotId'
              where q.workspace_id = $1 and l2.project_id = $2 and s.scanned_at > now() - interval '30 days') as scans30,
            (select count(*)::int from plot_enquiries e join plots l3 on l3.id = e.plot_id where l3.project_id = $2 and e.ask = 'visit') as visits
       from plots where workspace_id = $1 and project_id = $2`,
    [workspaceId, projectId],
  );
  return { plots: r.plots, available: r.available, availablePct: r.plots ? Math.round((r.available / r.plots) * 100) : 0, bookedSold: r.booked_sold, valueLakh: r.priced > 0 && r.value !== null ? Number(r.value) : null, scans30: r.scans30, visits: r.visits };
}

/** Every plot across the workspace's projects, labelled for the QR Studio's plot picker. */
export async function listPlotOptions(workspaceId: string): Promise<{ id: string; name: string }[]> {
  const rows = await query<{ id: string; number: number; project: string }>(
    "select l.id, l.number, p.name as project from plots l join re_projects p on p.id = l.project_id where l.workspace_id = $1 order by p.created_at, l.number limit 1500",
    [workspaceId],
  );
  return rows.map((r) => ({ id: r.id, name: `Plot ${r.number} · ${r.project}` }));
}

/* ---------- enquiries ---------- */

export type EnquiryRecord = { id: string; name: string; phone: string; plotNumber: number; project: string; ask: string; source: string; visit: string; owner: string; leadId: string | null; createdAt: string };
export async function listEnquiries(workspaceId: string, projectId: string, limit = 50): Promise<EnquiryRecord[]> {
  const rows = await query<{ id: string; name: string; phone: string; number: number; project: string; ask: string; source: string; visit_on: string | null; visit_slot: string; owner: string | null; lead_id: string | null; created_at: Date }>(
    `select e.id, e.name, e.phone, l.number, p.name as project, e.ask, e.source, e.visit_on::text as visit_on, e.visit_slot, ld.owner, e.lead_id, e.created_at
       from plot_enquiries e join plots l on l.id = e.plot_id join re_projects p on p.id = l.project_id left join leads ld on ld.id = e.lead_id
      where e.workspace_id = $1 and l.project_id = $2 order by e.created_at desc limit $3`,
    [workspaceId, projectId, limit],
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, phone: r.phone, plotNumber: r.number, project: r.project, ask: ENQUIRY_ASKS.find((a) => a.key === r.ask)?.label ?? r.ask, source: r.source,
    visit: r.visit_on ? `${r.visit_on}${r.visit_slot ? ` · ${VISIT_SLOTS.find((s) => s.key === r.visit_slot)?.label ?? r.visit_slot}` : ""}` : "", owner: r.owner ?? "", leadId: r.lead_id, createdAt: r.created_at.toISOString(),
  }));
}

/** A buyer's enquiry from a plot QR. It also becomes a lead in the Leads pipeline, and the buyer a contact (not opted in to offers). */
export async function createEnquiry(p: { workspaceId: string; plotId: string; qrId: string; input: EnquiryInput; visitor: string }): Promise<boolean> {
  return tx(async (q) => {
    const [l] = await q.query<{ number: number; project: string }>("select l.number, pr.name as project from plots l join re_projects pr on pr.id = l.project_id where l.id = $1 and l.workspace_id = $2", [p.plotId, p.workspaceId]);
    if (!l) return false;
    const i = p.input;
    const askLabel = ENQUIRY_ASKS.find((a) => a.key === i.ask)?.label ?? i.ask;
    const contactId = await upsertContact(q, p.workspaceId, { name: i.name, phone: i.phone, source: "Plot enquiry" });
    const visit = i.visitOn ? `${i.visitOn}${i.visitSlot ? ` · ${VISIT_SLOTS.find((s) => s.key === i.visitSlot)?.label}` : ""}` : "";
    const [lead] = await q.query<{ id: string }>(
      `insert into leads (workspace_id, qr_id, contact_id, name, phone, interest, preferred_time, message, source, visitor) values ($1,$2,$3,$4,$5,$6,$7,$8,'PLOT QR',$9) returning id`,
      [p.workspaceId, p.qrId, contactId, i.name, i.phone, askLabel, visit, `Plot ${l.number} · ${l.project}`, p.visitor],
    );
    await q.query("insert into plot_enquiries (workspace_id, plot_id, qr_id, name, phone, ask, visit_on, visit_slot, lead_id, visitor) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [p.workspaceId, p.plotId, p.qrId, i.name, i.phone, i.ask, i.visitOn, i.visitSlot, lead.id, p.visitor]);
    return true;
  });
}

/** What the buyer sees after scanning a plot stone. */
export async function publicPlot(workspaceId: string, plotId: string) {
  const [r] = await query<{ number: number; size_sqft: number | null; dims: string; facing: string; price_lakh: string | null; approval: string; corner: boolean; status: PlotStatus; project: string; p_approval: string; brochure_url: string; whatsapp: string }>(
    `select l.number, l.size_sqft, l.dims, l.facing, l.price_lakh::text as price_lakh, l.approval, l.corner, l.status, p.name as project, p.approval as p_approval, p.brochure_url, p.whatsapp
       from plots l join re_projects p on p.id = l.project_id where l.id = $1 and l.workspace_id = $2`,
    [plotId, workspaceId],
  );
  if (!r) return null;
  return {
    number: r.number, sizeSqft: r.size_sqft, dims: r.dims, facing: r.facing, price: priceText(r.price_lakh === null ? null : Number(r.price_lakh)), priceSet: r.price_lakh !== null,
    approval: r.approval || r.p_approval, corner: r.corner, status: r.status, project: r.project, projectApproval: r.p_approval, brochureUrl: r.brochure_url, whatsapp: r.whatsapp,
  };
}
