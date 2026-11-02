import { describe, expect, it } from "vitest";

import { computeConversationOutcomes, type OcReport } from "@/lib/conversation-outcomes";

const rep = (id: string, lead: string, at: string, extra: Partial<OcReport> = {}): OcReport => ({
  id, lead_id: lead, agent_id: "agent-1", submitted_at: at, connected: true, connection_verified: false, follow_up_at: null, ...extra,
});

describe("conversation outcomes", () => {
  it("counts only connected submitted conversations", () => {
    const r = computeConversationOutcomes([rep("a", "L1", "2026-10-01T05:00:00Z"), rep("b", "L1", "2026-10-01T06:00:00Z", { connected: false })], [], [], []);
    expect(r.totals.conversations).toBe(1);
    expect(r.totals.noOutcome).toBe(1);
  });

  it("treats a saved follow-up or follow-up time as a next action", () => {
    const r = computeConversationOutcomes(
      [rep("a", "L1", "2026-10-01T05:00:00Z"), rep("b", "L2", "2026-10-01T05:00:00Z", { follow_up_at: "2026-10-03T05:00:00Z" })],
      [{ report_id: "a" }],
      [], [],
    );
    expect(r.totals.nextAction).toBe(2);
  });

  it("credits a site visit only to the latest conversation before it, within 30 days", () => {
    const r = computeConversationOutcomes(
      [rep("a", "L1", "2026-10-01T05:00:00Z"), rep("b", "L1", "2026-10-05T05:00:00Z"), rep("c", "L2", "2026-08-01T05:00:00Z")],
      [],
      [
        { lead_id: "L1", created_at: "2026-10-06T05:00:00Z", status: "scheduled" },
        { lead_id: "L2", created_at: "2026-10-06T05:00:00Z", status: "scheduled" }, // 66 days later
        { lead_id: "L1", created_at: "2026-10-07T05:00:00Z", status: "cancelled" },
      ],
      [],
    );
    expect(r.totals.siteVisit).toBe(1);
  });

  it("credits an auto-created booking at the report's own submit time and tracks approval", () => {
    const r = computeConversationOutcomes(
      [rep("a", "L1", "2026-10-01T05:00:00Z")],
      [],
      [],
      [{ lead_id: "L1", booked_at: "2026-10-01T05:00:00Z", status: "booked", approval_status: "pending" }],
    );
    expect(r.totals).toMatchObject({ booking: 1, bookingApproved: 0, noOutcome: 0 });
  });
});
