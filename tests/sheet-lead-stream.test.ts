import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseNewLeadGrid, NEW_LEADS_SCHEDULE } from "@/lib/sheet-lead-stream";
const state = vi.hoisted(() => ({ intake: vi.fn(), seen: false, failed: false, claimed: true, writes: [] as unknown[] }));
vi.mock("@/lib/lead-intake.server", () => ({ intakeLead: state.intake, InvalidLeadPhoneError: class extends Error {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: async () => ({ data: state.claimed ? "run" : null, error: null }),
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => table.endsWith("runs") ? Promise.resolve({ error: null }) : q;
    q.maybeSingle = async () => ({ data: state.seen ? { row_hash: "hash" } : null, error: null });
    q.insert = async (v: unknown) => { state.writes.push(v); return { error: null }; };
    q.update = (v: unknown) => { state.writes.push(v); return q; };
    return q;
  },
} }));
import { runSheetLeadStream } from "@/lib/sheet-lead-stream.server";
beforeEach(() => {
  state.intake.mockReset().mockResolvedValue({ leadId: "lead", duplicate: false }); state.seen = false; state.claimed = true; state.writes = [];
  vi.stubEnv("GOOGLE_SHEETS_API_KEY", "test-key"); vi.stubEnv("LOVABLE_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ values: [["Name","Phone","Company","Notes"],["Synthetic","01700000000","",""]] })));
});
describe("New Leads stream rules", () => {
  it("runs at 09:30 and 18:30 Dhaka, twice daily", () => expect(NEW_LEADS_SCHEDULE).toBe("30 3,12 * * *"));
  it("refuses report mirror headers", () => expect(() => parseNewLeadGrid([["Lead","Phone","Agent","Status"]])).toThrow("columns changed"));
  it("counts incomplete rows without fabricating names", () => expect(parseNewLeadGrid([["Name","Phone","Company","Notes"],["","01700000000"]]).invalid).toBe(1));
  it("refuses truncated oversize reads", () => expect(() => parseNewLeadGrid(Array(5002).fill([]))).toThrow("limit"));
  it("imports unassigned through canonical intake", async () => { const r = await runSheetLeadStream("test"); expect(r).toMatchObject({ created: 1 }); expect(state.intake).toHaveBeenCalledWith(expect.objectContaining({ ownerId: null, source: "google_sheet" })); });
  it("does not repeat unchanged rows", async () => { state.seen = true; const r = await runSheetLeadStream("test"); expect(r).toMatchObject({ unchanged: 1 }); expect(state.intake).not.toHaveBeenCalled(); });
  it("keeps duplicates unchanged", async () => { state.intake.mockResolvedValue({ leadId: "existing", duplicate: true }); expect(await runSheetLeadStream("test")).toMatchObject({ created: 0, duplicates: 1 }); });
  it("does not import when run is already claimed", async () => { state.claimed = false; expect(await runSheetLeadStream("test")).toEqual({ skipped: true }); expect(state.intake).not.toHaveBeenCalled(); });
  it("fails closed when Sheets is unavailable", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private", { status: 403 }))); await expect(runSheetLeadStream("test")).rejects.toThrow("intake failed"); expect(state.intake).not.toHaveBeenCalled(); });
});