import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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