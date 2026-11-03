// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppwritePingResult } from "@/lib/appwrite-ping";
import {
  __resetAppwriteStartupForTests,
  appwriteStartupRequestCount,
  getAppwriteStartupState,
  runAppwriteStartupPing,
} from "@/lib/appwrite-startup";

const config = { endpoint: "https://sgp.cloud.appwrite.io/v1", projectId: "6ae998b2002b6305289c", projectName: "winstonebd" };
const ok: AppwritePingResult = { ok: true, latencyMs: 5, response: "Pong!", checkedAt: "2026-11-03T00:00:00Z", config };

describe("Appwrite startup ping", () => {
  beforeEach(() => __resetAppwriteStartupForTests());

  it("sends exactly one ping no matter how many times startup code runs", async () => {
    const ping = vi.fn(async () => ok);
    const calls = [runAppwriteStartupPing(ping), runAppwriteStartupPing(ping), runAppwriteStartupPing(ping)];
    await Promise.all(calls);
    await runAppwriteStartupPing(ping);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(appwriteStartupRequestCount()).toBe(1);
    expect(getAppwriteStartupState()).toEqual({ status: "done", result: ok });
  });

  it("a thrown error never rejects startup", async () => {
    const ping = vi.fn(async () => {
      throw new Error("chunk failed");
    });
    await expect(runAppwriteStartupPing(ping)).resolves.toBeNull();
    await runAppwriteStartupPing(ping);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("a failed ping is kept as the reported result", async () => {
    const failed: AppwritePingResult = { ok: false, latencyMs: 9, kind: "unknown_origin", code: 403, type: "general_unknown_origin", message: "Invalid Origin", checkedAt: "x", config };
    await runAppwriteStartupPing(async () => failed);
    expect(getAppwriteStartupState()).toEqual({ status: "done", result: failed });
  });
});
