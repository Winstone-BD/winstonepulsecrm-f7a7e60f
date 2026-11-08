# Roadmap

## Open tasks
6. FinOS key safety:
   - [x] Presence-only full-IT status, secure replacement guidance and wrong-signature refusal before activation; 28 tests passed.
   - [ ] Real key replacement and signed FinOS check — requires secure shared-secret entry in both apps and FinOS consumer; no key rotation, activation or publication performed.
5. Pulse FinOS summary API:
   - [x] Signed aggregate-only endpoint, bounded Dhaka periods, receipt-before-return and 21 passing tests prepared; local endpoint confirms disabled.
   - [ ] Activation and real FinOS end-to-end test — needs dedicated shared secret in both apps, FinOS server consumer and explicit publication; no live requests or data changes performed.
4. FinOS access log:
   - [x] Read-only IT Access viewer and server-only summary-serving receipt hook; privacy/failure tests passed. No backfilled reads or live writes.
   - [ ] Real FinOS receipt end-to-end verification — blocked by missing authenticated FinOS consumer; viewer does not activate data access.
3. FinOS financial/work summary read access:
   - [x] Owner authorization recorded: both summary types, aggregate-only, read-only; no customer records or mutations.
   - [ ] Activate authenticated app-to-app reads — blocked: FinOS currently has CRM navigation/health only, no authenticated summary consumer; receiving-project changes must be made in its own chat. No access enabled or deployment requested here.
1. Re-link connectors after workspace move:
   - [x] Google Drive
   - [ ] Google Search Console — skipped by user
   - [x] Google Sheets
   - [ ] WhatsApp Business — skipped by user (HQ WhatsApp reports won't send until linked)
2. Android official signed APK — blocker: signing key/passwords live only in GitHub secrets / user's PC; user must fix WINSTONE_KEY_PASSWORD and run the workflow.
