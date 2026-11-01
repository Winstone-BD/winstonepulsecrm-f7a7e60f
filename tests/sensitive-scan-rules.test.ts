import { describe, expect, it } from "vitest";
import { checkContent, checkEnv, checkName } from "../scripts/sensitive-scan-rules";

describe("sensitive file scan rules", () => {
  it("flags keystores, including inside a ZIP path", () => {
    expect(checkName("android/winstone-release.jks")[0]?.severity).toBe("high");
    expect(checkName("public/downloads/app.zip!android/release.keystore")).toHaveLength(1);
  });
  it("ignores example files that only describe where secrets go", () => {
    expect(checkName("android/local.properties.example")).toEqual([]);
    expect(checkContent("x.example", 'storePassword = "realvalue123"')).toEqual([]);
  });
  it("flags a real private key block and a quoted signing password", () => {
    expect(checkContent("a.txt", `-----BEGIN PRIVATE KEY-----\n${"A".repeat(64)}`)).toHaveLength(1);
    expect(checkContent("build.gradle", 'storePassword = "hunter2secret"')).toHaveLength(1);
  });
  it("does not flag key-parsing code or passwords read from variables", () => {
    expect(checkContent("auth.ts", 'pem.replace(/-----BEGIN PRIVATE KEY-----|\\s/g, "")')).toEqual([]);
    expect(checkContent("b.kts", "storePassword = storePass")).toEqual([]);
    expect(checkContent("ci.yml", "KEY_PASSWORD: ${{ secrets.WINSTONE_KEY_PASSWORD }}")).toEqual([]);
  });
  it("allows only browser-safe names in .env files", () => {
    expect(checkEnv(".env", "VITE_SUPABASE_URL=x\nSUPABASE_PUBLISHABLE_KEY=y")).toEqual([]);
    expect(checkEnv(".env", "SUPABASE_SERVICE_ROLE_KEY=z")).toHaveLength(1);
  });
});
