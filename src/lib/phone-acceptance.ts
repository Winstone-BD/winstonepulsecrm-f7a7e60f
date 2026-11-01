/**
 * Real-phone acceptance checklist for IT: app installed, agent signed in, test
 * call reached the CRM with phone-proven talk time. Built only from what the
 * phone and CRM actually hold — a missing fact is "waiting", never a pass.
 */
import { hasProvenTalkTime } from "@/lib/lead-verification";
import { OFFLINE_AFTER_MS } from "@/lib/recording-readiness";

export type StepStatus = "pass" | "warn" | "waiting";
export type StepKey = "install" | "signin" | "call";

export type AcceptanceDevice = {
  id: string;
  app_version: string | null;
  last_seen_at: string | null;
  created_at: string;
  revoked_at?: string | null;
};

export type AcceptanceCall = {
  device_id: string | null;
  agent_id: string | null;
  created_at: string;
  call_status: string | null;
  duration_seconds: number | null;
  call_source: string | null;
  talk_time_source: string | null;
};

export type StepReason =
  | "app_reported" | "current_test_build" | "test_build" | "other_version" | "no_version"
  | "active" | "stale" | "revoked"
  | "verified" | "not_completed" | "no_talk_time" | "not_verified" | "no_call";

export type AcceptanceStep = { key: StepKey; status: StepStatus; reason: StepReason };

export type AcceptanceResult = {
  steps: AcceptanceStep[];
  ready: boolean;
  lastCallAt: string | null;
};

export function isTestBuild(version: string | null | undefined): boolean {
  return /(^|[-_.])(test|debug|sandbox)\b/i.test(String(version ?? ""));
}

export function evaluatePhoneAcceptance(input: {
  device: AcceptanceDevice;
  agentId: string;
  calls: AcceptanceCall[];
  expectedVersion: string;
  now: number;
}): AcceptanceResult {
  const { device, agentId, expectedVersion, now } = input;

  const v = device.app_version?.trim() || null;
  // The version IT currently hands out passes (noted when it is a test build);
  // any other test build or older/newer version needs attention.
  const install: AcceptanceStep = !v
    ? { key: "install", status: "waiting", reason: "no_version" }
    : v === expectedVersion
      ? { key: "install", status: "pass", reason: isTestBuild(v) ? "current_test_build" : "app_reported" }
      : isTestBuild(v)
        ? { key: "install", status: "warn", reason: "test_build" }
        : { key: "install", status: "warn", reason: "other_version" };

  const seen = device.last_seen_at ? Date.parse(device.last_seen_at) : NaN;
  const signin: AcceptanceStep = device.revoked_at
    ? { key: "signin", status: "warn", reason: "revoked" }
    : Number.isFinite(seen) && now - seen <= OFFLINE_AFTER_MS
      ? { key: "signin", status: "pass", reason: "active" }
      : { key: "signin", status: "waiting", reason: "stale" };

  // Only calls made from THIS phone by THIS agent after the phone was registered.
  const since = Date.parse(device.created_at);
  const mine = input.calls
    .filter((c) => c.device_id === device.id && c.agent_id === agentId && Date.parse(c.created_at) >= since)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  const proven = (c: AcceptanceCall) =>
    c.call_status === "completed" &&
    typeof c.duration_seconds === "number" && Number.isFinite(c.duration_seconds) && c.duration_seconds > 0 &&
    hasProvenTalkTime(c);

  let call: AcceptanceStep;
  const best = mine.find(proven);
  if (best) call = { key: "call", status: "pass", reason: "verified" };
  else if (!mine.length) call = { key: "call", status: "waiting", reason: "no_call" };
  else {
    const c = mine[0];
    const reason: StepReason =
      c.call_status !== "completed" ? "not_completed"
        : !(typeof c.duration_seconds === "number" && c.duration_seconds > 0) ? "no_talk_time"
          : "not_verified";
    call = { key: "call", status: "warn", reason };
  }

  const steps = [install, signin, call];
  return {
    steps,
    ready: steps.every((s) => s.status === "pass"),
    lastCallAt: (best ?? mine[0])?.created_at ?? null,
  };
}

type L = { en: string; bn: string };
export const STEP_TITLE: Record<StepKey, L> = {
  install: { en: "1. App installed", bn: "১. অ্যাপ ইনস্টল" },
  signin: { en: "2. Agent signed in on the phone", bn: "২. ফোনে এজেন্ট সাইন-ইন" },
  call: { en: "3. Test call reached the CRM", bn: "৩. টেস্ট কল CRM-এ এসেছে" },
};

export const REASON_LABEL: Record<StepReason, L> = {
  app_reported: { en: "Phone reports the current app version", bn: "ফোন বর্তমান অ্যাপ ভার্সন জানাচ্ছে" },
  current_test_build: { en: "Current IT Console test build installed (not the official signed app)", bn: "বর্তমান IT Console টেস্ট বিল্ড ইনস্টল (অফিসিয়াল সাইন করা অ্যাপ নয়)" },
  test_build: { en: "Test build installed — not the official app", bn: "টেস্ট বিল্ড ইনস্টল — অফিসিয়াল অ্যাপ নয়" },
  other_version: { en: "Different app version than the current release", bn: "বর্তমান রিলিজের চেয়ে ভিন্ন ভার্সন" },
  no_version: { en: "Phone has not reported an app version yet", bn: "ফোন এখনো অ্যাপ ভার্সন জানায়নি" },
  active: { en: "Signed in and seen in the last 24 hours", bn: "সাইন-ইন, গত ২৪ ঘণ্টায় সক্রিয়" },
  stale: { en: "Not seen in 24 hours — open the app and sign in", bn: "২৪ ঘণ্টায় দেখা যায়নি — অ্যাপ খুলে সাইন-ইন করুন" },
  revoked: { en: "Phone access was revoked by IT", bn: "IT ফোনের অ্যাক্সেস বাতিল করেছে" },
  verified: { en: "Answered call with phone-proven talk time", bn: "রিসিভ হওয়া কল, ফোনের কল-লগে প্রমাণিত কথার সময়" },
  not_completed: { en: "Call reached the CRM but was not answered/completed", bn: "কল CRM-এ এসেছে কিন্তু রিসিভ/সম্পন্ন হয়নি" },
  no_talk_time: { en: "Call reached the CRM with no talk time", bn: "কল CRM-এ এসেছে, কথার সময় নেই" },
  not_verified: { en: "Talk time not proven by the phone's call history", bn: "কথার সময় ফোনের কল-লগে প্রমাণিত নয়" },
  no_call: { en: "No call from this phone yet — make an answered test call", bn: "এই ফোন থেকে এখনো কোনো কল নেই — একটি রিসিভ হওয়া টেস্ট কল করুন" },
};
