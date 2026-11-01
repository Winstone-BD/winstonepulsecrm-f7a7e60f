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
