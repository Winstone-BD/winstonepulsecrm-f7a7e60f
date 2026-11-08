import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/admin-gate.server", () => ({ requireAdminToken: (token: string | null) => {
  if (token !== "full-it-test-fixture") throw new Error("Admin PIN required");
} }));
import { finosSecurityStatus } from "@/lib/finos-security.server";

describe("FinOS presence-only key status", () => {
  it("returns only configured and switch booleans", () => {
    expect(finosSecurityStatus("full-it-test-fixture", { secret: "non-secret-test-fixture", enabled: false })).toEqual({ keyConfigured: true, enabled: false });
  });
  it("reports absent configuration without fabricated readiness", () => {
    expect(finosSecurityStatus("full-it-test-fixture", { secret: undefined, enabled: false })).toEqual({ keyConfigured: false, enabled: false });
  });
  it.each([null, "hq-test-fixture", "leadhub-test-fixture"])("denies non-full IT status access %s", (token) => {
    expect(() => finosSecurityStatus(token, { secret: "non-secret-test-fixture", enabled: true })).toThrow("Admin PIN required");
  });
});