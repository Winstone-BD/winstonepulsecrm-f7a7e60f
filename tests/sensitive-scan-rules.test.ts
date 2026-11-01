import { describe, expect, it } from "vitest";
import { checkContent, checkName } from "../scripts/sensitive-scan-rules";

describe("sensitive file scan rules", () => {
  it("flags keystores, including inside a ZIP path", () => {
    expect(checkName("android/winstone-release.jks")[0]?.severity).toBe("high");
    expect(checkName("public/downloads/app.zip!android/release.keystore")).toHaveLength(1);
  });
  it("ignores example files that only describe where secrets go", () => {
    expect(checkName("android/local.properties.example")).toEqual([]);
    expect(checkContent("x.example", "storePassword=realvalue123")).toEqual([]);
  });
  it("flags a private key block and a hardcoded signing password", () => {
    expect(checkContent("a.txt", "-----BEGIN PRIVATE KEY-----\nabc")).toHaveLength(1);
    expect(checkContent("build.gradle", 'storePassword = "hunter2secret"')).toHaveLength(1);
  });
  it("does not flag passwords read from the environment", () => {
    expect(checkContent("build.gradle", 'storePassword = System.getenv("X")')).toEqual([]);
    expect(checkContent("ci.yml", "KEY_PASSWORD: ${{ secrets.WINSTONE_KEY_PASSWORD }}")).toEqual([]);
  });
});
