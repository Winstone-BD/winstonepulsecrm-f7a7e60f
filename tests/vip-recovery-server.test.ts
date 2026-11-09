import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ scope: "authority", readOnly: false, pin: "full", fail: false, reads: 0, writes: [] as Record<string, unknown>[], reviews: [] as Record<string, unknown>[] }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => ({ scope: m.scope, readOnly: m.readOnly, profile: null }),
  requireAuthority: (c: { scope: string }) => { if (c.scope !== "authority") throw new Error("Authority required"); },
}));
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: () => m.pin }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => {
    let inserted: Record<string, unknown> | null = null;
    let request: string | null = null;
    let start = 0;
    const q = {
      select: () => q, order: () => q, in: () => q, limit: () => q,
      eq: (key: string, value: string) => { if (key === "request_id") request = value; return q; },
      range: (from: number) => { start = from; return q; },
      insert: (row: Record<string, unknown>) => { inserted = row; return q; },
      maybeSingle: () => q,
      then: (resolve: (value: unknown) => unknown) => {
        if (inserted) {
          const duplicate = m.reviews.some(r => r.request_id === inserted?.request_id);
          if (!duplicate) { m.writes.push({ table, ...inserted }); m.reviews.push({ ...inserted, id: "review1", created_at: "2026-11-10T04:00:00Z" }); }
          return Promise.resolve(resolve({ data: null, error: duplicate ? { code: "23505" } : null }));
        }
        m.reads++;
        const id = "17314d6e-7c4a-442f-8455-b40e337a16c8";
        const rows = table === "leads" ? [{ id, name: "Audit customer", source: "csv", reference_by: null, assigned_to: "agent1", assigned_agent_id: "agent1", status: "closed", work_state: "completed", pipeline_stage: "enquiry" }] : table === "profiles" ? [{ id: "agent1", name: "Audit agent" }] : table === "executive_vip_recovery_reviews" ? m.reviews : [];
        const data = request ? rows.find(r => (r as Record<string, unknown>).request_id === request) ?? null : table === "leads" && inserted === null ? rows : start ? [] : rows;
        return Promise.resolve(resolve({ data, error: m.fail ? { message: "unavailable" } : null }));
      },
    };
    // The by-id lookup returns a single record instead of an array.
    const maybeSingle = () => ({ then: (resolve: (value: unknown) => unknown) => {
      m.reads++;
      return Promise.resolve(resolve({ data: request ? m.reviews.find(r => r.request_id === request) ?? null : { id: "17314d6e-7c4a-442f-8455-b40e337a16c8" }, error: null }));
    } });
    return { ...q, maybeSingle };
  },
} }));
import { appendRecoveryReview, readRecoveryQueue } from "@/lib/vip-recovery.server";
const input = { leadId: "17314d6e-7c4a-442f-8455-b40e337a16c8", requestId: "request1", action: "resolved", decision: "needs_evidence", note: "Review evidence first" };
beforeEach(() => { m.scope = "authority"; m.readOnly = false; m.pin = "full"; m.fail = false; m.reads = 0; m.writes = []; m.reviews = []; });
describe("management recovery server boundary", () => {
  it("refuses agent reads before any customer data read", async () => {
    m.scope = "agent"; await expect(readRecoveryQueue()).rejects.toThrow("Authority"); expect(m.reads).toBe(0);
  });
  it("supplemental HQ cannot save reviews", async () => {
    m.readOnly = true; m.pin = "none"; await expect(appendRecoveryReview(input)).rejects.toThrow("Executive HQ PIN"); expect(m.writes).toHaveLength(0);
  });
  it("refuses IDs outside the original audit before reading or writing", async () => {
    await expect(appendRecoveryReview({ ...input, leadId: "foreign-lead" })).rejects.toThrow("original 100"); expect(m.writes).toHaveLength(0);
  });
  it("saves a review, reads its completed task back and preserves lead state", async () => {
    await expect(appendRecoveryReview(input)).resolves.toEqual({ ok: true });
    const queue = await readRecoveryQueue();
    expect(queue.tasks).toHaveLength(100);
    expect(queue.tasks[0]).toMatchObject({ name: "Audit customer", agentName: "Audit agent", status: "closed", taskStatus: "resolved" });
    expect(queue.tasks[0]?.reviews).toHaveLength(1);
    expect(m.writes.map(r => r.table)).toEqual(["executive_vip_recovery_reviews"]);
  });
  it("retrying the same request does not duplicate permanent history", async () => {
    await appendRecoveryReview(input); await appendRecoveryReview(input); expect(m.writes).toHaveLength(1);
    await expect(appendRecoveryReview({ ...input, note: "different" })).rejects.toThrow("conflicts");
  });
  it("fails a partial evidence read instead of claiming an empty queue", async () => {
    m.fail = true; await expect(readRecoveryQueue()).rejects.toThrow("could not be read");
  });
});