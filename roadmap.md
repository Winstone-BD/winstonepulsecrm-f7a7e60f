# Roadmap

## Open tasks
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
