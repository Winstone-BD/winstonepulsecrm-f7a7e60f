# Roadmap

## Open tasks
15. VIP recovery first batch (preview only):
   - [x] Original cohort matches 17 historically Hot leads (V2 or saved legacy label); one already closed_converted excluded, leaving 16 review candidates. Three already belong to possible recipient Mehedi Ashraf, so only 13 would transfer; no invented investor eligibility or padding to 20.
   - [ ] Recipient confirmation and final approval pending; Mehedi Ashraf already has 50 unique assignments on November 10, so today’s hard cap blocks additional assignments. No reassignment or recovery-review writes performed.
14. Agent sales scorecards:
   - [x] HQ KPI tab now shows current-portfolio conversion from approved bookings, saved visit bookings and confirmed prior-Hot → closed/not-interested losses; Dhaka dates, agent search, CSV and freshness. 31 tests pass; signed-in real read shows 10 agents, search isolates one and CSV exports 10. Desktop/phone checks have no sideways overflow. No KPI/business-data mutations or publication.
13. Database performance and running-credit review (November 10):
   - [x] Measured project usage, database health, top statements, existing indexes and bounded query plans; inspected scheduled-job metadata.
   - [x] Reduced speculative shared paging; 77 tests pass, same rows preserved, short reads 6→1 requests and 6,075-row reads 12→7.
   - [x] Recorded usage/query/index/schedule findings and capacity/billing limits; authority snapshot loaded in signed-in Desk, agent-only cards correctly unavailable for authority session. No resize, data deletion or publication; agent-session and realized-credit measurements remain unverified.
12. Executive VIP Recovery Queue:
   - [x] Original 100 audit IDs retained in case order; HQ queue shows live lead/agent names, saved source, report evidence and one derived management review task per case.
   - [x] Server-gated append-only idempotent management reviews, search/agent/reason/stage filters and permanent history; no lead/ownership/KPI mutations. Signed-in live reads and draft controls verified; saving/read-back exercised with mocked storage only, never production test writes. Not published.
11. Six-number lead audit (November 9):
   - [x] Matched three distinct numbers (four lead rows including one duplicate), reconciled 21 reports and all 227 history IDs, checked 15 V2 scores, and produced a 75-page Bangla evidence PDF; rendered and inspected every page. No CRM writes or unsupported blame.
   - [ ] Resolve three unmatched numbers and independently confirm claimed visits/identity — original source or assignment receipts and agent/customer evidence are required.
10. Bengali 100-lead evidence and training PDF (November 9):
   - [x] Read one current snapshot of 4,184 eligible owned leads; reproducibly selected 100 distinct training cases (40 positive, 30 rejection, 20 unassessed, 10 other), explicitly not a representative conversion estimate.
   - [x] Produced 211-page Bangla PDF with sources, agent comparison, six-answer qualification, all 153 report IDs, follow-up/booking/state histories and training discussion. Reconciled unique IDs and cohort totals; inspected all pages and corrected split checklist content/index overflow. Distinguished stored verification flags from matched phone evidence. Added to Executive Lead Audit collection (pending file status). No CRM writes or publication.
9. Bengali executive audit presentation (November 9):
   - [x] Produced 39-slide downloadable PowerPoint and PDF from supplied sources, with charts, 13 case studies, six agent reviews, visit histories and speaker notes. All slides rendered and inspected; font glyph/number wrapping corrected and rechecked, schema validated. Historical claims and count mismatches explicitly separated; no CRM or live-data changes.
8. Worked pending lead inactivity alerts:
   - [x] Derived current-owner seven-business-day warnings; 22 rules/regression tests pass, signed-in authority UI shows 126 real warnings on desktop/mobile without live writes. Refresh on opening/focus and every 15 minutes while visible; no publication requested.
7. FinOS activation and publication (November 8):
   - [x] Pulse shared key presence confirmed; disabled signed probe returned 409 and unsigned probe returned 401; all 28 FinOS tests pass.
   - [x] Owner-requested FINOS_SUMMARY_ENABLED=true configured; real signed local financial/work requests returned 200 with persisted receipts.
   - [x] Pulse publication requested for https://crm.winstonebd.com; scheduling is not deployment proof.
   - [ ] Verify live release/API and FinOS-origin read — deployment pending; separate FinOS secret store, session and publication cannot be changed from this chat.
6. FinOS key safety:
   - [x] Presence-only full-IT status, secure replacement guidance and wrong-signature refusal before activation; 28 tests passed.
   - [ ] Verify matching key through a real FinOS-origin read — Pulse key is saved and private signed Pulse probes passed; FinOS configuration cannot be verified here. No key rotation performed.
5. Pulse FinOS summary API:
   - [x] Signed aggregate-only endpoint, bounded Dhaka periods, receipt-before-return and 21 passing tests prepared; local endpoint confirms disabled.
   - [ ] Real FinOS end-to-end test — receiving-project consumer now exists; Pulse activated on November 8, but matching FinOS secret and deployed authenticated consumer read remain unverified.
4. FinOS access log:
   - [x] Read-only IT Access viewer and server-only summary-serving receipt hook; privacy/failure tests passed. No backfilled reads or live writes.
   - [ ] Real FinOS-origin receipt verification — local signed probes persisted genuine receipts; receiving-app session/configuration verification remains outstanding.
3. FinOS financial/work summary read access:
   - [x] Owner authorization recorded: both summary types, aggregate-only, read-only; no customer records or mutations.
   - [ ] Verify authenticated app-to-app reads — FinOS snapshot now contains a scoped signed consumer; its configuration and deployment must be verified in its own chat. Pulse activation/publication requested November 8.
1. Re-link connectors after workspace move:
   - [x] Google Drive — linked fresh after November 8 workspace move
   - [ ] Google Search Console — skipped by user
   - [x] Google Sheets — linked fresh after November 8 workspace move
   - [ ] WhatsApp Business — skipped by user (HQ WhatsApp reports won't send until linked)
2. Android official signed APK — blocker: signing key/passwords live only in GitHub secrets / user's PC; user must fix WINSTONE_KEY_PASSWORD and run the workflow.
