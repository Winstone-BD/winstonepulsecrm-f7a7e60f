import { describe, it, expect } from "vitest";
import { canReviewRecovery, recoveryEvidence, recoveryState, type RecoveryReport } from "@/lib/vip-recovery";
import { RECOVERY_LEAD_IDS } from "@/lib/vip-recovery-cohort.server";

const report: RecoveryReport = { id: "r1", agent_id: "a", submitted_at: "2026-11-01T04:00:00Z", category: "follow_up", evaluation_model: null, evaluation_answers: null, grade: null };
describe("100-case management recovery contract", () => {
  it("preserves exactly 100 unique original audit cases and case order", () => {
    expect(RECOVERY_LEAD_IDS).toHaveLength(100);
    expect(new Set(RECOVERY_LEAD_IDS).size).toBe(100);
    expect(RECOVERY_LEAD_IDS[0]).toBe("17314d6e-7c4a-442f-8455-b40e337a16c8");
  });
  it("unanswered or absent reports never prove unqualified", () => {
    expect(recoveryEvidence([]).reason).toBe("unassessed");
    expect(recoveryEvidence([{ ...report, category: "no_answer" }]).reason).toBe("needs_evidence");
  });
  it("recorded rejection becomes a management review reason, not a qualification verdict", () => {
    expect(recoveryEvidence([{ ...report, category: "not_interested" }])).toMatchObject({ reason: "recorded_rejection", latestScore: null });
  });
  it("flags previous positive evidence followed by rejection for high priority review", () => {
    expect(recoveryEvidence([{ ...report, grade: "A" }, { ...report, id: "r2", submitted_at: "2026-11-02T04:00:00Z", category: "wrong_number" }])).toMatchObject({ reason: "positive_then_rejected", priority: "high" });
  });
  it("does not rescore legacy or incomplete evaluations", () => {
    expect(recoveryEvidence([{ ...report, evaluation_answers: { asked_price: true } }]).latestScore).toBeNull();
  });
  it("uses complete saved V2 answers for low-score review without modifying the report", () => {
    const row = { ...report, evaluation_model: "v2_six_question", evaluation_answers: { project_interest: false, asked_price: true, wanted_info: false, visit_interest: false, decision_30d: false, wants_follow_up: false } };
    const original = JSON.stringify(row);
    expect(recoveryEvidence([row])).toMatchObject({ latestScore: 15, reason: "low_score", scoredCount: 1 });
    expect(JSON.stringify(row)).toBe(original);
  });
  it("management notes do not resolve a task and reopening keeps old reviews", () => {
    const events = [{ id: "1", action: "resolved", decision: "unqualified", note: "Evidence checked", actor_name: "HQ", created_at: "2026-11-01" }, { id: "2", action: "note", decision: "needs_evidence", note: "New evidence", actor_name: "HQ", created_at: "2026-11-02" }];
    expect(recoveryState(events).status).toBe("resolved");
    const reopened = recoveryState([...events, { ...events[0], id: "3", action: "reopened", created_at: "2026-11-03" }]);
    expect(reopened.status).toBe("pending"); expect(reopened.reviews).toHaveLength(3);
  });
  it("agents, anonymous callers and supplemental HQ grants cannot write reviews", () => {
    for (const scope of ["agent", "none", "coordinator"]) expect(canReviewRecovery({ scope, readOnly: false }, "hq")).toBe(false);
    expect(canReviewRecovery({ scope: "authority", readOnly: true }, null)).toBe(false);
    expect(canReviewRecovery({ scope: "authority", readOnly: true }, "hq")).toBe(true);
    expect(canReviewRecovery({ scope: "authority", readOnly: false }, "full")).toBe(true);
  });
});