import { NEW_LEADS_SHEET, parseNewLeadGrid } from "./sheet-lead-stream";

export async function runSheetLeadStream(slot: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const claimed = await db.rpc("claim_sheet_lead_intake", { _slot: slot });
  if (claimed.error) throw new Error("Sheet intake claim failed");
  if (!claimed.data) return { skipped: true };
  const runId = claimed.data;
  const result = { created: 0, duplicates: 0, unchanged: 0, invalid: 0, total: 0 };
  const deadline = Date.now() + 120000;
  try {
    const key = process.env["GOOGLE_SHEETS_API_KEY"], lovableKey = process.env["LOVABLE_API_KEY"];
    if (!key || !lovableKey) throw new Error("Sheets connection unavailable");
    const res = await fetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${NEW_LEADS_SHEET}/values/'New Leads'!A1:D5002?valueRenderOption=FORMATTED_VALUE`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": key }, signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Sheets read failed (${res.status})`);
    const payload = await res.json() as { values?: unknown[][] };
    const parsed = parseNewLeadGrid(payload.values ?? []);
    result.invalid = parsed.invalid; result.total = parsed.rows.length + parsed.invalid;
    const { intakeLead, InvalidLeadPhoneError } = await import("./lead-intake.server");
    for (const row of parsed.rows) {
      if (Date.now() > deadline) throw new Error("Intake time limit reached; resume on next run");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([NEW_LEADS_SHEET, row])));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
      const prior = await db.from("sheet_lead_intake_receipts").select("row_hash").eq("row_hash", hash).maybeSingle();
      if (prior.error) throw new Error("Sheet receipt read failed");
      if (prior.data) { result.unchanged++; continue; }
      try {
        const lead = await intakeLead({ ...row, ownerId: null, source: "google_sheet", actorLabel: "New Leads sheet intake" });
        const receipt = await db.from("sheet_lead_intake_receipts").insert({ row_hash: hash, lead_id: lead.leadId, outcome: lead.duplicate ? "duplicate" : "created" });
        if (receipt.error) throw new Error("Sheet receipt save failed");
        if (lead.duplicate) result.duplicates++; else result.created++;
      } catch (error) {
        if (error instanceof InvalidLeadPhoneError) { result.invalid++; continue; }
        throw error;
      }
    }
    const saved = await db.from("sheet_lead_intake_runs").update({ status: "success", finished_at: new Date().toISOString(), result }).eq("id", runId);
    if (saved.error) throw new Error("Sheet result save failed");
    return result;
  } catch {
    await db.from("sheet_lead_intake_runs").update({ status: "failed", finished_at: new Date().toISOString(), result: { ...result, code: "INTAKE_FAILED" } }).eq("id", runId);
    throw new Error("New Leads intake failed; saved receipts remain for retry");
  }
}