# Roadmap

## Open tasks
7. FinOS activation and publication (November 8):
   - [x] Pulse shared key presence confirmed; disabled signed probe returned 409 and unsigned probe returned 401; all 28 FinOS tests pass.
   - [x] Owner-requested FINOS_SUMMARY_ENABLED=true configured; real signed local financial/work requests returned 200 with persisted receipts.
   - [ ] Publish Pulse and verify live release/API; FinOS-origin read remains unverified because its separate secret store, session and deployment cannot be changed from this chat.
6. FinOS key safety:
   - [x] Presence-only full-IT status, secure replacement guidance and wrong-signature refusal before activation; 28 tests passed.
   - [ ] Real key replacement and signed FinOS check — requires secure shared-secret entry in both apps and FinOS consumer; no key rotation, activation or publication performed.
5. Pulse FinOS summary API:
   - [x] Signed aggregate-only endpoint, bounded Dhaka periods, receipt-before-return and 21 passing tests prepared; local endpoint confirms disabled.
   - [ ] Real FinOS end-to-end test — receiving-project consumer now exists; Pulse activated on November 8, but matching FinOS secret and deployed authenticated consumer read remain unverified.
4. FinOS access log:
   - [x] Read-only IT Access viewer and server-only summary-serving receipt hook; privacy/failure tests passed. No backfilled reads or live writes.
   - [ ] Real FinOS receipt end-to-end verification — blocked by missing authenticated FinOS consumer; viewer does not activate data access.
3. FinOS financial/work summary read access:
   - [x] Owner authorization recorded: both summary types, aggregate-only, read-only; no customer records or mutations.
   - [ ] Verify authenticated app-to-app reads — FinOS snapshot now contains a scoped signed consumer; its configuration and deployment must be verified in its own chat. Pulse activation/publication requested November 8.
1. Re-link connectors after workspace move:
   - [x] Google Drive
   - [ ] Google Search Console — skipped by user
   - [x] Google Sheets
   - [ ] WhatsApp Business — skipped by user (HQ WhatsApp reports won't send until linked)
2. Android official signed APK — blocker: signing key/passwords live only in GitHub secrets / user's PC; user must fix WINSTONE_KEY_PASSWORD and run the workflow.
