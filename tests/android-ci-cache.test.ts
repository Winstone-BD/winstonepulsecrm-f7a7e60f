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
    expect(tests).not.toMatch(/secrets\./);
  });
});
