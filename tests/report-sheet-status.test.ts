import { describe, expect, it } from "vitest";
import { reportSheetStatus } from "@/lib/report-sheet-status";

describe("report sheet live status", () => {
  it("is failing when the newest event is a failure (today's 403s after the 10:50 write)", () => {
    expect(reportSheetStatus({ lastWriteSuccessAt: "2026-11-01T10:50:45Z", lastFailureAt: "2026-11-01T11:18:27Z", lastFailureStatus: 403 })).toBe("failing");
  });
  it("is ok once a write succeeds after the last failure", () => {
    expect(reportSheetStatus({ lastWriteSuccessAt: "2026-11-01T16:40:00Z", lastFailureAt: "2026-11-01T11:18:27Z", lastFailureStatus: 403 })).toBe("ok");
  });
  it("is unknown with no successful write on record", () => {
    expect(reportSheetStatus({ lastWriteSuccessAt: null, lastFailureAt: null, lastFailureStatus: null })).toBe("unknown");
  });
});
