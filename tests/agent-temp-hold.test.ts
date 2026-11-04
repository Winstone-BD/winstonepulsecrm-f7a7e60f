import { describe, expect, it } from "vitest";
import { tempHoldFor } from "@/lib/agent-temp-hold";

const SABBIR = "ec5c2a7f-23f7-4c48-bf9f-fd5961a3f9c2";

describe("one-day management hold", () => {
  it("holds a listed agent before 11:15 Dhaka", () => {
    expect(tempHoldFor(SABBIR, false, Date.parse("2026-11-04T05:14:00Z")).active).toBe(true);
  });
  it("unlocks at 11:15 Dhaka", () => {
    expect(tempHoldFor(SABBIR, false, Date.parse("2026-11-04T05:15:00Z")).active).toBe(false);
  });
  it("unlocks early when HQ approves", () => {
    expect(tempHoldFor(SABBIR, true, Date.parse("2026-11-04T04:00:00Z")).active).toBe(false);
  });
  it("never holds unlisted agents", () => {
    expect(tempHoldFor("00000000-0000-0000-0000-000000000000", false, Date.parse("2026-11-04T04:00:00Z")).active).toBe(false);
  });
});
