import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getFinosSecurityStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().max(256).nullable() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { finosSecurityStatus } = await import("./finos-security.server");
    return finosSecurityStatus(data.adminToken, {
      secret: process.env["FINOS_SUMMARY_SECRET"],
      enabled: process.env["FINOS_SUMMARY_ENABLED"] === "true",
    });
  });

export const getFinosAccessLog = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    adminToken: z.string().max(256).nullable(),
    page: z.number().int().min(0).max(10000),
    summaryType: z.enum(["all", "financial", "work"]),
  }).strict().parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readFinosAccessLog } = await import("./finos-access.server");
    return readFinosAccessLog(supabaseAdmin, data.page, data.summaryType);
  });