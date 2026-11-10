# Database performance and running-credit review

## Usage baseline

Project-scoped recording window: October 28, 2026 00:00 UTC through November 10, 2026 03:38:46 UTC (current day partial). Recording can lag activity, especially after the workspace move; do not extrapolate this short observed usage to a historical monthly total.

| Recorded resource | Quantity | Requested credits |
| --- | ---: | ---: |
| Small database compute | 2.25 instance-hours | 0.377325001 |
| Network egress | 0.000388982 GB | 0.000175043 |
| File storage | 0.281439696 GB-hours | 0.000040483 |
| Build (separate from running) | Unknown | 0.600000000 |

Returned running usage: 0.377540527 requested credits. No database-storage meter was returned; its quantity is unknown, not zero. Current small-compute quote: 0.1677 credits/hour, or 120.744 requested credits for a hypothetical continuous 720-hour month, before allowances; this is not measured monthly spending.

## Database observations

- Health snapshot: database/pool up, memory 31%, data disk 5%, connections 25/90, pool clients 1/400, database 114.1 MB, WAL 128 MB, zero restarts, no recent exhaustion flag. This does not establish sustained capacity headroom.
- Rollbacks: 70,517 since boot; cumulative, not a current failure rate.
- Query statistics reset time could not be obtained: `pg_stat_statements_info` was unavailable. Statement totals below cannot be mapped to the financial window or treated as CPU time.
- Largest accumulated statement: agent-filtered full lead history, 81,810 calls, 17.70 ms mean, 1,447,945.16 ms total elapsed execution.
- Next: agent lead ownership union, 13,604 calls, 30.99 ms mean, 421,554.35 ms total; floor 31-day history, 14,597 calls, 28.76 ms mean, 419,792.65 ms total.
- Desk follow-up reads: 69,729 calls, 4.36 ms mean; submitted report pages: 19,308 calls, 13.46 ms mean.
- Existing history and ownership indexes already match filters/orders. Bounded privileged plan probes used the history agent/time/id index (1,000 rows, 1.737 ms), and lead updated/time/id index (986 matching rows, 5.676 ms, filtering 5,489 others). These probes bypass ordinary user RLS and are not browser latency measurements. No redundant indexes or permission changes added.
- Largest table/index allocations: append-only audit history ~22 MB, lead history ~15 MB, leads ~9 MB. No retention deletion or storage reclamation justified; allocated billed storage remains unmeasured.

## Implemented change

`src/lib/page-all.ts` was issuing six requests even for an empty or short first page, and twelve for a 6,075-row history. It is shared by CRM snapshots, Desk reports/follow-ups, performance and management reads.

Read page zero alone, then fetch at most three pages concurrently by default. Preserve page order, ID deduplication, all matching rows, ownership and freshness rules. Fail closed if any fetched batch page errors, or the 200-page safety limit is exhausted; old code could return partial success in those cases.

Tests measure requests using identical in-memory row sets; they demonstrate avoided database requests, not live credit savings. Larger lists incur an extra initial round-trip before parallel paging; representative live latency still needs monitoring. No server response cache introduced.

## Scheduled work and unresolved candidates

Nineteen active schedules were listed. Analysis/reminder/deployment sweeps are configured every 15 minutes; agent new-lead WhatsApp polling every 30 minutes during work hours; daily lead-sheet jobs include 17:30 and an older 18:30 schedule. These are configured opportunities, not observed executions or proven duplication.

Inspected the modern lead-sheet callback, WhatsApp callback, Messenger retention handler and deployment-health handler. Old schedule metadata does not expose recognized targets; per-job execution history is unavailable through the safe schedule interface. No schedules disabled or retimed, and no messages sent. Determine useful-work/error rates from authorized job logs before proposing cadence changes.

## Verification and remaining measurements

- 77 tests passed across 11 files: paging, agent ownership, Desk identity/report scope, KPI and FinOS safety regressions. Four new paging tests failed before the fix and passed afterward. Preview build log reports build OK.
- Identical read workload: 0/750 rows 6→1 requests; 2,400 rows 6→4; 6,075 rows 12→7; 9,545 rows 12→10. Returned row counts unchanged. Peak default in-flight page requests 6→3.
- Signed-in authority session opened `/desk`; real floor snapshot loaded with 6,475 leads and no loading skeletons. Authority lacks an agent profile: agent-only progress/allocation cards remained unavailable. This verifies snapshot loading, not agent-only end-to-end counts; no live business actions exercised.
- Compare representative peak CPU, connections and successful-request latency over several business days before considering a smaller instance; one quiet health snapshot is insufficient.
- Actual compute savings require fewer billed active instance-hours or an approved smaller instance. Faster/fewer queries alone do not change the hourly rate.
- Check project Usage details after publication and billing ingestion for comparable windows; no realized credit or cash savings claimed.
- No production business data, schema, access policy, instance size, delivery window or publication changed.