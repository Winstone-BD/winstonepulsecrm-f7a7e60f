# GitHub sync audit: trendfluxos-dev/winstonepulsecrm (main)

Everything below came from reading only. Nothing was edited, pushed, merged, connected or published.

## 1. Identity and latest commits (verified)

- GitHub repository `trendfluxos-dev/winstonepulsecrm` is Private. Its default branch is `main`, and the connection can read and write it.
- GitHub `main` latest: `46c43d7` "Add files via upload" (13:16 UTC, author trendfluxos-dev, made through the GitHub web upload).
- Project latest (now): `091089d` "Added auto-refresh on stale" (15:53 UTC).
- Last change both sides share: `5b73b37` "Added sync failure drill mode" (11:34 UTC, made by Lovable).
- Cannot verify: which repository and branch Lovable's own sync is linked to, and its official status. Both appear only in Project settings → Git, which is not readable from here.

## 2. What each side has that the other lacks

GitHub only (GitHub compare reports 1 ahead, 0 behind against `5b73b37`):
- `46c43d7` adds one file: `winstone-pulse-crm-main (3).zip`. An earlier review found this ZIP contains the retired Android signing key (`android/winstone-release.jks`) and an old copy of the code.

Project only: 21 changes since `5b73b37` (22 files, about 454 lines added). They are today's GitHub check fixes, the IT Console repository switch, the sync comparison view, the status bar, the countdown and the auto-refresh.

Conflicts: no file conflict is expected, because the only GitHub-side file is a new ZIP the project doesn't have. The split blocks the sync anyway, since both sides moved on from `5b73b37`.

Sensitive files (new finding):
- The project itself still tracks `android/winstone-release.jks`, the retired signing key. It was last touched at a 31 Oct revert, so it is very likely also in `5b73b37` and in GitHub's history. The ZIP is a second copy.
- Also tracked: `public/downloads/winstone-connect-android-studio.zip`. It sits in the public folder, so anyone could download it from the website. Its contents have not been checked yet.
- `run.ts` is listed in the project's history but is missing from disk. It is a stray entry with no risk.

## 3. Saved list or live data?

- The GitHub side is read live from GitHub each time **Compare now** runs or auto-refresh fires.
- The project side is a saved list, captured when that copy of the app was built.
- A Project latest of `5b73b37` means the app on that screen was built when `5b73b37` was the newest change. That is most likely the live site or an older preview tab. A copy built at `5b73b37` would show "GitHub has changes the project does not have", not "Diverged". So the reported screen mixes builds, or the reading was of a different panel. Please send a screenshot that shows the page address and the **Project list saved** time.

## 4. Safe reconciliation, in order

1. **Confirm the link.** The owner opens Project settings → Git and screenshots the repository, branch, status message and last sync time.
2. **Check for Lovable's backup branch.** On GitHub, look for a `lovable-sync` or `lovable-sync-<time>` branch and screenshot the branch list.
3. **Remove the ZIP without rewriting history.** On GitHub, the owner deletes `winstone-pulse-crm-main (3).zip` from `main` with a normal commit. No force-push, rebase or history cleanup, because those break the Lovable sync.
4. **Let Lovable catch up.** That new commit on `main` triggers a pull. If the status still shows the two sides as split, merge the newest `lovable-sync*` branch into `main` on GitHub, keeping Lovable's version for every file.
5. **Remove the tracked retired key and public ZIP (needs build approval).** Untrack `android/winstone-release.jks`, and review `public/downloads/winstone-connect-android-studio.zip` and remove it if it is sensitive. Add both to the ignore list. The key's protection is that it is retired: only the new company certificate fingerprint is trusted.
6. **Verify.** Run **Compare now** on a freshly built preview. Expected: In sync, with GitHub latest equal to Project latest.
7. **Publish** only after step 6 passes, then confirm the live comparison shows the same result.

Steps 1 to 4 are owner actions on GitHub and in Project settings. Step 5 is the only code change, and it waits for your approval.

## Details needed from you

- Screenshot of Project settings → Git: repository, branch, status, last sync time.
- Screenshot of the GitHub branch list, to see any `lovable-sync*` branch.
- Screenshot of the comparison screen showing the page address and the "Project list saved" time.

