import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** HQ/IT (authority) read-only: one Dhaka day's call-log match counts per agent and team. */
export const getCallLogMatchSummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: z.string().nullable().optional(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { dhakaDateOf } = await import("@/lib/business-day");
    const day = data.day ?? dhakaDateOf();
    const { readCallLogMatchSummary } = await import("@/lib/call-log-match-summary.server");
    const summary = await readCallLogMatchSummary(day);
    return { day, checkedAt: new Date().toISOString(), ...summary };
  });
