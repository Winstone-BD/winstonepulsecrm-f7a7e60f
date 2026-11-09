import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCaller, requireAuthority } from "./access.server";
import { adminTokenScope } from "./admin-gate.server";
import { pageAllParallel } from "./page-all";
import { leadOwner } from "./lead-owner";
import { RECOVERY_COHORT_KEY, RECOVERY_AUDIT_AT, RECOVERY_LEAD_IDS } from "./vip-recovery-cohort.server";
import { canReviewRecovery, recoveryEvidence, recoveryState } from "./vip-recovery";

export async function recoveryCaller(token?: string | null) {
  const caller = await resolveCaller(token ?? null);
  requireAuthority(caller);
  return { caller, canReview: canReviewRecovery(caller, adminTokenScope(token ?? null)) };
}

export async function readRecoveryQueue(token?: string | null) {
  const { canReview } = await recoveryCaller(token);
  const ids = [...RECOVERY_LEAD_IDS];
  const [leads, reports, profiles, assignments, reviews] = await Promise.all([
    supabaseAdmin.from("leads").select("id,name,source,reference_by,assigned_to,assigned_agent_id,status,work_state,pipeline_stage,created_at").in("id", ids),
    pageAllParallel((from, to) => supabaseAdmin.from("call_reports").select("id,lead_id,agent_id,submitted_at,category,evaluation_model,evaluation_answers,grade").in("lead_id", ids).eq("status", "submitted").order("id").range(from, to), { concurrency: 1 }),
    pageAllParallel((from, to) => supabaseAdmin.from("profiles").select("id,name").order("id").range(from, to), { concurrency: 1 }),
    pageAllParallel((from, to) => supabaseAdmin.from("lead_assignments").select("id,lead_id,to_agent_id,source,created_at").in("lead_id", ids).order("id").range(from, to), { concurrency: 1 }),
    pageAllParallel((from, to) => supabaseAdmin.from("executive_vip_recovery_reviews").select("*").eq("cohort_key", RECOVERY_COHORT_KEY).in("lead_id", ids).order("id").range(from, to), { concurrency: 1 }),
  ]);
  if ([leads, reports, profiles, assignments, reviews].some(r => r.error)) throw new Error("Recovery evidence could not be read. Refresh to retry.");
  const names = new Map((profiles.data ?? []).map(p => [p.id, p.name]));
  const leadMap = new Map((leads.data ?? []).map(l => [l.id, l]));
  const tasks = ids.map((id, index) => {
    const lead = leadMap.get(id);
    const owner = lead ? leadOwner(lead) : null;
    const conflict = Boolean(lead?.assigned_to && lead.assigned_agent_id && lead.assigned_to !== lead.assigned_agent_id);
    const evidence = recoveryEvidence((reports.data ?? []).filter(r => r.lead_id === id));
    const prior = (assignments.data ?? []).filter(a => a.lead_id === id && a.created_at <= RECOVERY_AUDIT_AT)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).at(-1);
    const state = recoveryState((reviews.data ?? []).filter(r => r.lead_id === id));
    return { leadId: id, caseNumber: index + 1, name: lead?.name ?? "Record unavailable", source: lead?.source ?? "unknown",
      reference: lead?.reference_by ?? null, agentId: conflict ? null : owner, agentName: conflict ? "Ownership conflict" : owner ? names.get(owner) ?? "Unknown agent" : "Unassigned",
      auditAgentName: prior?.to_agent_id ? names.get(prior.to_agent_id) ?? "Unknown agent" : "No saved assignment evidence",
      status: lead?.status ?? "unknown", workState: lead?.work_state ?? "unknown", stage: lead?.pipeline_stage ?? "unknown",
      missing: !lead, ownershipConflict: conflict, ...evidence, taskStatus: state.status, latestReview: state.latestReview, reviews: state.reviews };
  });
  return { cohortKey: RECOVERY_COHORT_KEY, auditAt: RECOVERY_AUDIT_AT, readAt: new Date().toISOString(), canReview, tasks };
}

export async function appendRecoveryReview(input: {
  adminToken?: string | null | undefined; leadId: string; requestId: string; action: string; decision: string; note: string;
}) {
  const { caller, canReview } = await recoveryCaller(input.adminToken);
  if (!canReview) throw new Error("Executive HQ PIN or writable management access required for review.");
  if (!(RECOVERY_LEAD_IDS as readonly string[]).includes(input.leadId)) throw new Error("Lead is not in the original 100-case audit.");
  const { data: lead, error: leadError } = await supabaseAdmin.from("leads").select("id").eq("id", input.leadId).maybeSingle();
  if (leadError || !lead) throw new Error("Lead evidence unavailable; review was not saved.");
  const row = { cohort_key: RECOVERY_COHORT_KEY, lead_id: input.leadId, request_id: input.requestId, action: input.action,
    decision: input.decision, note: input.note, actor_name: caller.profile?.name ?? (caller.readOnly ? "Executive HQ" : "IT Console"), actor_id: caller.profile?.id ?? null };
  const { error } = await supabaseAdmin.from("executive_vip_recovery_reviews").insert(row);
  if (error) {
    if (error.code !== "23505") throw new Error("Management review was not saved. Retry with the same request.");
    const existing = await supabaseAdmin.from("executive_vip_recovery_reviews").select("lead_id,action,decision,note,actor_name,actor_id").eq("request_id", input.requestId).maybeSingle();
    if (existing.error || !existing.data || existing.data.lead_id !== row.lead_id || existing.data.action !== row.action || existing.data.decision !== row.decision || existing.data.note !== row.note || existing.data.actor_name !== row.actor_name || existing.data.actor_id !== row.actor_id) throw new Error("Review request conflicts with an existing receipt.");
  }
  return { ok: true };
}