import { describe, expect, it, vi } from "vitest";
import { FINOS_PROJECT_ID, finosReceiptSchema, projectFinosLog } from "@/lib/finos-access";
import { recordFinosSummaryServed, readFinosAccessLog } from "@/lib/finos-access.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const receipt = { summaryType: "financial" as const, requestId: "11111111-1111-4111-8111-111111111111", from: "2026-11-01", to: "2026-11-08" };
function fakeDb(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { db: { from } as unknown as SupabaseClient<Database>, from, insert };
}
describe("FinOS privacy-safe access receipts", () => {
  it("records financial access for only the verified named consumer", async () => {
    const { db, insert } = fakeDb();
    await recordFinosSummaryServed(db, FINOS_PROJECT_ID, receipt);
    expect(insert).toHaveBeenCalledWith({ action: "finos_summary_served", entity_type: "finos_summary", entity_id: FINOS_PROJECT_ID, actor_label: "WINSTONE FinOS", metadata: receipt });
  });
  it("records work summary as the separate allowed type", async () => {
    const { db, insert } = fakeDb();
    await recordFinosSummaryServed(db, FINOS_PROJECT_ID, { ...receipt, summaryType: "work" });
    expect(insert.mock.calls[0]?.[0].metadata.summaryType).toBe("work");
  });
  it.each([null, "other-project"])("denies unverified or wrong app %s before database access", async (identity) => {
    const { db, from } = fakeDb();
    await expect(recordFinosSummaryServed(db, identity, receipt)).rejects.toThrow("Verified FinOS");
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects customer details and free text instead of persisting them", () => {
    expect(finosReceiptSchema.safeParse({ ...receipt, customerPhone: "private", notes: "private" }).success).toBe(false);
  });
  it("cannot silently continue when an audit receipt fails", async () => {
    const { db } = fakeDb({ message: "private underlying error" });
    await expect(recordFinosSummaryServed(db, FINOS_PROJECT_ID, receipt)).rejects.toThrow("FinOS access receipt could not be saved");
  });
  it("rejects inverted date ranges", () => {
    expect(finosReceiptSchema.safeParse({ ...receipt, from: "2026-11-09" }).success).toBe(false);
  });
  it("projects only serving time, type, period and request receipt ID", () => {
    expect(projectFinosLog({ id: "row", created_at: "2026-11-08T02:03:00Z", metadata: receipt })).toEqual({ ...receipt, id: "row", servedAt: "2026-11-08T02:03:00Z" });
  });
  it("uses the named consumer and action filters with bounded pages", async () => {
    const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }) };
    q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.order.mockReturnValue(q);
    const db = { from: vi.fn().mockReturnValue(q) } as unknown as SupabaseClient<Database>;
    expect(await readFinosAccessLog(db, 2, "work")).toEqual({ rows: [], total: 0 });
    expect(q.eq).toHaveBeenCalledWith("entity_id", FINOS_PROJECT_ID);
    expect(q.eq).toHaveBeenCalledWith("action", "finos_summary_served");
    expect(q.eq).toHaveBeenCalledWith("metadata->>summaryType", "work");
    expect(q.range).toHaveBeenCalledWith(50, 74);
  });
});