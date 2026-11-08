import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  FINOS_ACCESS_ACTION, FINOS_ACCESS_ENTITY, FINOS_PROJECT_ID, FINOS_LOG_PAGE_SIZE,
  finosReceiptSchema, projectFinosLog, requireFinosConsumer, type FinosReceipt,
} from "./finos-access";

/**
 * Server-only integration hook. Call after authenticating FinOS and computing
 * its allowed aggregate response, BEFORE returning it. No public log-write RPC.
 * An audit failure must abort the summary response, not silently lose history.
 * This records a summary served by CRM, not proof the remote human read it.
 */
export async function recordFinosSummaryServed(
  db: SupabaseClient<Database>, verifiedProjectId: string | null, receipt: FinosReceipt,
) {
  requireFinosConsumer(verifiedProjectId);
  const safeReceipt = finosReceiptSchema.parse(receipt);
  const { error } = await db.from("audit_logs").insert({
    action: FINOS_ACCESS_ACTION,
    entity_type: FINOS_ACCESS_ENTITY,
    entity_id: FINOS_PROJECT_ID,
    actor_label: "WINSTONE FinOS",
    metadata: safeReceipt,
  });
  if (error) throw new Error("FinOS access receipt could not be saved");
}

export async function readFinosAccessLog(db: SupabaseClient<Database>, page: number, type: "all" | "financial" | "work") {
  let query = db.from("audit_logs")
    .select("id,created_at,metadata", { count: "exact" })
    .eq("action", FINOS_ACCESS_ACTION)
    .eq("entity_type", FINOS_ACCESS_ENTITY)
    .eq("entity_id", FINOS_PROJECT_ID);
  if (type !== "all") query = query.eq("metadata->>summaryType", type);
  const { data, error, count } = await query
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(page * FINOS_LOG_PAGE_SIZE, (page + 1) * FINOS_LOG_PAGE_SIZE - 1);
  if (error || count === null) throw new Error("FinOS access log unavailable");
  return { rows: (data ?? []).map(projectFinosLog), total: count };
}