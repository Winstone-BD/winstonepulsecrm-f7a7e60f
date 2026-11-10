import { leadOwner } from "./lead-owner";

type Agent = { id: string; name: string };
type Lead = { id: string; assigned_to: string | null; assigned_agent_id: string | null; status: string; outcome_category: string | null; assignment_source: string | null; source?: string | null };
type Report = { id: string; lead_id: string | null; agent_id: string | null; submitted_at: string | null; category: string | null; temperature: string | null };
type Booking = { id: string; lead_id: string; agent_id: string | null; booked_at: string; status: string; approval_status: string };
type Visit = { id: string; lead_id: string; agent_id: string | null; created_at: string; status: string };
export type ScorecardInput = { agents: Agent[]; leads: Lead[]; reports: Report[]; bookings: Booking[]; visits: Visit[] };
export type AgentSalesScorecard = { agentId: string; name: string; assigned: number; converted: number; conversionRate: number | null; visits: number; hotLost: number; companyDatabase: number; selfAssigned: number; unknownSource: number; otherSource: number };

const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(r => [r.id, r])).values()];

/** Current portfolio denominator; period outcomes; confirmed same-agent Hot → rejection only. */
export function agentSalesScorecards(input: ScorecardInput, start: string, end: string): AgentSalesScorecard[] {
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start >= end) throw new Error("Invalid scorecard dates");
  const within = (at: string) => at >= start && at < end;
  const leads = unique(input.leads).filter(l => l.assignment_source !== "duplicate_skipped");
  const reports = unique(input.reports).filter(r => r.submitted_at).sort((a,b) => String(a.submitted_at).localeCompare(String(b.submitted_at)) || a.id.localeCompare(b.id));
  const history = new Map<string, Report[]>();
  for (const report of reports) {
    if (!report.lead_id || !report.agent_id) continue;
    const key = `${report.agent_id}:${report.lead_id}`;
    const rows = history.get(key) ?? [];
    rows.push(report); history.set(key, rows);
  }
  return unique(input.agents).map(agent => {
    const owned = leads.filter(l => leadOwner(l) === agent.id);
    const ids = new Set(owned.map(l => l.id));
    const companyDatabase = owned.filter(l => ["head_database", "public_directory"].includes(l.source ?? "")).length;
    const selfAssigned = owned.filter(l => !["head_database", "public_directory"].includes(l.source ?? "") && (l.source === "agent_app" || l.assignment_source === "self")).length;
    const unknownSource = owned.filter(l => !l.source || ["unknown", "unrecorded"].includes(l.source)).filter(l => l.assignment_source !== "self").length;
    const otherSource = owned.length - companyDatabase - selfAssigned - unknownSource;
    const conversions = new Set(unique(input.bookings).filter(b => ids.has(b.lead_id) && b.agent_id === agent.id && b.approval_status === "approved" && b.status !== "cancelled" && within(b.booked_at)).map(b => b.lead_id));
    const visits = unique(input.visits).filter(v => ids.has(v.lead_id) && v.agent_id === agent.id && v.status !== "cancelled" && within(v.created_at)).length;
    let hotLost = 0;
    for (const lead of owned) {
      if (lead.status !== "closed" || lead.outcome_category !== "not_interested" || conversions.has(lead.id)) continue;
      const chain = history.get(`${agent.id}:${lead.id}`) ?? [];
      const latest = chain.at(-1);
      if (!latest?.submitted_at || latest.category !== "not_interested" || !within(latest.submitted_at)) continue;
      const lossAt = latest.submitted_at;
      if (chain.some(r => r.temperature?.toLowerCase() === "hot" && r.submitted_at && r.submitted_at < lossAt)) hotLost++;
    }
    return { agentId: agent.id, name: agent.name, assigned: owned.length, converted: conversions.size, conversionRate: owned.length ? Math.round(conversions.size / owned.length * 1000) / 10 : null, visits, hotLost, companyDatabase, selfAssigned, unknownSource, otherSource };
  }).sort((a,b) => (b.conversionRate ?? -1) - (a.conversionRate ?? -1) || b.visits - a.visits || a.name.localeCompare(b.name));
}