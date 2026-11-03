import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const release = readFileSync(".github/workflows/android-release.yml", "utf8");
const tests = readFileSync(".github/workflows/android-tests.yml", "utf8");

describe("Android CI Gradle cache never holds signing material", () => {
  it("release workflow only reads the Gradle cache", () => {
    expect(release).toMatch(/gradle\/actions\/setup-gradle@v4[\s\S]*?cache-read-only: true/);
  });
  it("Gradle cache is set up before the company key is restored", () => {
    expect(release.indexOf("setup-gradle")).toBeLessThan(release.indexOf("Restore company key"));
  });
  it("no workflow caches keys, passwords, local.properties or release output", () => {
    for (const wf of [release, tests]) {
      expect(wf).not.toMatch(/actions\/cache@/);
      expect(wf).not.toMatch(/cache-encryption-key/);
      expect(wf).not.toMatch(/configuration-cache/i);
    }
  });
  it("the tests workflow, which has no secrets, never sees signing secrets", () => {
    expect(tests).not.toMatch(/\$\{\{\s*secrets\./);
  });
});

describe("Android test workflow diagnostics", () => {
  const uploads = [...tests.matchAll(/upload-artifact@v4[\s\S]*?retention-days: (\d+)/g)];
  it("uploads test reports on every run and the Gradle log on failure", () => {
    expect(tests).toMatch(/Upload test reports\s+if: always\(\)/);
    expect(tests).toMatch(/Upload failure log\s+if: failure\(\)/);
    expect(uploads.length).toBe(2);
  });
  it("artifacts are short-lived (7 days or less)", () => {
    for (const m of uploads) expect(Number(m[1])).toBeLessThanOrEqual(7);
  });
  it("uploads only test output and the log — never keys, settings or APKs", () => {
    const paths = [...tests.matchAll(/path: \|?\s*([\s\S]*?)\n\s+if-no-files-found/g)].map((m) => m[1]).join("\n");
    expect(paths).toMatch(/reports\/tests/);
    expect(paths).not.toMatch(/\.jks|\.keystore|\.p12|local\.properties|\.apk|release-out|RUNNER_TEMP/);
  });
});

describe("Android official release workflow", () => {
  it("is started only by hand and pins version 2.22 (33) by default", () => {
    expect(release).toMatch(/on:\s+workflow_dispatch:/);
    expect(release).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(release).toMatch(/default: "2\.22"/);
    expect(release).toMatch(/default: "33"/);
  });
  it("checks all four signing secrets before anything else runs", () => {
    const check = release.indexOf("Check required signing secrets");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(release.indexOf("actions/checkout@v4"));
    for (const name of ["ANDROID_KEYSTORE_BASE64", "WINSTONE_KEYSTORE_PASSWORD", "WINSTONE_KEY_ALIAS", "WINSTONE_KEY_PASSWORD"]) {
      expect(release).toContain(`missing+=("${name}")`);
    }
  });
  it("re-verifies checksum, package, version and signer, then uploads only the 3 release files plus SHA256SUMS and provenance for 7 days", () => {
    const verify = release.indexOf("Re-check the release files");
    const upload = release.indexOf("Upload only the verified release files");
    expect(release.indexOf("Write SHA256SUMS")).toBeGreaterThan(verify);
    expect(release.indexOf("Write SHA256SUMS")).toBeLessThan(upload);
    expect(verify).toBeGreaterThan(release.indexOf("Erase company key"));
    expect(upload).toBeGreaterThan(verify);
    expect(release).toMatch(/sha256sum -c/);
    const uploadBlock = release.slice(upload);
    expect(uploadBlock).toMatch(/retention-days: 7/);
    expect(uploadBlock.match(/release-out\//g)?.length).toBe(5);
    expect(uploadBlock).toContain("release-out/SHA256SUMS");
    expect(uploadBlock).toContain("release-out/build-provenance.json");
    expect(uploadBlock).not.toMatch(/\*|\.jks|local\.properties|RUNNER_TEMP/);
  });
});

describe("Android release shrinker rules", () => {
  it("keeps the Tink annotation rule so the minified release build can complete", () => {
    const rules = readFileSync("android/app/proguard-rules.pro", "utf8");
    expect(rules).toMatch(/^-dontwarn com\.google\.errorprone\.annotations\.\*\*$/m);
  });
});

describe("Android workflow hardening (2026-11-02)", () => {
  const release = readFileSync(".github/workflows/android-release.yml", "utf8");
  const tests = readFileSync(".github/workflows/android-tests.yml", "utf8");

  it("refuses an official build from any ref other than main, before the secrets check", () => {
    const guard = release.indexOf("Official builds run only from main");
    expect(guard).toBeGreaterThan(0);
    expect(release).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]; then');
    expect(guard).toBeLessThan(release.indexOf("Check required signing secrets"));
  });

  it("builds the unsigned release and sandbox apps on every Android change, without secrets", () => {
    expect(tests).toContain(":app:assembleRelease :app:assembleSandbox");
    expect(tests).not.toContain("${{ secrets.");
    // APKs are built only to prove the build works; no upload path lists an APK.
    expect(tests).not.toMatch(/^\s+android\/[^\n]*\.apk\s*$/m);
  });

  it("cancels superseded pull-request runs only", () => {
    expect(tests).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });
});

describe("Android signing preflight", () => {
  const release = readFileSync(".github/workflows/android-release.yml", "utf8");
  const start = release.indexOf("name: Preflight - validate signing secrets");
  const block = release.slice(start, release.indexOf("- name: Build, sign and verify"));

  it("runs after the key is restored and before the Gradle build", () => {
    expect(start).toBeGreaterThan(release.indexOf("Restore company key"));
    expect(start).toBeLessThan(release.indexOf("scripts/build-signed-apk.sh"));
  });
  it("passes passwords to keytool only via :env, never on the command line", () => {
    expect(block).toContain("-storepass:env PF_STORE_PASSWORD");
    expect(block).toContain("-keypass:env PF_KEY_PASSWORD");
    expect(block).not.toMatch(/-(storepass|keypass) "?\$/);
  });
  it("never echoes a secret variable or raw keytool output", () => {
    expect(block).not.toMatch(/echo[^\n]*\$\{?PF_/);
    expect(block).not.toMatch(/echo[^\n]*\$\{?out/);
    expect(block).not.toMatch(/set -x/);
  });
  it("checks key password and pinned signer fingerprint", () => {
    expect(block).toContain("keytool -certreq");
    expect(block).toContain('[ "$got" != "$want" ]');
  });
});
