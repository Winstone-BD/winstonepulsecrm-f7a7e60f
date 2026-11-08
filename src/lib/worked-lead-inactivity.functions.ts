import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWorkedLeadWarnings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority" && (caller.scope !== "agent" || !caller.profile)) throw new Error("Staff access required");
    const { readWorkedLeadWarnings } = await import("@/lib/worked-lead-inactivity.server");
    return readWorkedLeadWarnings(caller.scope === "agent" ? caller.profile?.id : undefined);
  });