import { dhakaDateOf } from "@/lib/business-day";
import { isOfficeOpen } from "@/lib/no-answer-cadence";

export const INACTIVITY_BUSINESS_DAYS = 7;
const WORK_EVENTS = new Set(["call_started", "call_ended", "outcome_logged", "contact_closed"]);

export type InactivityLead = {
  id: string; name: string | null; assigned_to: string | null;
  assigned_agent_id: string | null; status: string; work_state: string | null;
};
export type WorkEvidence = { leadId: string; agentId: string | null; at: string | null };
export type AssignmentEvidence = { leadId: string; agentId: string | null; at: string };

export function isInactivityWorkEvent(kind: string) { return WORK_EVENTS.has(kind); }

export function inactiveBusinessDays(since: string, today: string, holidays: readonly string[] = []) {
  const at = Date.parse(since);
  if (!Number.isFinite(at)) return 0;
  const start = dhakaDateOf(at);
  if (start >= today) return 0;
  let count = 0;
  const day = new Date(`${start}T00:00:00Z`);
  while (day.toISOString().slice(0, 10) < today) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (isOfficeOpen(day.toISOString().slice(0, 10), holidays)) count++;
  }
  return count;
}

/** Display-only warnings: no allocation, recall, score or stored-state changes. */
export function workedLeadWarnings(
  leads: InactivityLead[], evidence: WorkEvidence[], assignments: AssignmentEvidence[],
  today: string, holidays: readonly string[] = [], agentId?: string,
) {
  const latestAssignments = new Map<string, string>();
  for (const a of assignments) {
    if (!a.agentId || !Number.isFinite(Date.parse(a.at))) continue;
    const key = `${a.leadId}:${a.agentId}`;
    if (Date.parse(a.at) > Date.parse(latestAssignments.get(key) ?? "1970-01-01")) latestAssignments.set(key, a.at);
  }
  const latestWork = new Map<string, string>();
  for (const e of evidence) {
    if (!e.agentId || !e.at || !Number.isFinite(Date.parse(e.at)) || dhakaDateOf(Date.parse(e.at)) > today) continue;
    const key = `${e.leadId}:${e.agentId}`;
    if (Date.parse(e.at) > Date.parse(latestWork.get(key) ?? "1970-01-01")) latestWork.set(key, e.at);
  }
  const alerts = [];
  for (const lead of leads) {
    if (lead.status !== "pending") continue;
    if (lead.assigned_to && lead.assigned_agent_id && lead.assigned_to !== lead.assigned_agent_id) continue;
    const owner = lead.assigned_to ?? lead.assigned_agent_id;
    if (!owner || (agentId && owner !== agentId)) continue;
    const key = `${lead.id}:${owner}`;
    const lastWorkAt = latestWork.get(key);
    const assignedAt = latestAssignments.get(key);
    // A previous owner's work, or a missing current assignment trail, cannot establish responsibility.
    if (!lastWorkAt || !assignedAt || Date.parse(lastWorkAt) < Date.parse(assignedAt)) continue;
    const idleDays = inactiveBusinessDays(lastWorkAt, today, holidays);
    if (idleDays < INACTIVITY_BUSINESS_DAYS) continue;
    alerts.push({ id: `${key}:${lastWorkAt}`, leadId: lead.id, leadName: lead.name,
      agentId: owner, lastWorkAt, idleDays, status: lead.status, workState: lead.work_state });
  }
  return alerts.sort((a, b) => b.idleDays - a.idleDays || a.leadId.localeCompare(b.leadId));
}