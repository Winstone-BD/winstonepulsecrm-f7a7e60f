import { describe, expect, it } from "vitest";
import { APK_LINK_MINUTES, APK_RELEASE } from "@/lib/apk-release";

describe("agent APK handed out by IT", () => {
  it("is the 2.21-test build that talks to the live CRM", () => {
    expect(APK_RELEASE.version).toBe("2.21-test");
    expect(APK_RELEASE.versionCode).toBe(32);
    expect(APK_RELEASE.server).toBe("https://crm.winstonebd.com");
  });
  it("is never labelled as the official company-signed app", () => {
    expect(APK_RELEASE.official).toBe(false);
  });
  it("is stored privately with a real sha256 and short-lived links", () => {
    expect(APK_RELEASE.bucket).toBe("android-apk");
    expect(APK_RELEASE.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(APK_LINK_MINUTES).toBeLessThanOrEqual(60);
  });
});
