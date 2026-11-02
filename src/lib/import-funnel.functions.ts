import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const MAX_DAYS = 92;

const Input = z
  .object({ adminToken: z.string().nullable().optional(), from: Day, to: Day })
  .refine((v) => v.from <= v.to, "From must be on or before To")
  .refine(
    (v) => (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / 86_400_000 < MAX_DAYS,
    `Pick at most ${MAX_DAYS} days`,
  );

/**
 * Read-only import → cleanup → assignment completion for leads imported in a
 * Dhaka date range. LeadHub PIN only; returns counts and delays, never lead
 * identities or contact details.
 */
export const leadImportFunnel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    await requireLeadHub(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const { IMPORT_SOURCES, computeImportFunnel, dhakaRangeToUtc } = await import("@/lib/import-funnel");
    const { startIso, endIso } = dhakaRangeToUtc(data.from, data.to);

    const leads = await pageAllParallel((a, b) =>
      supabaseAdmin
        .from("leads")
        .select("id, source, created_at, assigned_to, assignment_source")
        .in("source", [...IMPORT_SOURCES])
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b),
    );
    if (leads.error) throw new Error("Could not read imported leads");

    // First hand-out from the pool: no previous agent, a receiving agent.
    // A lead can't be assigned before it exists, so the range start bounds it.
    const assignments = await pageAllParallel((a, b) =>
      supabaseAdmin
        .from("lead_assignments")
        .select("id, lead_id, created_at")
        .is("from_agent_id", null)
        .not("to_agent_id", "is", null)
        .gte("created_at", startIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(a, b),
    );
    if (assignments.error) throw new Error("Could not read assignment history");

    // Rows turned away before saving, from import audit entries that recorded counts.
    const { data: audits, error: auditError } = await supabaseAdmin
      .from("audit_logs")
      .select("metadata")
      .eq("action", "lead_imported")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(1000);
    if (auditError) throw new Error("Could not read import history");
    let rowsReceived = 0, rowsTurnedAway = 0, batches = 0;
    for (const r of audits ?? []) {
      const m = (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}) as Record<string, unknown>;
      const inc = Number(m.incoming), ok = Number(m.eligibleNew);
      if (!Number.isFinite(inc) || !Number.isFinite(ok)) continue;
      batches += 1;
      rowsReceived += inc;
      rowsTurnedAway += Math.max(0, inc - ok);
    }

    const leadIds = new Set((leads.data ?? []).map((l) => l.id));
    const funnel = computeImportFunnel(
      leads.data ?? [],
      (assignments.data ?? []).filter((a) => leadIds.has(a.lead_id)),
      Date.now(),
    );
    return { from: data.from, to: data.to, ...funnel, intake: { batches, rowsReceived, rowsTurnedAway } };
  });
