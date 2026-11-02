import { describe, expect, it } from "vitest";

import { ageBucket, bookingStage, computeBookingPipeline, type BpBooking } from "@/lib/booking-pipeline";

const NOW = Date.parse("2026-11-02T10:00:00Z");
const b = (id: string, extra: Partial<BpBooking> = {}): BpBooking => ({
  id, agent_id: "a1", status: "booked", approval_status: "pending", created_at: "2026-10-30T10:00:00Z", reviewed_at: null, ...extra,
});

describe("booking pipeline", () => {
  it("places each booking in exactly one current stage", () => {
    expect(bookingStage(b("1"), null)).toBe("pending");
    expect(bookingStage(b("2", { approval_status: "approved" }), null)).toBe("awaiting_os");
    expect(bookingStage(b("3", { approval_status: "approved" }), "sent")).toBe("confirmed");
    expect(bookingStage(b("4", { approval_status: "approved" }), "dead")).toBe("os_failed");
    expect(bookingStage(b("5", { approval_status: "approved", status: "completed" }), "sent")).toBe("completed");
    expect(bookingStage(b("6", { approval_status: "rejected" }), null)).toBe("rejected");
    expect(bookingStage(b("7", { status: "cancelled", approval_status: "approved" }), "sent")).toBe("cancelled");
  });

  it("ages pending requests from when they were created", () => {
    const p = computeBookingPipeline([b("1"), b("2", { created_at: "2026-10-20T10:00:00Z" })], new Map(), NOW);
    const pending = p.stages.find((s) => s.stage === "pending")!;
    expect(pending.count).toBe(2);
    expect(pending.oldestAgeHours).toBe(13 * 24);
    expect(pending.buckets).toEqual({ under_1d: 0, "1_3d": 0, "3_7d": 1, over_7d: 1 });
    expect(p.pendingByAgent).toEqual([{ agentId: "a1", pending: 2, oldestAgeHours: 312 }]);
  });

  it("measures review time only for decided bookings", () => {
    const p = computeBookingPipeline(
      [b("1", { approval_status: "approved", reviewed_at: "2026-10-30T16:00:00Z" }), b("2")],
      new Map([["1", "sent"]]),
      NOW,
    );
    expect(p.reviewHours).toEqual({ measured: 1, medianHours: 6, p90Hours: 6 });
  });

  it("buckets ages at 1, 3 and 7 days", () => {
    expect([23, 24, 72, 168].map(ageBucket)).toEqual(["under_1d", "1_3d", "3_7d", "over_7d"]);
  });
});
