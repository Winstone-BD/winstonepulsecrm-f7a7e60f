# Winstone Connect - Signed APK Rollout Checklist

Internal company distribution only (never Play Store or public links). Use after the signed build
prints "Official release APK verified" (docs/ANDROID_OFFICIAL_RELEASE_HANDOVER.md, sections D-F).

## Never share (any step, any channel)

- The `.jks` / `.keystore` / `.p12` file, its passwords, the key alias, or `android/local.properties`.
- Screenshots of `local.properties`, Android Studio signing dialogs or PowerShell windows that show them.
- Safe to share: the APK file, its `.sha256`, the `.release-record.txt`, the PUBLIC certificate
  fingerprint `2E:61:50:...:7E:6D`, and "OFFICIAL RELEASE BLOCKED: <reason>" lines (they print names only).

If a secret is ever pasted in chat, email or a ticket: stop the rollout, tell the key owner, treat the key as exposed.

## 1. Release hand-off (Key owner -> Project owner)

| # | Check | Done |
|---|---|---|
| 1.1 | `android\release-out\` has `winstone-connect-<ver>-<code>-release.apk`, `.sha256`, `.release-record.txt` | [ ] |
| 1.2 | Release record shows package `com.winstone.connect`, version 2.22 (code 33), signer = approved fingerprint | [ ] |
| 1.3 | `Get-FileHash <apk> -Algorithm SHA256` equals the value in `.sha256` | [ ] |
| 1.4 | Only these three files are sent (no keystore, no local.properties) | [ ] |
| 1.5 | Project owner asks Lovable to store the APK in IT Console -> phone app download card; Lovable re-checks SHA-256, package and version | [ ] |

## 2. Pilot (one controlled phone, then one agent)

| # | Check | Done |
|---|---|---|
| 2.1 | Real-device acceptance (docs/ANDROID_DEVICE_ACCEPTANCE.md) passed on the test phone with test leads only | [ ] |
| 2.2 | IT Console -> Phone acceptance checklist filled in for that phone | [ ] |
| 2.3 | One pilot agent installs from the IT Console private link (60-minute, PIN-gated) - never forwarded files | [ ] |
| 2.4 | Pilot agent: sign in, 9:05 briefing accepted, permissions granted, one controlled call + report synced | [ ] |
| 2.5 | Pilot runs one full working day with no new entry on `/sync-failures` for that phone | [ ] |
| 2.6 | IT Admin and Executive HQ sign the go-ahead (handover section F) | [ ] |

Any Fail -> stop, do not widen the rollout, report as in section 5.

## 3. Wider rollout (per agent)

IT opens a fresh private link per agent (links expire; do not post them in groups).

| Agent | Phone model / Android | Installed version shown in app | Signed in | Briefing ok | Test call synced | Report synced | Date (Dhaka) | IT initials |
|---|---|---|---|---|---|---|---|---|
| | | 2.22 (33) | [ ] | [ ] | [ ] | [ ] | | |
| | | 2.22 (33) | [ ] | [ ] | [ ] | [ ] | | |
| | | 2.22 (33) | [ ] | [ ] | [ ] | [ ] | | |
| | | 2.22 (33) | [ ] | [ ] | [ ] | [ ] | | |
| | | 2.22 (33) | [ ] | [ ] | [ ] | [ ] | | |

Rules: no rollout on Friday (holiday); install before the agent's first call of the day, not mid-shift;
an "update" that asks to uninstall first means a different signer - stop and report (data on the phone would be lost).

## 4. Confirming installations (no credentials needed)

- On the phone: Settings -> Apps -> Winstone Connect -> version must read 2.22 (not `-test`, not `-sandbox`).
- In the CRM: IT Console -> Calls / phone status shows the agent's phone version and last sync time.
- The agent's test call appears once in the CRM with the correct status; a cancelled/unanswered call is never "connected".

## 5. Reporting failures (safe format)

Send to IT (chat or ticket) using only this template:

```
Agent (staff name):
Phone model / Android version:
App version shown:            (e.g. 2.22 (33))
Step that failed:             (install / sign-in / briefing / call / report / sync / recording)
Exact message on screen:      (copy text; screenshot only if it shows no passwords)
Time (Dhaka):
Online or offline at the time:
Phone restarted since?:       yes / no
```

Do NOT include: customer names or phone numbers, call audio, keystore files, passwords, PINs,
`local.properties`, or one-time links.

IT then checks `/sync-failures` (technical fields only) and the IT Console phone status before replying.
Signing/build problems go to the key owner as the single "OFFICIAL RELEASE BLOCKED: ..." line only.

## 6. Roll back / pause

- Pause: stop issuing new links; agents already installed keep working (web CRM stays available).
- Never ask agents to uninstall to "fix" a problem - unsent reports would be lost. Ask IT first.
- A replacement build must have a higher version code and the same approved signer.
