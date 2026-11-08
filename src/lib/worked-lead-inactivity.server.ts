import { pageAllParallel } from "@/lib/page-all";
import { dhakaDateOf } from "@/lib/business-day";
import { isInactivityWorkEvent, workedLeadWarnings, type WorkEvidence, type AssignmentEvidence } from "@/lib/worked-lead-inactivity";

export async function readWorkedLeadWarnings(agentId?: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const today = dhakaDateOf(now);
  const [leadResult, holidaysResult] = await Promise.all([
    pageAllParallel((from, to) => {
      let q = db.from("leads").select("id,name,assigned_to,assigned_agent_id,status,work_state").eq("status", "pending");
      if (agentId) q = q.or(`assigned_to.eq.${agentId},assigned_agent_id.eq.${agentId}`);
      return q.order("id").range(from, to);
    }),
    db.from("app_config").select("data").eq("id", "office_holidays").maybeSingle(),
  ]);
  if (leadResult.error || holidaysResult.error) throw new Error("Inactivity warnings unavailable");
  const dates = (holidaysResult.data?.data as { dates?: unknown } | null)?.dates;
  if (dates !== undefined && (!Array.isArray(dates) || dates.some(d => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)))) {
    throw new Error("Office holiday calendar unavailable");
  }
  const holidays: string[] = Array.isArray(dates) ? dates : [];
  const leads = leadResult.data ?? [];
  const evidence: WorkEvidence[] = [];
  const assignments: AssignmentEvidence[] = [];
  for (let offset = 0; offset < leads.length; offset += 200) {
    const ids = leads.slice(offset, offset + 200).map(l => l.id);
    const [reports, recordings, events, followups, assignmentRows] = await Promise.all([
      pageAllParallel((from, to) => db.from("call_reports").select("id,lead_id,agent_id,submitted_at")
        .in("lead_id", ids).not("submitted_at", "is", null).order("id").range(from, to)),
      pageAllParallel((from, to) => db.from("call_recordings").select("id,lead_id,agent_id,started_at")
        .in("lead_id", ids).not("started_at", "is", null).order("id").range(from, to)),
      pageAllParallel((from, to) => db.from("lead_events").select("id,lead_id,agent_id,kind,created_at")
        .in("lead_id", ids).in("kind", ["call_started", "call_ended", "outcome_logged", "contact_closed"]).order("id").range(from, to)),
      pageAllParallel((from, to) => db.from("follow_up_events").select("id,lead_id,agent_id,completed_at")
        .in("lead_id", ids).eq("status", "completed").not("completed_at", "is", null).order("id").range(from, to)),
      pageAllParallel((from, to) => db.from("lead_assignments").select("id,lead_id,to_agent_id,created_at")
        .in("lead_id", ids).order("id").range(from, to)),
    ]);
    if ([reports, recordings, events, followups, assignmentRows].some(r => r.error)) throw new Error("Inactivity evidence unavailable");
    for (const r of reports.data ?? []) if (r.lead_id) evidence.push({ leadId: r.lead_id, agentId: r.agent_id, at: r.submitted_at });
    for (const r of recordings.data ?? []) if (r.lead_id) evidence.push({ leadId: r.lead_id, agentId: r.agent_id, at: r.started_at });
    for (const r of events.data ?? []) if (r.lead_id && isInactivityWorkEvent(r.kind)) evidence.push({ leadId: r.lead_id, agentId: r.agent_id, at: r.created_at });
    for (const r of followups.data ?? []) if (r.lead_id) evidence.push({ leadId: r.lead_id, agentId: r.agent_id, at: r.completed_at });
    for (const r of assignmentRows.data ?? []) assignments.push({ leadId: r.lead_id, agentId: r.to_agent_id, at: r.created_at });
  }
  const alerts = workedLeadWarnings(leads, evidence, assignments, today, holidays, agentId);
  const ownerIds = [...new Set(alerts.map(a => a.agentId))];
  const names = new Map<string, string | null>();
  for (let offset = 0; offset < ownerIds.length; offset += 200) {
    const result = await pageAllParallel((from, to) => db.from("profiles").select("id,name")
      .in("id", ownerIds.slice(offset, offset + 200)).order("id").range(from, to));
    if (result.error) throw new Error("Inactivity agent names unavailable");
    for (const p of result.data ?? []) names.set(p.id, p.name);
  }
  // Re-check current ownership/status after history reads so a concurrent transfer cannot leak a row.
  const current = new Map<string, typeof leads[number]>();
  for (let offset = 0; offset < alerts.length; offset += 200) {
    const result = await pageAllParallel((from, to) => db.from("leads")
      .select("id,name,assigned_to,assigned_agent_id,status,work_state").in("id", alerts.slice(offset, offset + 200).map(a => a.leadId))
      .order("id").range(from, to));
    if (result.error) throw new Error("Inactivity ownership unavailable");
    for (const lead of result.data ?? []) current.set(lead.id, lead);
  }
  const finalAlerts = workedLeadWarnings([...current.values()], evidence, assignments, today, holidays, agentId);
  return { today, checkedAt: new Date(now).toISOString(), alerts: finalAlerts.map(a => ({ ...a, agentName: names.get(a.agentId) ?? null })) };
}