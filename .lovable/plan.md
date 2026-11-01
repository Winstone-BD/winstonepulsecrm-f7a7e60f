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
