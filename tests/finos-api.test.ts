import { describe, expect, it, vi } from "vitest";
import { FINOS_PROJECT_ID } from "@/lib/finos-access";
import { FINOS_API_PATH, finosDateBounds, finosSummaryInput } from "@/lib/finos-api";
import { handleFinosSummary, loadFinosSummary } from "@/lib/finos-api.server";
import { hmacHex } from "@/lib/os-bridge";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const secret = "test-only-not-a-real-credential-123456789";
const input = { summaryType: "financial" as const, from: "2026-11-01", to: "2026-11-08" };
async function request(value: unknown = input, project = FINOS_PROJECT_ID, ts = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(value);
  return new Request(`http://localhost${FINOS_API_PATH}`, { method: "POST", body, headers: {
    "content-type": "application/json", "x-finos-project": project, "x-finos-timestamp": String(ts),
    "x-finos-signature": `sha256=${await hmacHex(secret, `POST\n${FINOS_API_PATH}\n${project}\n${ts}\n${body}`)}`,
  } });
}
function deps() { return { secret, enabled: true, load: vi.fn().mockResolvedValue({ approvedNonCancelledBookings: 2 }), log: vi.fn().mockResolvedValue(undefined) }; }
describe("Pulse FinOS API", () => {
  it("returns only aggregates after receipt persistence", async () => {
    const d = deps(); const response = await handleFinosSummary(await request(), d);
    expect(response.status).toBe(200);
    expect(d.log).toHaveBeenCalledWith(expect.objectContaining(input));
    expect(d.load.mock.invocationCallOrder[0]).toBeLessThan(d.log.mock.invocationCallOrder[0]);
    expect(await response.json()).toMatchObject({ summaryType: "financial", summary: { approvedNonCancelledBookings: 2 }, period: { timeZone: "Asia/Dhaka" } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("stays off by default and never reads data", async () => {
    const d = { ...deps(), enabled: false };
    const response = await handleFinosSummary(await request(), d);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "integration_disabled" });
    expect(d.load).not.toHaveBeenCalled();
    expect(d.log).not.toHaveBeenCalled();
  });
  it("denies an unconfigured key", async () => {
    expect((await handleFinosSummary(await request(), { ...deps(), secret: undefined })).status).toBe(409);
  });
  it("rejects unauthorized requests before activation without data or audit writes", async () => {
    const d = { ...deps(), enabled: false };
    expect((await handleFinosSummary(await request(input, "other-app"), d)).status).toBe(401);
    expect(d.load).not.toHaveBeenCalled(); expect(d.log).not.toHaveBeenCalled();
  });
  it("rejects the previous signature after a key replacement", async () => {
    const d = { ...deps(), secret: "different-test-fixture-credential-not-real" };
    expect((await handleFinosSummary(await request(), d)).status).toBe(401);
    expect(d.load).not.toHaveBeenCalled();
  });
  it("denies another project even with a valid signature", async () => {
    const d = deps(); expect((await handleFinosSummary(await request(input, "other-app"), d)).status).toBe(401);
    expect(d.load).not.toHaveBeenCalled(); expect(d.log).not.toHaveBeenCalled();
  });
  it("denies signatures older than five minutes", async () => {
    expect((await handleFinosSummary(await request(input, FINOS_PROJECT_ID, Math.floor(Date.now()/1000)-301), deps())).status).toBe(401);
  });
  it("denies altered request contents", async () => {
    const r = await request(); const headers = r.headers;
    const altered = new Request(r.url, { method: "POST", headers, body: JSON.stringify({ ...input, summaryType: "work" }) });
    expect((await handleFinosSummary(altered, deps())).status).toBe(401);
  });
  it("fails response if receipt cannot be saved", async () => {
    const d = deps(); d.log.mockRejectedValue(new Error("private failure"));
    const res = await handleFinosSummary(await request(), d);
    expect(res.status).toBe(503); expect(await res.json()).toEqual({ error: "summary_unavailable" });
  });
  it("does not fabricate a receipt when summary loading fails", async () => {
    const d = deps(); d.load.mockRejectedValue(new Error("private"));
    expect((await handleFinosSummary(await request(), d)).status).toBe(503); expect(d.log).not.toHaveBeenCalled();
  });
  it("rejects arbitrary contact fields and more than 31 days", () => {
    expect(finosSummaryInput.safeParse({ ...input, phone: "private" }).success).toBe(false);
    expect(finosSummaryInput.safeParse({ ...input, to: "2026-12-02" }).success).toBe(false);
    expect(finosSummaryInput.safeParse({ ...input, to: "2026-12-01" }).success).toBe(true);
  });
  it("uses inclusive Dhaka dates with exclusive UTC end", () => {
    expect(finosDateBounds(input)).toEqual({ start: "2026-10-31T18:00:00.000Z", end: "2026-11-08T18:00:00.000Z" });
  });
  it("caps raw requests at 2 KB", async () => {
    expect((await handleFinosSummary(await request({ padding: "x".repeat(2049) }), deps())).status).toBe(413);
  });
  it("counts only approved non-cancelled bookings and preserves unknown amounts", async () => {
    const q = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [{ id: "1", amount_usd: 12.34 }, { id: "2", amount_usd: null }], error: null }) };
    q.select.mockImplementation((_fields, opts) => opts?.head ? { eq: () => ({ neq: () => ({ gte: () => ({ lt: () => Promise.resolve({ count: 2, error: null }) }) }) }) } : q);
    for (const method of [q.eq,q.neq,q.gte,q.lt,q.order]) method.mockReturnValue(q);
    const db = { from: vi.fn().mockReturnValue(q) } as unknown as SupabaseClient<Database>;
    expect(await loadFinosSummary(db,input)).toEqual({ approvedNonCancelledBookings: 2, recordedBookingAmountUsd: 12.34, bookingsWithoutAmount: 1 });
    expect(q.eq).toHaveBeenCalledWith("approval_status", "approved"); expect(q.neq).toHaveBeenCalledWith("status", "cancelled");
  });
});