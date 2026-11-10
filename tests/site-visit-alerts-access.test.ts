import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ scope: "authority", error: false, reads: 0 }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: (validate: (v: unknown) => unknown) => ({ handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }) }) }) }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: state.scope }), requireAuthority: (c: { scope: string }) => { if (c.scope !== "authority") throw new Error("Master PIN required"); } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  state.reads++; const q: Record<string, unknown> = {};
  for (const key of ["select", "like", "is", "order"]) q[key] = () => q;
  q.range = async () => ({ data: [{ id: "alert-1", title: "Visit", detail: "Saved signal", action: null, created_at: "2026-11-10T04:00:00Z" }], error: state.error ? { message: "private" } : null });
  return q;
} } }));
import { readSiteVisitAlerts } from "@/lib/site-visit-alerts.functions";
const run = readSiteVisitAlerts as unknown as (args: { data: object }) => Promise<{ alerts: { id: string }[] }>;
describe("site visit alert access", () => {
  it.each(["agent", "none", "leadhub"])("refuses %s before reading", async scope => { state.scope = scope; state.reads = 0; await expect(run({ data: {} })).rejects.toThrow("Master PIN required"); expect(state.reads).toBe(0); });
  it("permits read-only management", async () => { state.scope = "authority"; state.error = false; expect((await run({ data: {} })).alerts.map(a => a.id)).toEqual(["alert-1"]); });
  it("does not fabricate an empty feed on read failure", async () => { state.scope = "authority"; state.error = true; await expect(run({ data: {} })).rejects.toThrow("Site visit alerts unavailable"); state.error = false; });
});