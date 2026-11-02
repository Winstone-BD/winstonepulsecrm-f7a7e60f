/**
 * Booking pipeline: where each booking request is now and how long it has
 * waited there. Pure, counts-only, from saved rows.
 *
 * Current stage (first match wins):
 *   cancelled  → booking status cancelled
 *   rejected   → HQ/IT rejected it
 *   pending    → waiting for HQ/IT review (age from created_at)
 *   completed  → approved and marked completed (no saved entry time, so no age)
 *   os_failed  → approved, sending to Winstone OS failed (age from reviewed_at)
 *   confirmed  → approved and Winstone OS accepted it
 *   awaiting_os→ approved, not yet accepted by Winstone OS (age from reviewed_at)
 */

export const BOOKING_STAGES = ["pending", "awaiting_os", "os_failed", "confirmed", "completed", "rejected", "cancelled"] as const;
export type BookingStage = (typeof BOOKING_STAGES)[number];
export const AGE_BUCKETS = ["under_1d", "1_3d", "3_7d", "over_7d"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export type BpBooking = {
  id: string;
  agent_id: string | null;
  status: string;
  approval_status: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const HOUR = 3_600_000;
const AGED: ReadonlySet<BookingStage> = new Set(["pending", "awaiting_os", "os_failed"]);

export function bookingStage(b: BpBooking, relay: string | null | undefined): BookingStage {
  if (b.status === "cancelled") return "cancelled";
  if (b.approval_status === "rejected") return "rejected";
  if (b.approval_status !== "approved") return "pending";
  if (b.status === "completed") return "completed";
  if (relay === "failed" || relay === "dead") return "os_failed";
  if (relay === "sent") return "confirmed";
  return "awaiting_os";
}

export function ageBucket(hours: number): AgeBucket {
  if (hours < 24) return "under_1d";
  if (hours < 72) return "1_3d";
  if (hours < 168) return "3_7d";
  return "over_7d";
}

export type StageSummary = {
  stage: BookingStage;
  count: number;
  medianAgeHours: number | null;
  oldestAgeHours: number | null;
  buckets: Record<AgeBucket, number>;
};
export type AgentPending = { agentId: string; pending: number; oldestAgeHours: number };
export type BookingPipeline = {
  total: number;
  stages: StageSummary[];
  reviewHours: { measured: number; medianHours: number | null; p90Hours: number | null };
  pendingByAgent: AgentPending[];
};

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
function pct(sorted: number[], p: number) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

export function computeBookingPipeline(rows: BpBooking[], relay: Map<string, string>, nowMs: number): BookingPipeline {
  const ages = new Map<BookingStage, number[]>(BOOKING_STAGES.map((s) => [s, []]));
  const counts = new Map<BookingStage, number>(BOOKING_STAGES.map((s) => [s, 0]));
  const review: number[] = [];
  const agents = new Map<string, AgentPending>();
  const seen = new Set<string>();

  for (const b of rows) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    const stage = bookingStage(b, relay.get(b.id));
    counts.set(stage, counts.get(stage)! + 1);
    const created = Date.parse(b.created_at);
    const reviewed = b.reviewed_at ? Date.parse(b.reviewed_at) : NaN;
    if (Number.isFinite(created) && Number.isFinite(reviewed) && b.approval_status !== "pending") {
      review.push(Math.max(0, reviewed - created) / HOUR);
    }
    if (!AGED.has(stage)) continue;
    const since = stage === "pending" ? created : reviewed;
    if (!Number.isFinite(since)) continue;
    const age = Math.max(0, nowMs - since) / HOUR;
    ages.get(stage)!.push(age);
    if (stage === "pending") {
      const key = b.agent_id ?? "unknown";
      const a = agents.get(key) ?? { agentId: key, pending: 0, oldestAgeHours: 0 };
      a.pending += 1;
      a.oldestAgeHours = Math.max(a.oldestAgeHours, r1(age)!);
      agents.set(key, a);
    }
  }

  const stages = BOOKING_STAGES.map((stage): StageSummary => {
    const s = [...ages.get(stage)!].sort((a, b) => a - b);
    const buckets = Object.fromEntries(AGE_BUCKETS.map((k) => [k, 0])) as Record<AgeBucket, number>;
    for (const h of s) buckets[ageBucket(h)] += 1;
    return { stage, count: counts.get(stage)!, medianAgeHours: r1(pct(s, 50)), oldestAgeHours: r1(s.at(-1) ?? null), buckets };
  });
  const rs = review.sort((a, b) => a - b);
  return {
    total: seen.size,
    stages,
    reviewHours: { measured: rs.length, medianHours: r1(pct(rs, 50)), p90Hours: r1(pct(rs, 90)) },
    pendingByAgent: [...agents.values()].sort((a, b) => b.oldestAgeHours - a.oldestAgeHours),
  };
}
