import { describe, expect, it } from "vitest";
import { agentReadiness, deviceReadiness, type ReadinessDevice } from "@/lib/recording-readiness";

const now = Date.parse("2026-11-01T16:00:00Z");
const base: ReadinessDevice = {
  recording_consent: "granted",
  mic_permission: "granted",
  recording_mode: "two_sided",
  readiness_reported_at: "2026-11-01T15:59:00Z",
  last_seen_at: "2026-11-01T15:59:00Z",
};

describe("recording readiness", () => {
  it("is ready only with consent, microphone and a working recorder", () => {
    expect(deviceReadiness(base, now)).toBe("ready");
  });
  it("blocks when microphone permission is denied", () => {
    expect(deviceReadiness({ ...base, mic_permission: "denied" }, now)).toBe("mic_denied");
  });
  it("blocks when consent was not given or declined", () => {
    expect(deviceReadiness({ ...base, recording_consent: "not_asked" }, now)).toBe("consent_missing");
    expect(deviceReadiness({ ...base, recording_consent: "declined" }, now)).toBe("consent_declined");
  });
  it("never assumes ready when an older app did not report", () => {
    expect(deviceReadiness({ ...base, recording_consent: null, mic_permission: null, readiness_reported_at: null }, now)).toBe("not_reported");
  });
  it("treats a phone unseen for more than 24 hours as offline", () => {
    expect(deviceReadiness({ ...base, last_seen_at: "2026-10-31T15:00:00Z" }, now)).toBe("offline");
  });
  it("marks the phone blocked when the recorder is unavailable", () => {
    expect(deviceReadiness({ ...base, recording_mode: "unavailable" }, now)).toBe("recorder_blocked");
  });
  it("an agent with no phone app is web only", () => {
    expect(agentReadiness([], now)).toBe("web_only");
  });
  it("an agent is ready when any of their phones is ready", () => {
    expect(agentReadiness([{ ...base, mic_permission: "denied" }, base], now)).toBe("ready");
  });
});
