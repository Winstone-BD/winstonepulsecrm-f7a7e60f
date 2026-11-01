/** Browser-safe status of the Report Sheet's Google Sheet writes, from recorded sync events. */
export type ReportSheetWriteEvents = {
  lastWriteSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureStatus: number | null;
};

export type ReportSheetStatus = "ok" | "failing" | "unknown";

/** "failing" when the newest recorded event is a failure; "unknown" with no successful write on record. */
export function reportSheetStatus(e: ReportSheetWriteEvents): ReportSheetStatus {
  const ok = e.lastWriteSuccessAt ? Date.parse(e.lastWriteSuccessAt) : null;
  const bad = e.lastFailureAt ? Date.parse(e.lastFailureAt) : null;
  if (bad !== null && (ok === null || bad > ok)) return "failing";
  if (ok === null) return "unknown";
  return "ok";
}
