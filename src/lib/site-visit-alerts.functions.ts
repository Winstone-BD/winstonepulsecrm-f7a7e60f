import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Read-only management feed. Event creation/resolution lives in database triggers. */
export const readSiteVisitAlerts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const result = await pageAllParallel((a, b) => supabaseAdmin.from("system_alerts")
      .select("id,title,detail,action,created_at")
      .like("code", "site_visit_unbooked:%")
      .is("resolved_at", null)
      .order("created_at", { ascending: false }).order("id").range(a, b));
    if (result.error) throw new Error("Site visit alerts unavailable");
    return { alerts: result.data ?? [], generatedAt: new Date().toISOString() };
  });