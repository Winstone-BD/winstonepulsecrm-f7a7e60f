# Winstone Pulse Agent App — Internal Release Handover and Operational Sign-off

**Scope: internal company distribution only.** Winstone Pulse Android is a private internal tool for
Winstone's own agents. It is **not** published to Google Play or any public store, and no store listing,
store review or store signing service is required. The goal is an internally signed, installable APK that
uses the same production CRM backend, data and business rules as the web CRM.

**Internal operational sign-off: NOT READY** (status as of 2026-11-01, 15:51 Dhaka).
The three gates in section F are technical, internal checks — not app-store gates.
This document is the handover sequence. The release process does **not** use GitHub, CI or any cloud
build service (GitHub was removed 2026-11-01). Supporting detail stays in:
`docs/ANDROID_RELEASE_READINESS.md` (key backup/restore, ledger), `docs/ANDROID_DEVICE_ACCEPTANCE.md`
(device checklist), `docs/ANDROID_CRM_CONSISTENCY_AUDIT.md` (Android ↔ web CRM data/call-time audit),
`scripts/build-signed-apk.sh` / `.ps1` (the build gate) and `tests/build-signed-apk-script.test.ts` (guards its refusals).

| Fixed identity | Value |
|---|---|
| Source | the `android/` folder of this Lovable project (download the project code) |
| Release applicationId | `com.winstone.connect` (test build `com.winstone.connect.test` is never official) |
| Version | `versionName 2.21`, `versionCode 32` (`android/app/build.gradle.kts`) |
| Live CRM (same backend the APK uses) | https://crm.winstonebd.com |
| Distribution | internal only: IT Console private download (`android-apk` storage, PIN-gated 60-minute links) or direct copy to company phones |

Never put keystore files, passwords, alias values, secret values or `local.properties` in chat, logs,
screenshots, tickets or this project. Only the **public** certificate SHA-256 fingerprint may be written down.

---

## A. Company Signing Key Owner — prepare the trusted build computer

1. Use one trusted IT computer with Android Studio (provides JDK 17 + Android SDK, build-tools 35).
2. Restore the company keystore from its encrypted backup (readiness doc, section 3 "Restore") to a private
   folder **outside** the project, e.g. `C:\winstone-keys\` or `~/winstone-keys/`.
3. Never use `android/winstone-release.jks` (committed in project history; retired and untrusted by owner decision B, 2026-10-28)
   or any key that was ever committed, emailed or pasted in chat. The build script refuses if any `.jks/.keystore/.p12`
   file exists inside the project.
4. Lovable/AI agents and IT staff without key custody must not generate, rotate, choose or upload a key on the company's behalf.

Done when: the keystore exists only in the private folder and its encrypted backup.

## B. Company Signing Key Owner + IT Admin — approved certificate fingerprint

1. Key owner reads the fingerprint from the restored key:
   `keytool -list -v -keystore <keystore> -alias <alias>` → copy the `SHA256:` line only.
2. IT Admin independently confirms it against a second trusted record (the fingerprint recorded at key creation in the
   readiness doc section 3 table, or the signer of the last officially distributed APK via `apksigner verify --print-certs`).
   If the two disagree or no trusted record exists → **STOP**; do not pick one.
3. Write the same public fingerprint into the readiness doc section 3 "Canonical fingerprint" row.

Done when: two people confirmed the value from independent trusted evidence.

## C. IT Admin — get the latest source

1. Download this Lovable project's code (latest version) to the trusted computer; use its `android/` folder.
2. Confirm `android/app/build.gradle.kts` shows the expected `versionCode`/`versionName`. For a new release,
   both must be higher than the version currently on agent phones (ask Lovable to bump them first).

## D. Key owner — build and verify the official signed APK

Start only when A, B and C are Done.

1. Copy `android/local.properties.example` to `android/local.properties` and fill in `sdk.dir`,
   `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD` and the approved
   `RELEASE_CERT_SHA256` from B. Type the values yourself; never paste them anywhere else.
2. Run from the project folder: `bash scripts/build-signed-apk.sh` (macOS/Linux) or
   `powershell -ExecutionPolicy Bypass -File scripts\build-signed-apk.ps1` (Windows).
3. The script fails closed (`OFFICIAL RELEASE BLOCKED: …`, names only, never values) when any signing input is
   missing, the fingerprint is malformed, the keystore is inside the project, a stray keystore exists, or the SDK is missing.
   Then it runs the unit tests, builds the release, and verifies:
   - APK Signature Scheme v2, exactly one signer, signer SHA-256 equals `RELEASE_CERT_SHA256` (else "signer fingerprint mismatch" → STOP);
   - `aapt2` package `com.winstone.connect`, version equal to `build.gradle.kts`, not debuggable.
4. Output in `android/release-out/`: `winstone-connect-<version>-<code>-release.apk`, its `.sha256`, and a
   `.release-record.txt` (public facts only). Check with `sha256sum -c <apk>.sha256` → `OK`.
5. Delete `android/local.properties` from the computer afterwards if it is shared; keep the keystore only in its private folder.
6. Send the APK, `.sha256` and release record to the Lovable project owner, who asks Lovable to store it privately
   in the IT Console download card. Lovable re-checks the SHA-256, package and version before replacing the test build.
7. A file named `*-debug*`, `*-test*`, `*-unsigned*` or package `com.winstone.connect.test` is **never** the official APK.

## E. Agent Tester — real Android phone test

Use `docs/ANDROID_DEVICE_ACCEPTANCE.md` (24 rows). Record for the run: phone model, Android version, test time (Dhaka),
staff test account (no password), APK SHA-256, and evidence links. Use test leads and a second phone you control;
no real customer data without written authorization.

Must cover: install and update-in-place, incoming call, outgoing call, missed/unanswered call (never "connected", FAKE LEAD blocked),
recording consent/permission/availability and phone-recorder pickup, call-log evidence vs CRM rows,
CRM sync including offline + reboot, report submission, duplicate prevention (each call/report once),
and diagnostics (Desk sync status, failed/retry states, IT load diagnostics if errors appear).

## F. Internal operational sign-off (not a Play Store gate)

The sign-off stays **NOT READY** until all three rows below are **Pass** with evidence. Any Fail → do not hand the APK
to agents. Passing means only: IT may install the APK on company agent phones (internal company distribution only).

| # | Gate | Owner | Evidence required | Status | Date (Dhaka) |
|---|---|---|---|---|---|
| 1 | Approved company signing certificate (A + B) | Company Signing Key Owner + IT Admin | keystore restored outside the project; fingerprint confirmed from two trusted records | NOT READY — no trusted fingerprint recorded (checked 2026-11-01) | |
| 2 | Signed APK from the latest Lovable project code (C + D) | Key Owner + IT Admin | script output "Official release APK verified"; release record (signer/package/version/APK SHA-256); `sha256sum -c` OK | NOT READY — no official build yet | |
| 3 | Real-device end-to-end acceptance test (E) | Agent Tester + IT Admin | completed `docs/ANDROID_DEVICE_ACCEPTANCE.md` with screenshots/recordings | NOT DONE | |

Internal approval to install on agent phones: ________ (IT Admin)  ________ (Executive HQ)  Date: ________
