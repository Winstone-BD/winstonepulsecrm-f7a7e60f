/**
 * Server read for the daily call-log match summary. Selects only the columns
 * needed to classify each call — never phone numbers, notes or audio paths.
 * Fails on any partial read so totals are never undercounted.
 */
import { summarizeCallLogMatches } from "@/lib/call-log-match-summary";

export async function readCallLogMatchSummary(day: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { activeAgents } = await import("@/lib/lead-pool.server");
  const { dhakaDayBounds } = await import("@/lib/accountability");
  const { pageAllParallel } = await import("@/lib/page-all");
  const { SYNC_FAILURE_EVENT } = await import("@/lib/android-sync-failures");
  const agents = await activeAgents();
  if (agents.length === 0) return summarizeCallLogMatches({ agents: [], calls: [], failures: [] });
  const ids = agents.map((a) => a.id);
  const { start, end } = dhakaDayBounds(day);
  const [calls, failures] = await Promise.all([
    pageAllParallel((a, b) => db.from("call_recordings")
      .select("id, agent_id, lead_id, call_source, call_status, duration_seconds, talk_time_source, external_call_id, call_log_id")
      .in("agent_id", ids).gte("created_at", start).lte("created_at", end).order("id").range(a, b)),
    pageAllParallel((a, b) => db.from("sync_events").select("id, agent_id, payload")
      .eq("event_type", SYNC_FAILURE_EVENT).in("agent_id", ids)
      .gte("created_at", start).lte("created_at", end).order("id").range(a, b)),
  ]);
  if (calls.error || failures.error) throw new Error("Call-log match counts unavailable");
  return summarizeCallLogMatches({
    agents: agents.map((a) => ({ id: a.id, name: a.name })),
    calls: (calls.data ?? []) as never,
    failures: ((failures.data ?? []) as Array<{ agent_id: string | null; payload: unknown }>).map((r) => ({
      agent_id: r.agent_id,
      error_kind: (r.payload as { error_kind?: string } | null)?.error_kind ?? null,
    })),
  });
}
