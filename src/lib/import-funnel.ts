/**
 * Lead import → cleanup → assignment completion, computed from saved rows only.
 *
 * Stages per imported lead (counts only, never names or numbers):
 *  - imported:     the lead row exists in the canonical database
 *  - parked:       cleanup set it aside as duplicate/invalid (duplicate_skipped)
 *  - clean:        imported minus parked
 *  - distributed:  ever handed to an agent (first lead_assignments row, or an
 *                  agent on the lead today when no history row was written)
 *  - unassigned:   clean, never distributed, still in the pool
 *  - returned:     distributed earlier, now back in the pool (e.g. neglect recall)
 *
 * Delays come only from saved timestamps. Cleanup has no saved timestamp, so
 * its delay is never reported; leads assigned without a history row count as
 * distributed with an unknown delay rather than a guessed one.
 */

/** Lead `source` values written by import paths (CSV, file review, head DB loads). */
export const IMPORT_SOURCES = [
  "Winstone Company",
  "head_database",
  "head_office",
  "public_directory",
  "zhc_import",
  "csv",
  "csv_import",
  "import",
] as const;

export type FunnelLead = {
  id: string;
  source: string;
  created_at: string;
  assigned_to: string | null;
  assignment_source: string | null;
};

export type FunnelAssignment = { lead_id: string; created_at: string };

export type DelayStats = { measured: number; medianHours: number | null; p90Hours: number | null };

export type FunnelCounts = {
  imported: number;
  parked: number;
  clean: number;
  distributed: number;
  distributedUntimed: number;
  unassigned: number;
  returned: number;
  /** distributed / clean, 0..100, null when nothing clean */
  completionPct: number | null;
  toAssignment: DelayStats;
  /** how long still-unassigned clean leads have waited so far */
  waiting: DelayStats & { oldestHours: number | null };
};

export type FunnelRow = FunnelCounts & { key: string };

export type ImportFunnel = {
  totals: FunnelCounts;
  byDay: FunnelRow[];
  bySource: FunnelRow[];
};

const HOUR = 3_600_000;

export function dhakaDay(iso: string): string {
  return new Date(Date.parse(iso) + 6 * HOUR).toISOString().slice(0, 10);
}

export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function stats(hours: number[]): DelayStats {
  const s = [...hours].sort((a, b) => a - b);
  const round = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  return { measured: s.length, medianHours: round(percentile(s, 50)), p90Hours: round(percentile(s, 90)) };
}

type Acc = {
  imported: number; parked: number; distributed: number; distributedUntimed: number;
  unassigned: number; returned: number; toAssign: number[]; waiting: number[];
};
const emptyAcc = (): Acc => ({ imported: 0, parked: 0, distributed: 0, distributedUntimed: 0, unassigned: 0, returned: 0, toAssign: [], waiting: [] });

function finish(a: Acc): FunnelCounts {
  const clean = a.imported - a.parked;
  const w = stats(a.waiting);
  const oldest = a.waiting.length ? Math.round(Math.max(...a.waiting) * 10) / 10 : null;
  return {
    imported: a.imported,
    parked: a.parked,
    clean,
    distributed: a.distributed,
    distributedUntimed: a.distributedUntimed,
    unassigned: a.unassigned,
    returned: a.returned,
    completionPct: clean > 0 ? Math.round((a.distributed / clean) * 1000) / 10 : null,
    toAssignment: stats(a.toAssign),
    waiting: { ...w, oldestHours: oldest },
  };
}

export function computeImportFunnel(
  leads: FunnelLead[],
  assignments: FunnelAssignment[],
  nowMs: number,
): ImportFunnel {
  const sources = new Set<string>(IMPORT_SOURCES);
  const first = new Map<string, number>();
  for (const a of assignments) {
    const t = Date.parse(a.created_at);
    if (!Number.isFinite(t)) continue;
    const prev = first.get(a.lead_id);
    if (prev === undefined || t < prev) first.set(a.lead_id, t);
  }

  const total = emptyAcc();
  const days = new Map<string, Acc>();
  const bySrc = new Map<string, Acc>();
  const seen = new Set<string>();

  for (const l of leads) {
    if (!sources.has(l.source) || seen.has(l.id)) continue;
    seen.add(l.id);
    const created = Date.parse(l.created_at);
    if (!Number.isFinite(created)) continue;
    const day = dhakaDay(l.created_at);
    const targets = [total, getOr(days, day), getOr(bySrc, l.source)];
    const parked = l.assignment_source === "duplicate_skipped";
    const firstAt = first.get(l.id);
    const assignedNow = l.assigned_to != null;
    for (const acc of targets) {
      acc.imported += 1;
      if (parked) { acc.parked += 1; continue; }
      if (firstAt !== undefined) {
        acc.distributed += 1;
        acc.toAssign.push(Math.max(0, firstAt - created) / HOUR);
        if (!assignedNow) acc.returned += 1;
      } else if (assignedNow) {
        acc.distributed += 1;
        acc.distributedUntimed += 1;
      } else {
        acc.unassigned += 1;
        acc.waiting.push(Math.max(0, nowMs - created) / HOUR);
      }
    }
  }

  return {
    totals: finish(total),
    byDay: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, a]) => ({ key, ...finish(a) })),
    bySource: [...bySrc.entries()].map(([key, a]) => ({ key, ...finish(a) })).sort((a, b) => b.imported - a.imported),
  };
}

function getOr(m: Map<string, Acc>, k: string): Acc {
  let v = m.get(k);
  if (!v) { v = emptyAcc(); m.set(k, v); }
  return v;
}

/** Dhaka YYYY-MM-DD → UTC ISO bounds [start, endExclusive). */
export function dhakaRangeToUtc(from: string, to: string): { startIso: string; endIso: string } {
  const start = Date.parse(`${from}T00:00:00Z`) - 6 * HOUR;
  const end = Date.parse(`${to}T00:00:00Z`) - 6 * HOUR + 24 * HOUR;
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}
