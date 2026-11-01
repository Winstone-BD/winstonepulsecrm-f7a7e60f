import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** IT Console report sheet: read rows, and push them to the Google Sheet. */
const Input = z.object({ adminToken: z.string().nullable().optional() });

async function requireSupervisor(adminToken: string | null) {
  const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  requireDispatch(caller);
  return caller;
}

export const reportSheet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Input.extend({ limit: z.number().int().min(10).max(500).default(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireSupervisor(data.adminToken ?? null);
    const { fetchReportSheetRows, readSyncState, reportSheetUrl, REPORT_SHEET_HEADER } =
      await import("@/lib/report-sheet.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const events = supabaseAdmin.from("sheet_sync_events").select("created_at, http_status").eq("surface", "report_sheet");
    const [rows, sync, okRes, badRes] = await Promise.all([
      fetchReportSheetRows(data.limit),
      readSyncState(),
      events.eq("outcome", "success").neq("operation", "read").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("sheet_sync_events").select("created_at, http_status").eq("surface", "report_sheet").eq("outcome", "failure").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const writes = {
      lastWriteSuccessAt: okRes.error ? null : (okRes.data?.created_at ?? null),
      lastFailureAt: badRes.error ? null : (badRes.data?.created_at ?? null),
      lastFailureStatus: badRes.error ? null : (badRes.data?.http_status ?? null),
      readFailed: Boolean(okRes.error || badRes.error),
    };
    return { rows, header: [...REPORT_SHEET_HEADER], sheetUrl: reportSheetUrl(), sync, writes };
  });

export const pushReportSheet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const caller = await requireSupervisor(data.adminToken ?? null);
    const { syncReportsToSheet } = await import("@/lib/report-sheet.server");
    const result = await syncReportsToSheet({ force: true });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "report_sheet_sync",
      entityType: "call_reports",
      entityId: null,
      metadata: { appended: result.appended },
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
    });
    return result;
  });
