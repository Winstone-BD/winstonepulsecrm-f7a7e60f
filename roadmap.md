# Roadmap

## Open tasks
1. Re-link connectors after workspace move (old workspace links invalid):
   - [ ] Google Drive
   - [ ] Google Search Console
   - [ ] Google Sheets
   - [ ] WhatsApp Business
2. Android official release: verify signing password and produce company-signed APK.
   - Blocker: signing keystore/passwords live in GitHub secrets / user's PC; I cannot trigger GitHub Actions or access secrets from here. Workflow preflight already validates the password without printing it — user must re-run the workflow.
