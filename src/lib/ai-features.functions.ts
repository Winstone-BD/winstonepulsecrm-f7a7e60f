import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Lang = z.enum(["bn", "en"]).default("bn");

/** Agents see only their own leads; HQ/IT master PIN can look at any agent. */
async function agentScope(adminToken: string | null | undefined, agentId?: string) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(adminToken ?? null);
  if (c.scope === "authority") {
    if (!agentId) throw new Error("Agent id required");
    return agentId;
  }
  if (c.scope !== "agent" || !c.profile) throw new Error("Sign in required");
  return c.profile.id;
}

export const getAiLeadPriority = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ adminToken: z.string().nullable().optional(), agentId: z.string().uuid().optional() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const agentId = await agentScope(data.adminToken, data.agentId);
    const m = await import("@/lib/ai-features.server");
    return m.leadPriorityForAgent(agentId);
  });

export const draftAiMessage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        leadId: z.string().uuid(),
        lang: Lang,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const agentId = await agentScope(data.adminToken);
    const m = await import("@/lib/ai-features.server");
    return m.draftLeadMessage(data.leadId, agentId, data.lang);
  });

export const getAiTeamSummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), lang: Lang }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope !== "authority") throw new Error("HQ / IT master PIN required");
    const m = await import("@/lib/ai-features.server");
    return m.teamDailySummary(data.lang);
  });

export const getAiModel = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope === "none") throw new Error("Sign in required");
    const m = await import("@/lib/ai-model.server");
    return m.getAiModelStatus();
  });

export const setAiModel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ adminToken: z.string().min(1), model: z.enum(["openai", "gemini", "meta", "vertex"]) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken);
    if (c.scope !== "authority" || c.readOnly) throw new Error("HQ / IT master PIN required");
    const m = await import("@/lib/ai-model.server");
    await m.setAiModelChoice(data.model);
    return { ok: true as const, model: data.model };
  });

export const tidyAiReportNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), text: z.string().max(4000), lang: Lang }).parse(i),
  )
  .handler(async ({ data }) => {
    await agentScope(data.adminToken);
    const m = await import("@/lib/ai-features.server");
    return m.tidyReportNote(data.text, data.lang);
  });

export const getAiLeadNextStep = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), leadId: z.string().uuid(), lang: Lang }).parse(i),
  )
  .handler(async ({ data }) => {
    const agentId = await agentScope(data.adminToken);
    const m = await import("@/lib/ai-features.server");
    return m.leadNextStep(data.leadId, agentId, data.lang);
  });

export const getAiCallLogInsights = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: z.string().nullable().optional(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      lang: Lang,
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const m = await import("@/lib/ai-features.server");
    return m.callLogMatchInsights(data.day, data.lang);
  });
