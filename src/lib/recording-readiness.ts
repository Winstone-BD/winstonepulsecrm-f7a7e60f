/**
 * Per-phone recording readiness (pure, unit-tested).
 *
 * Built only from what the phone itself reported. Anything not reported stays
 * "not reported" — never assumed ready. A web-only agent (no Android app
 * registered) can never record calls, because a browser cannot capture call
 * audio.
 */

export type ReadinessStatus =
  | "ready"
  | "consent_missing"
  | "consent_declined"
  | "mic_denied"
  | "recorder_blocked"
  | "not_reported"
  | "offline"
  | "web_only";

export interface ReadinessDevice {
  recording_consent: string | null;
  mic_permission: string | null;
  recording_mode: string | null;
  readiness_reported_at: string | null;
  last_seen_at: string | null;
}

/** A phone that has not checked in for this long is treated as offline. */
export const OFFLINE_AFTER_MS = 24 * 60 * 60 * 1000;

export function deviceReadiness(d: ReadinessDevice, nowMs: number): ReadinessStatus {
  const seen = d.last_seen_at ? Date.parse(d.last_seen_at) : NaN;
  if (!Number.isFinite(seen) || nowMs - seen > OFFLINE_AFTER_MS) return "offline";
  if (!d.readiness_reported_at || d.recording_consent === null || d.mic_permission === null) {
    return "not_reported";
  }
  if (d.recording_consent === "declined") return "consent_declined";
  if (d.recording_consent !== "granted") return "consent_missing";
  if (d.mic_permission !== "granted") return "mic_denied";
  if (d.recording_mode === "unavailable") return "recorder_blocked";
  if (d.recording_mode !== "two_sided" && d.recording_mode !== "mic_only") return "not_reported";
  return "ready";
}

/** Best status across an agent's phones; no phone at all = web only. */
export function agentReadiness(devices: ReadinessDevice[], nowMs: number): ReadinessStatus {
  if (!devices.length) return "web_only";
  const order: ReadinessStatus[] = [
    "ready", "mic_denied", "consent_missing", "consent_declined",
    "recorder_blocked", "not_reported", "offline",
  ];
  const statuses = devices.map((d) => deviceReadiness(d, nowMs));
  return order.find((s) => statuses.includes(s)) ?? "not_reported";
}

export const READINESS_LABEL: Record<ReadinessStatus, { en: string; bn: string; next: { en: string; bn: string } }> = {
  ready: {
    en: "Ready to record", bn: "রেকর্ডের জন্য প্রস্তুত",
    next: { en: "Make one short test call to confirm audio reaches the CRM.", bn: "অডিও CRM-এ পৌঁছায় কিনা দেখতে একটি ছোট টেস্ট কল করুন।" },
  },
  consent_missing: {
    en: "Consent not given", bn: "সম্মতি দেওয়া হয়নি",
    next: { en: "Open the app and accept the recording consent.", bn: "অ্যাপ খুলে রেকর্ডিং সম্মতি দিন।" },
  },
  consent_declined: {
    en: "Consent declined", bn: "সম্মতি প্রত্যাখ্যাত",
    next: { en: "Agent chose no recording; ask them to review it in the app if policy requires.", bn: "এজেন্ট রেকর্ডিং বন্ধ রেখেছেন; প্রয়োজনে অ্যাপে আবার দেখতে বলুন।" },
  },
  mic_denied: {
    en: "Microphone blocked", bn: "মাইক্রোফোন বন্ধ",
    next: { en: "Phone Settings → Apps → Winstone Connect → Permissions → Microphone → Allow.", bn: "ফোন Settings → Apps → Winstone Connect → Permissions → Microphone → Allow।" },
  },
  recorder_blocked: {
    en: "Phone blocks recording", bn: "ফোন রেকর্ড করতে দেয় না",
    next: { en: "Turn on the phone's own call recorder so the app can pick up its file.", bn: "ফোনের নিজস্ব কল রেকর্ডার চালু করুন, যাতে অ্যাপ ফাইলটি নিতে পারে।" },
  },
  not_reported: {
    en: "Not reported", bn: "রিপোর্ট আসেনি",
    next: { en: "Install the newest app version; older versions do not send this status.", bn: "অ্যাপের নতুন সংস্করণ দিন; পুরনো সংস্করণ এই তথ্য পাঠায় না।" },
  },
  offline: {
    en: "Phone offline (24h+)", bn: "ফোন অফলাইন (২৪ ঘণ্টা+)",
    next: { en: "Open the app while signed in and connected to the internet.", bn: "ইন্টারনেট চালু রেখে সাইন ইন করে অ্যাপ খুলুন।" },
  },
  web_only: {
    en: "Web only — cannot record", bn: "শুধু ওয়েব — রেকর্ড সম্ভব নয়",
    next: { en: "A browser cannot record calls. Install the Android app on this agent's phone.", bn: "ব্রাউজার কল রেকর্ড করতে পারে না। এজেন্টের ফোনে অ্যান্ড্রয়েড অ্যাপ দিন।" },
  },
};
