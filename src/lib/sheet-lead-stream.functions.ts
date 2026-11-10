import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const Input = z.object({ adminToken: z.string().nullable().optional() });
export const sheetLeadStreamStatus = createServerFn({ method: "POST" }).inputValidator((i: unknown) => Input.parse(i ?? {})).handler(async ({ data }) => {
  const { resolveCaller, requireAuthority } = await import("./access.server");
  requireAuthority(await resolveCaller(data.adminToken));
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const result = await db.from("sheet_lead_intake_runs").select("status,started_at,finished_at,result").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("Sheet intake status unavailable");
  return result.data;
});
export const syncNewSheetLeads = createServerFn({ method: "POST" }).inputValidator((i: unknown) => Input.parse(i ?? {})).handler(async ({ data }) => {
  const { resolveCaller, requireAuthority, requireWrite } = await import("./access.server");
  const caller = await resolveCaller(data.adminToken); requireAuthority(caller); requireWrite(caller);
  const { runSheetLeadStream } = await import("./sheet-lead-stream.server");
  return runSheetLeadStream(`manual:${crypto.randomUUID()}`);
});