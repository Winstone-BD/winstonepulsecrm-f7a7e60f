import { describe, expect, it } from "vitest";

import { computeImportFunnel, dhakaDay, dhakaRangeToUtc, type FunnelLead } from "@/lib/import-funnel";

const NOW = Date.parse("2026-11-02T10:00:00Z");
const lead = (id: string, created: string, extra: Partial<FunnelLead> = {}): FunnelLead => ({
  id, source: "csv_import", created_at: created, assigned_to: null, assignment_source: null, ...extra,
});

describe("lead import funnel", () => {
  it("separates parked, distributed, unassigned and returned leads", () => {
    const leads = [
      lead("a", "2026-11-01T04:00:00Z", { assigned_to: "x", assignment_source: "leadhub" }),
      lead("b", "2026-11-01T04:00:00Z", { assignment_source: "duplicate_skipped" }),
      lead("c", "2026-11-01T04:00:00Z"),
      lead("d", "2026-11-01T04:00:00Z"), // assigned earlier, recalled to pool
      lead("e", "2026-11-01T04:00:00Z", { assigned_to: "y" }), // no history row
    ];
    const f = computeImportFunnel(
      leads,
      [
        { lead_id: "a", created_at: "2026-11-01T06:00:00Z" },
        { lead_id: "a", created_at: "2026-11-01T05:00:00Z" },
        { lead_id: "d", created_at: "2026-11-01T14:00:00Z" },
      ],
      NOW,
    );
    expect(f.totals).toMatchObject({ imported: 5, parked: 1, clean: 4, distributed: 3, distributedUntimed: 1, unassigned: 1, returned: 1, completionPct: 75 });
    // first assignment wins: a = 1h, d = 10h
    expect(f.totals.toAssignment).toEqual({ measured: 2, medianHours: 1, p90Hours: 10 });
    // c has waited 30h so far
    expect(f.totals.waiting.oldestHours).toBe(30);
  });

  it("ignores leads that did not come from an import path", () => {
    const f = computeImportFunnel([lead("w", "2026-11-01T04:00:00Z", { source: "webhook" })], [], NOW);
    expect(f.totals.imported).toBe(0);
    expect(f.totals.completionPct).toBeNull();
  });

  it("groups import days by Dhaka date", () => {
    expect(dhakaDay("2026-10-31T19:30:00Z")).toBe("2026-11-01");
    expect(dhakaRangeToUtc("2026-11-01", "2026-11-01")).toEqual({
      startIso: "2026-10-31T18:00:00.000Z",
      endIso: "2026-11-01T18:00:00.000Z",
    });
  });
});
