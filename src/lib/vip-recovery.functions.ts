import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REVIEW_ACTIONS, REVIEW_DECISIONS } from "./vip-recovery";

const Token = z.string().nullable().optional();
export const getVipRecoveryQueue = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i))
  .handler(async ({ data }) => {
    const { readRecoveryQueue } = await import("./vip-recovery.server");
    return readRecoveryQueue(data.adminToken);
  });

export const saveVipRecoveryReview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, leadId: z.string().uuid(), requestId: z.string().uuid(),
    action: z.enum(REVIEW_ACTIONS), decision: z.enum(REVIEW_DECISIONS), note: z.string().trim().min(1).max(1500) }).parse(i))
  .handler(async ({ data }) => {
    const { appendRecoveryReview } = await import("./vip-recovery.server");
    return appendRecoveryReview(data);
  });