import { z } from "zod";

export const FINOS_PROJECT_ID = "f768534d-0fe7-47ec-8792-430174738943";
export const FINOS_ACCESS_ACTION = "finos_summary_served";
export const FINOS_ACCESS_ENTITY = "finos_summary";
export const FINOS_LOG_PAGE_SIZE = 25;

export const finosReceiptSchema = z.object({
  summaryType: z.enum(["financial", "work"]),
  requestId: z.string().uuid(),
  from: z.string().date(),
  to: z.string().date(),
}).strict().refine((value) => value.from <= value.to, { message: "Invalid summary period" });

export type FinosReceipt = z.infer<typeof finosReceiptSchema>;
export type FinosLogRow = FinosReceipt & { id: string; servedAt: string };

/** Project identity comes from future server authentication, never request input. */
export function requireFinosConsumer(verifiedProjectId: string | null) {
  if (verifiedProjectId !== FINOS_PROJECT_ID) throw new Error("Verified FinOS consumer required");
}

export function projectFinosLog(row: { id: string; created_at: string; metadata: unknown }): FinosLogRow {
  const receipt = finosReceiptSchema.parse(row.metadata);
  return { ...receipt, id: row.id, servedAt: row.created_at };
}