import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_DAYS = 92;
const DAY = 86_400_000;

const Input = z
  .object({ adminToken: z.string().nullable().optional(), from: Day, to: Day })
  .refine((v) => v.from <= v.to, "From must be on or before To")
  .refine((v) => (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / DAY < MAX_DAYS, `Pick at most ${MAX_DAYS} days`);

/**
 * Read-only conversation → next action / site visit / booking summary for a
 * Dhaka date range. HQ/IT only (authority scope); returns counts and agent
 * display names, never lead identities, phone numbers or notes.
 */
export const conversationOutcomes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT Console access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const { computeConversationOutcomes, ATTRIBUTION_DAYS } = await import("@/lib/conversation-outcomes");
    const { dhakaRangeToUtc } = await import("@/lib/import-funnel");
    const { startIso, endIso } = dhakaRangeToUtc(data.from, data.to);
    const outcomeEndIso = new Date(Date.parse(endIso) + ATTRIBUTION_DAYS * DAY).toISOString();

    const reports = await pageAllParallel((a, b) =>
      supabaseAdmin
        .from("call_reports")
        .select("id, lead_id, agent_id, submitted_at, connected, connection_verified, follow_up_at")
        .eq("status", "submitted")
        .eq("connected", true)
        .gte("submitted_at", startIso)
        .lt("submitted_at", endIso)
        .order("submitted_at", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b),
    );
    if (reports.error) throw new Error("Could not read call reports");
    const reportIds = new Set((reports.data ?? []).map((r) => r.id));

    const [followUps, visits, bookings, profiles] = await Promise.all([
      pageAllParallel((a, b) =>
        supabaseAdmin
          .from("follow_up_events")
          .select("id, report_id")
          .not("report_id", "is", null)
          .gte("created_at", startIso)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(a, b),
      ),
      pageAllParallel((a, b) =>
        supabaseAdmin
          .from("site_visits")
          .select("id, lead_id, created_at, status")
          .gte("created_at", startIso)
          .lt("created_at", outcomeEndIso)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(a, b),
      ),
      pageAllParallel((a, b) =>
        supabaseAdmin
          .from("bookings")
          .select("id, lead_id, booked_at, status, approval_status")
          .gte("booked_at", new Date(Date.parse(startIso) - 60_000).toISOString())
          .lt("booked_at", outcomeEndIso)
          .order("booked_at", { ascending: true })
          .order("id", { ascending: true })
          .range(a, b),
      ),
      supabaseAdmin.from("profiles").select("id, name"),
    ]);
    if (followUps.error || visits.error || bookings.error || profiles.error) throw new Error("Could not read follow-up outcomes");

    const result = computeConversationOutcomes(
      reports.data ?? [],
      (followUps.data ?? []).filter((f) => f.report_id && reportIds.has(f.report_id)),
      visits.data ?? [],
      bookings.data ?? [],
    );
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name as string | null]));
    return {
      from: data.from,
      to: data.to,
      attributionDays: result.attributionDays,
      totals: result.totals,
      byAgent: result.byAgent.map((r) => ({ ...r, name: names.get(r.agentId) ?? "Unknown agent" })),
    };
  });
