import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  APPWRITE_DEFAULT_ENDPOINT,
  APPWRITE_DEFAULT_PROJECT_ID,
  resolveAppwriteConfig,
} from "@/lib/appwrite-config";
import { classifyAppwriteError, isPongResponse } from "@/lib/appwrite-ping";

describe("Appwrite connectivity config", () => {
  it("defaults to the winstonebd Singapore project", () => {
    expect(resolveAppwriteConfig({})).toEqual({
      endpoint: "https://sgp.cloud.appwrite.io/v1",
      projectId: "6ae900580021177f0b22",
      projectName: "winstonebd",
    });
  });

  it("ignores non-https or malformed overrides", () => {
    const c = resolveAppwriteConfig({ VITE_APPWRITE_ENDPOINT: "http://evil.example/v1", VITE_APPWRITE_PROJECT_ID: "bad id!" });
    expect(c.endpoint).toBe(APPWRITE_DEFAULT_ENDPOINT);
    expect(c.projectId).toBe(APPWRITE_DEFAULT_PROJECT_ID);
  });

  it("client code never carries an Appwrite API key", () => {
    for (const f of ["src/lib/appwrite-config.ts", "src/lib/appwrite-ping.ts", "src/components/crm/AppwriteConnectionTest.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/setKey\(|X-Appwrite-Key|standard_[a-f0-9]{20,}/i);
    }
  });
});

describe("Appwrite ping result", () => {
  it("only Appwrite's actual pong counts as success", () => {
    expect(isPongResponse("Pong!")).toBe(true);
    expect(isPongResponse({ message: "Pong!" })).toBe(true);
    expect(isPongResponse("")).toBe(false);
    expect(isPongResponse(undefined)).toBe(false);
    expect(isPongResponse({ ok: true })).toBe(false);
  });

  it("an unregistered web address is reported as unknown_origin", () => {
    const r = classifyAppwriteError({ name: "AppwriteException", message: "Invalid Origin.", code: 403, type: "general_unknown_origin" });
    expect(r.kind).toBe("unknown_origin");
    expect(r.code).toBe(403);
  });

  it("a browser fetch failure is a network failure", () => {
    expect(classifyAppwriteError(new TypeError("Failed to fetch")).kind).toBe("network");
  });

  it("other HTTP errors keep their status", () => {
    const r = classifyAppwriteError({ message: "Server Error", code: 500, type: "general_server_error" });
    expect(r).toMatchObject({ kind: "http", code: 500 });
  });

  it("timeouts are reported as timeouts", () => {
    const e = new Error("No answer");
    e.name = "AppwritePingTimeout";
    expect(classifyAppwriteError(e).kind).toBe("timeout");
  });
});
