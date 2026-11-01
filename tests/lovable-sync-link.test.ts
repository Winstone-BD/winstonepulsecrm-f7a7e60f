import { describe, expect, it } from "vitest";
import { LOVABLE_SYNC_LINK, syncLinkMismatch } from "@/lib/github-access";

describe("Lovable sync link record", () => {
  it("records the repository and branch confirmed in Project settings", () => {
    expect(LOVABLE_SYNC_LINK.repository).toBe("Winstone-Properties-Ltd/winstonepulsecrm");
    expect(LOVABLE_SYNC_LINK.branch).toBe("main");
  });
  it("flags a comparison against a different repository", () => {
    expect(syncLinkMismatch("trendfluxos-dev/winstonepulsecrm")).toBe(true);
    expect(syncLinkMismatch("winstone-properties-ltd/WinstonePulseCRM")).toBe(false);
  });
});
