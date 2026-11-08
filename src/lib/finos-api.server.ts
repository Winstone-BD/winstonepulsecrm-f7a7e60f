import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FINOS_PROJECT_ID, type FinosReceipt } from "./finos-access";
import { finosDateBounds, finosSummaryInput, verifyFinosSignature, type FinosSummaryInput } from "./finos-api";
import { recordFinosSummaryServed } from "./finos-access.server";
import { pageAllParallel } from "./page-all";

export async function loadFinosSummary(db: SupabaseClient<Database>, input: FinosSummaryInput) {
  const { start, end } = finosDateBounds(input);
  if (input.summaryType === "financial") {
    const counted = await db.from("bookings").select("id", { count: "exact", head: true })
      .eq("approval_status", "approved").neq("status", "cancelled")
      .gte("booked_at", start).lt("booked_at", end);
    if (counted.error || counted.count === null || counted.count > 10000) throw new Error("Summary unavailable");
    const result = await pageAllParallel<{ id: string; amount_usd: number | null }>((from, to) => db.from("bookings").select("id,amount_usd")
      .eq("approval_status", "approved").neq("status", "cancelled")
      .gte("booked_at", start).lt("booked_at", end).order("id").range(from, to), { concurrency: 1 });
    if (result.error || !result.data || result.data.length !== counted.count) throw new Error("Summary unavailable");
    let cents = 0, unknown = 0;
    for (const row of result.data) {
      if (row.amount_usd === null) { unknown++; continue; }
      if (!Number.isFinite(row.amount_usd) || row.amount_usd < 0) throw new Error("Invalid saved amount");
      cents += Math.round(row.amount_usd * 100);
      if (!Number.isSafeInteger(cents)) throw new Error("Amount overflow");
    }
    return { approvedNonCancelledBookings: result.data.length, recordedBookingAmountUsd: cents / 100, bookingsWithoutAmount: unknown };
  }
  const results = await Promise.all([
    db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
    db.from("call_reports").select("id", { count: "exact", head: true }).eq("status", "submitted").gte("submitted_at", start).lt("submitted_at", end),
    db.from("follow_up_events").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
  ]);
  if (results.some((r) => r.error || r.count === null)) throw new Error("Summary unavailable");
  return { leadsCreated: results[0].count, reportsSubmitted: results[1].count, followUpsCreated: results[2].count };
}

type Dependencies = {
  enabled: boolean; secret: string | undefined;
  load: (input: FinosSummaryInput) => Promise<unknown>;
  log: (receipt: FinosReceipt) => Promise<void>;
};
export async function handleFinosSummary(request: Request, deps: Dependencies): Promise<Response> {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  if (!deps.enabled || !deps.secret || deps.secret.length < 32) return reply({ error: "integration_disabled" }, 503);
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "json_required" }, 415);
  // Stream size cap before decoding, including chunked requests.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "invalid_request" }, 400);
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); return reply({ error: "request_too_large" }, 413); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const body = new TextDecoder().decode(bytes);
  if (!await verifyFinosSignature(deps.secret, request, body)) return reply({ error: "unauthorized" }, 401);
  let input: FinosSummaryInput;
  try { input = finosSummaryInput.parse(JSON.parse(body)); } catch { return reply({ error: "invalid_summary_period_or_type" }, 400); }
  try {
    const summary = await deps.load(input);
    const requestId = crypto.randomUUID();
    await deps.log({ ...input, requestId });
    return reply({ requestId, summaryType: input.summaryType, period: { from: input.from, to: input.to, timeZone: "Asia/Dhaka" }, generatedAt: new Date().toISOString(), summary });
  } catch { return reply({ error: "summary_unavailable" }, 503); }
}

export function finosApiDependencies(db: SupabaseClient<Database>, secret: string | undefined, enabled: boolean): Dependencies {
  return { secret, enabled, load: (input) => loadFinosSummary(db, input), log: (receipt) => recordFinosSummaryServed(db, FINOS_PROJECT_ID, receipt) };
}