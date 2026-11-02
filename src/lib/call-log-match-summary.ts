/**
 * Daily phone call-log match summary — pure, browser-safe, counts only.
 *
 * Built from saved call rows (call_recordings) and saved Android sync failures
 * (sync_events "android_sync_failure"). It never reads or returns phone
 * numbers, names of customers, notes, transcripts or audio. Each call row is
 * classified with the same callLogMatch + hasProvenTalkTime rules the phone
 * app's call list uses, so the numbers agree with what agents see.
 */
import { callLogMatch, type CallLogMatch, type CallLogRow } from "@/lib/call-evidence";
import { hasProvenTalkTime } from "@/lib/lead-verification";
import { SYNC_ERROR_KINDS, type SyncErrorKind } from "@/lib/android-sync-failures";

export type MatchCallRow = CallLogRow & { agent_id: string | null; lead_id?: string | null };
export type MatchFailureRow = { agent_id: string | null; error_kind: string | null | undefined };

export type MatchCounts = {
  /** Phone call log proved the call and real talk time. */
  matched: number;
  /** Phone call log has the call, but nobody talked (no answer / busy / 0s). */
  noAnswer: number;
  /** Phone call that the call log has not confirmed (yet). */
  notMatched: number;
  /** Web/other call — no phone call log to compare. */
  noPhoneLog: number;
  /** Distinct leads that reached a call-log-proven conversation. */
  verifiedLeads: number;
  /** Phone send failures by reason. */
  failures: Partial<Record<SyncErrorKind, number>>;
  failureTotal: number;
};

export type AgentMatchRow = MatchCounts & { agentId: string; agentName: string };

const empty = (): MatchCounts => ({ matched: 0, noAnswer: 0, notMatched: 0, noPhoneLog: 0, verifiedLeads: 0, failures: {}, failureTotal: 0 });

const KIND_SET = new Set<string>(SYNC_ERROR_KINDS);
export const failureKind = (raw: string | null | undefined): SyncErrorKind =>
  raw && KIND_SET.has(raw) ? (raw as SyncErrorKind) : "UNKNOWN";

const FIELD: Record<CallLogMatch, keyof Pick<MatchCounts, "matched" | "noAnswer" | "notMatched" | "noPhoneLog">> = {
  log_talk: "matched",
  log_no_answer: "noAnswer",
  not_matched: "notMatched",
  no_phone_log: "noPhoneLog",
};

export function summarizeCallLogMatches(input: {
  agents: Array<{ id: string; name: string }>;
  calls: MatchCallRow[];
  failures: MatchFailureRow[];
}): { team: MatchCounts; agents: AgentMatchRow[] } {
  const per = new Map<string, MatchCounts & { leads: Set<string> }>();
  const known = new Set(input.agents.map((a) => a.id));
  const bucket = (id: string) => {
    let b = per.get(id);
    if (!b) { b = { ...empty(), leads: new Set() }; per.set(id, b); }
    return b;
  };
  for (const c of input.calls) {
    if (!c.agent_id || !known.has(c.agent_id)) continue;
    const b = bucket(c.agent_id);
    const kind = callLogMatch(c, hasProvenTalkTime);
    b[FIELD[kind]] += 1;
    if (kind === "log_talk" && c.lead_id) b.leads.add(c.lead_id);
  }
  for (const f of input.failures) {
    if (!f.agent_id || !known.has(f.agent_id)) continue;
    const b = bucket(f.agent_id);
    const k = failureKind(f.error_kind);
    b.failures[k] = (b.failures[k] ?? 0) + 1;
    b.failureTotal += 1;
  }
  const team = empty();
  const teamLeads = new Set<string>();
  const agents: AgentMatchRow[] = input.agents.map((a) => {
    const b = per.get(a.id);
    if (!b) return { agentId: a.id, agentName: a.name, ...empty() };
    const { leads, ...counts } = b;
    for (const l of leads) teamLeads.add(l);
    team.matched += counts.matched;
    team.noAnswer += counts.noAnswer;
    team.notMatched += counts.notMatched;
    team.noPhoneLog += counts.noPhoneLog;
    team.failureTotal += counts.failureTotal;
    for (const [k, n] of Object.entries(counts.failures)) team.failures[k as SyncErrorKind] = (team.failures[k as SyncErrorKind] ?? 0) + (n ?? 0);
    return { agentId: a.id, agentName: a.name, ...counts, verifiedLeads: leads.size };
  });
  team.verifiedLeads = teamLeads.size;
  agents.sort((x, y) => y.verifiedLeads - x.verifiedLeads || y.matched - x.matched || x.agentName.localeCompare(y.agentName));
  return { team, agents };
}