---

# IT Console dashboard alerts: diagnosis only (no changes made)

Checked through the Google Sheets request log and read-only database queries. No settings, keys or data were touched.

## P1: Report sheet (রিপোর্ট শিট) 403 errors, confirmed and probably already resolved

Evidence from the sheet sync history (last 3 days):
- **Report sheet failures:** 132 failed writes on 1 Nov, 08:23 to 11:18 UTC.
  - First 8 (08:23 to 08:34): "Project is not authorized to use this credential". The Google Sheets connection was briefly unlinked from this project after the workspace move.
  - Next 124 (08:36 to 11:18): "LOVABLE_API_KEY not registered". The project's own service key was rejected, most likely an old copy still held after the move or after a key change.
- **Lead report sheet:** 19 succeeded, 0 failed. **Shift summary:** 45 succeeded, 0 failed. All three use the same Google connection. Only the report sheet (spreadsheet `1cS2…`) was affected, because it was the one syncing during that window.
- **Google request log:** every request to the report sheet since 11:23 UTC returned 200, the latest at 12:28 UTC. No failures after 11:18.
- Unconfirmed: the sync history has no report-sheet success after 10:50 UTC, even though the Google log shows successes after 11:23. So it is unclear whether the published site has picked up the current key.

Safe checks (read-only):
1. Open IT Console → Health → Sheet sync health and confirm no new 403s after 11:18 UTC.
2. Tap the report sheet's manual sync once on the live site and confirm a new success row. This writes report rows to the sheet, so it needs owner approval.
3. If 403s return on the live site only: the published site is still running with the old key. A fresh publish reloads it. Never rotate the key twice for the same error.

## P2: 29 versioned reports pending re-ingestion (2.21-test(32), 2.20-test(31)) — needs verification

- Not re-queried here. Both app versions are test builds, so these are most likely reports from test phones, not agent work lost.
- Safe check: on `/sync-failures` and the reports page, filter by app version and confirm the per-version counts, which agent each belongs to, and their submitted time.
- Re-ingesting writes production data, so it needs owner approval per batch. Never reassign leads to make reports fit; LeadHub stays the only assignment path.

## P2: 3 failed recording uploads and 10 calls with no audio — partly confirmed

- **Confirmed:** in the last 2 days there are 42 call rows whose recording is marked "not available" and whose upload is still pending. Those calls have no audio on the server.
- **Not confirmed:** the alert's exact "3 failed / 10 no audio" split, which depends on its own day window.
- Likely causes: recording permission or consent off on the phone, Android blocking call audio, or the phone being offline. None of these affect call reports or scoring; audio is optional.
- Safe next step: ask the affected agents to open the app and re-sync, then check `/sync-failures`. Do not mark any call connected without call-history proof.

## P2: 724 leads pending 48 hours — needs verification

- My count using the assumed column names returned 0. That most likely means those names are wrong, so the alert's own rule must be read before trusting either number.
- The alert's advice points to the retired Coordinator Deck. That wording is outdated; LeadHub Nexus is the only reassignment path.
- The neglect rule already recalls untouched leads on the 3rd business day.
- Safe next step: read the alert's rule and compare it with the lead neglect notices. Any reassignment or recall needs HQ/LeadHub action, not IT.

## P3: "No active bill/subscription"

- **Confirmed:** the only subscription row is marked "trialing", last updated 12 Sep 2026. The alert is reading that stored state.
- Project memory says the owner reports payment through 14 Nov 2026 and the fee is $35.29.
- Safe next step: verify the stored payment proof in Billing. Recording a payment or approval needs owner approval, and approval is not the same as payment.

## P1: GitHub sync — not verified, split apart

- See the audit above. The dashboard's green "Connected" line only means the page loaded; it is not the GitHub sync status.
- Only Project settings → Git can confirm the sync.

## Actions that need owner approval

- Any manual sheet sync on the live site, report re-ingestion, lead reassignment or recall.
- Recording a billing payment or approval.
- All GitHub steps in the audit, and any publish.
