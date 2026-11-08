# Roadmap

## Open tasks
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
