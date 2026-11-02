/**
 * Which recorded conversations led to a next action, a site visit or a booking.
 * Pure and counts-only; computed from saved rows, never guessed.
 *
 * - conversation: submitted call report with connected = true (kpi-contract
 *   "reportedConnected"); `verified` is the subset with connection_verified.
 * - next action:  a follow-up saved from that report (follow_up_events.report_id),
 *   or a follow-up time saved on the report itself.
 * - site visit / booking: a non-cancelled record on the same lead, created
 *   within ATTRIBUTION_DAYS after the conversation. Each visit or booking is
 *   credited once, to the latest conversation before it (last touch), so one
 *   booking never counts for several calls.
 */

export const ATTRIBUTION_DAYS = 30;
const DAY = 86_400_000;
/** A booking auto-created from a converted report uses the report's submit time. */
const SAME_MOMENT_MS = 60_000;

export type OcReport = {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  submitted_at: string | null;
  connected: boolean | null;
  connection_verified: boolean | null;
  follow_up_at: string | null;
};
export type OcFollowUp = { report_id: string | null };
export type OcVisit = { lead_id: string; created_at: string; status: string };
export type OcBooking = { lead_id: string; booked_at: string; status: string; approval_status: string | null };

export type OcCounts = {
  conversations: number;
  verified: number;
  nextAction: number;
  siteVisit: number;
  booking: number;
  bookingApproved: number;
  noOutcome: number;
};
export type OcAgentRow = OcCounts & { agentId: string };
export type ConversationOutcomes = { totals: OcCounts; byAgent: OcAgentRow[]; attributionDays: number };

const empty = (): OcCounts => ({ conversations: 0, verified: 0, nextAction: 0, siteVisit: 0, booking: 0, bookingApproved: 0, noOutcome: 0 });

type Conv = { id: string; lead: string | null; agent: string; at: number; verified: boolean; next: boolean; visit: boolean; booking: boolean; approved: boolean };

function lastTouch(convsByLead: Map<string, Conv[]>, lead: string, at: number, slackMs: number): Conv | null {
  const list = convsByLead.get(lead);
  if (!list) return null;
  let best: Conv | null = null;
  for (const c of list) {
    if (c.at > at + slackMs) continue;
    if (at - c.at > ATTRIBUTION_DAYS * DAY) continue;
    if (!best || c.at > best.at) best = c;
  }
  return best;
}

export function computeConversationOutcomes(
  reports: OcReport[],
  followUps: OcFollowUp[],
  visits: OcVisit[],
  bookings: OcBooking[],
): ConversationOutcomes {
  const withFollowUp = new Set(followUps.map((f) => f.report_id).filter((v): v is string => !!v));
  const convs: Conv[] = [];
  const seen = new Set<string>();
  for (const r of reports) {
    if (r.connected !== true || !r.submitted_at || seen.has(r.id)) continue;
    const at = Date.parse(r.submitted_at);
    if (!Number.isFinite(at)) continue;
    seen.add(r.id);
    convs.push({
      id: r.id, lead: r.lead_id, agent: r.agent_id ?? "unknown", at,
      verified: r.connection_verified === true,
      next: withFollowUp.has(r.id) || !!r.follow_up_at,
      visit: false, booking: false, approved: false,
    });
  }
  const byLead = new Map<string, Conv[]>();
  for (const c of convs) if (c.lead) (byLead.get(c.lead) ?? byLead.set(c.lead, []).get(c.lead)!).push(c);

  for (const v of visits) {
    if (v.status === "cancelled") continue;
    const at = Date.parse(v.created_at);
    if (!Number.isFinite(at)) continue;
    const c = lastTouch(byLead, v.lead_id, at, 0);
    if (c) c.visit = true;
  }
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const at = Date.parse(b.booked_at);
    if (!Number.isFinite(at)) continue;
    const c = lastTouch(byLead, b.lead_id, at, SAME_MOMENT_MS);
    if (!c) continue;
    c.booking = true;
    if (b.approval_status === "approved") c.approved = true;
  }

  const totals = empty();
  const agents = new Map<string, OcCounts>();
  for (const c of convs) {
    for (const acc of [totals, agents.get(c.agent) ?? agents.set(c.agent, empty()).get(c.agent)!]) {
      acc.conversations += 1;
      if (c.verified) acc.verified += 1;
      if (c.next) acc.nextAction += 1;
      if (c.visit) acc.siteVisit += 1;
      if (c.booking) acc.booking += 1;
      if (c.approved) acc.bookingApproved += 1;
      if (!c.next && !c.visit && !c.booking) acc.noOutcome += 1;
    }
  }
  return {
    totals,
    byAgent: [...agents.entries()].map(([agentId, v]) => ({ agentId, ...v })).sort((a, b) => b.conversations - a.conversations),
    attributionDays: ATTRIBUTION_DAYS,
  };
}
