import { EVALUATION_MODEL, parseAnswers, scoreAnswers } from "./lead-evaluation";
import { fastDisqualification } from "./fast-disqualification";

export const REVIEW_ACTIONS = ["reviewing", "resolved", "reopened", "note"] as const;
export const REVIEW_DECISIONS = ["needs_evidence", "recovery_candidate", "unqualified", "no_change"] as const;
export type RecoveryReason = "positive_then_rejected" | "recorded_rejection" | "unassessed" | "low_score" | "positive_signal" | "needs_evidence";
export type RecoveryStatus = "pending" | "reviewing" | "resolved";
export type RecoveryReport = {
  id: string; agent_id: string | null; submitted_at: string | null; category: string | null;
  evaluation_model: string | null; evaluation_answers: unknown; grade: string | null;
};
export type RecoveryReview = {
  id: string; action: string; decision: string; note: string; actor_name: string; created_at: string;
};

/** A review exception only; never grants operational or LeadHub write access. */
export function canReviewRecovery(caller: { scope: string; readOnly: boolean }, pinScope: string | null) {
  return caller.scope === "authority" && (!caller.readOnly || pinScope === "hq");
}

export function recoveryEvidence(reports: readonly RecoveryReport[]) {
  const submitted = [...reports].filter(r => r.submitted_at).sort((a, b) =>
    String(a.submitted_at).localeCompare(String(b.submitted_at)) || a.id.localeCompare(b.id));
  const scored = submitted.flatMap(r => {
    const answers = r.evaluation_model === EVALUATION_MODEL && !fastDisqualification(r.category ?? "") ? parseAnswers(r.evaluation_answers) : null;
    return answers ? [{ reportId: r.id, score: scoreAnswers(answers), answers }] : [];
  });
  const positive = submitted.some(r => !fastDisqualification(r.category ?? "") && ["A", "B"].includes(r.grade ?? "")) || scored.some(s => s.score >= 21);
  const latest = submitted.at(-1) ?? null;
  const rejection = latest ? fastDisqualification(latest.category ?? "") : null;
  const latestScore = scored.find(s => s.reportId === latest?.id)?.score ?? null;
  const reason: RecoveryReason = rejection ? (positive ? "positive_then_rejected" : "recorded_rejection") :
    !submitted.length ? "unassessed" : latestScore !== null && latestScore <= 20 ? "low_score" : positive ? "positive_signal" : "needs_evidence";
  return { reason, latest: latest ? { id: latest.id, agent_id: latest.agent_id, submitted_at: latest.submitted_at, category: latest.category, grade: latest.grade } : null, latestScore, submittedCount: submitted.length, scoredCount: scored.length, positive,
    priority: reason === "positive_then_rejected" ? "high" : reason === "positive_signal" ? "medium" : "normal" };
}

export function recoveryState(reviews: readonly RecoveryReview[]) {
  const ordered = [...reviews].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  let status: RecoveryStatus = "pending";
  for (const review of ordered) {
    if (review.action === "resolved") status = "resolved";
    if (review.action === "reviewing") status = "reviewing";
    if (review.action === "reopened") status = "pending";
  }
  return { status, latestReview: ordered.at(-1) ?? null, reviews: ordered };
}