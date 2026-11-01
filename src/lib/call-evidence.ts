/**
 * Call evidence — how sure we are that a reported call really connected.
 *
 * Pure display helper over submitted call_reports. It never changes scoring:
 * `connection_verified` (set by the server only from the phone's own call log)
 * stays the one ranking signal. This module only explains each report to
 * agents and HQ in plain words and spots disagreements between the agent's
 * answer and the phone's call log.
 */
import { CONNECTED_SECONDS } from "@/lib/kpi-contract";

export type EvidenceReport = {
  connected?: boolean | null;
  connection_verified?: boolean | null;
  duration_source?: string | null;
  duration_seconds?: number | null;
  channel?: string | null;
};

export type EvidenceKind =
  /** Phone call log shows talk time and the agent said connected. */
  | "phone_verified"
  /** Agent said connected; the time came from the web timer or was typed — no phone proof. */
  | "reported_only"
  /** Agent said connected but the phone call log shows no talk time. */
  | "phone_no_talk"
  /** Phone call log shows real talk time but the agent said not received. */
  | "phone_talk_unreported"
  /** Nobody picked up (agent's answer, phone agrees or has no record). */
  | "not_connected";

const secs = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function callEvidence(r: EvidenceReport): EvidenceKind {
  if (r.connection_verified === true) return "phone_verified";
  const fromPhone = r.duration_source === "phone_sync";
  if (r.connected === true) return fromPhone && secs(r.duration_seconds) === 0 ? "phone_no_talk" : "reported_only";
  if (fromPhone && secs(r.duration_seconds) > CONNECTED_SECONDS) return "phone_talk_unreported";
  return "not_connected";
}

export const isMismatch = (k: EvidenceKind) => k === "phone_no_talk" || k === "phone_talk_unreported";

export const EVIDENCE_LABEL: Record<EvidenceKind, { bn: string; en: string }> = {
  phone_verified: { bn: "কথা হয়েছে · ফোনে প্রমাণিত", en: "Connected · phone-verified" },
  reported_only: { bn: "কথা হয়েছে · শুধু এজেন্টের কথায়", en: "Connected · agent-reported only" },
  phone_no_talk: { bn: "মেলেনি · ফোনে কথার সময় নেই", en: "Mismatch · phone shows no talk time" },
  phone_talk_unreported: { bn: "মেলেনি · ফোনে কথা হয়েছে দেখায়", en: "Mismatch · phone shows a real talk" },
  not_connected: { bn: "কথা হয়নি", en: "Not connected" },
};

/** Badge variant names from the shared Badge component. */
export const EVIDENCE_TONE: Record<EvidenceKind, "default" | "secondary" | "destructive" | "outline"> = {
  phone_verified: "default",
  reported_only: "outline",
  phone_no_talk: "destructive",
  phone_talk_unreported: "destructive",
  not_connected: "secondary",
};

export type EvidenceSummary = {
  reports: number;
  phoneVerified: number;
  reportedOnly: number;
  notConnected: number;
  mismatch: number;
  /** Reports whose call time came from the phone's own call log. */
  phoneLogged: number;
  /** Talk seconds proven by the phone's call log. */
  verifiedTalkSeconds: number;
};

export function summarizeEvidence(rows: EvidenceReport[]): EvidenceSummary {
  const s: EvidenceSummary = { reports: 0, phoneVerified: 0, reportedOnly: 0, notConnected: 0, mismatch: 0, phoneLogged: 0, verifiedTalkSeconds: 0 };
  for (const r of rows) {
    s.reports += 1;
    if (r.duration_source === "phone_sync") s.phoneLogged += 1;
    const k = callEvidence(r);
    if (k === "phone_verified") { s.phoneVerified += 1; s.verifiedTalkSeconds += secs(r.duration_seconds); }
    else if (k === "reported_only") s.reportedOnly += 1;
    else if (k === "not_connected") s.notConnected += 1;
    else s.mismatch += 1;
  }
  return s;
}

/** True when calls were reported but none of their times came from a phone call log. */
export const phoneLogMissing = (s: EvidenceSummary) => s.reports > 0 && s.phoneLogged === 0;

const DHAKA_CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" });

export function talkLabel(seconds: number | null | undefined): string {
  const n = Math.round(secs(seconds));
  const m = Math.floor(n / 60);
  return m ? `${m}m ${n % 60}s` : `${n}s`;
}

/** "4:12 PM – 4:15 PM · 3m 12s" in Dhaka time; start is derived from end − duration when missing. */
export function callTimeLabel(input: { call_started_at?: string | null; call_ended_at?: string | null; duration_seconds?: number | null }): string | null {
  const end = input.call_ended_at ? Date.parse(input.call_ended_at) : NaN;
  if (!Number.isFinite(end)) return null;
  const startParsed = input.call_started_at ? Date.parse(input.call_started_at) : NaN;
  const start = Number.isFinite(startParsed) ? startParsed : end - secs(input.duration_seconds) * 1000;
  const a = DHAKA_CLOCK.format(start);
  const b = DHAKA_CLOCK.format(end);
  return `${a === b ? a : `${a} – ${b}`} · ${talkLabel(input.duration_seconds)}`;
}

/**
 * Phone call-log match for one synced call row (call_recordings), shown on the
 * Android app's call list. Display only — scoring keeps its own rules. A row
 * matches only when hasProvenTalkTime says the phone's own call history
 * proved it; ringing time alone never counts as a match with talk.
 */
export type CallLogMatch =
  /** Phone call history proves this call and its talk time. */
  | "log_talk"
  /** Phone call history has the call, but nobody talked (no answer / busy / 0s). */
  | "log_no_answer"
  /** App/phone call, but the phone's call history has not confirmed it (yet). */
  | "not_matched"
  /** Web/other call — there is no phone call history to compare. */
  | "no_phone_log";

export type CallLogRow = {
  call_source?: string | null;
  call_status?: string | null;
  duration_seconds?: number | null;
  talk_time_source?: string | null;
  external_call_id?: string | null;
  call_log_id?: string | number | null;
};

const PHONE_SOURCES = new Set(["android_sim", "android_dialer", "android_incoming", "phone_recorder"]);

export function callLogMatch(row: CallLogRow, proven: (r: CallLogRow) => boolean): CallLogMatch {
  const source = String(row.call_source ?? "");
  if (!PHONE_SOURCES.has(source)) return "no_phone_log";
  const fromLog =
    row.talk_time_source === "call_log" ||
    String(row.external_call_id ?? "").startsWith("log-") ||
    (row.call_log_id !== null && row.call_log_id !== undefined && String(row.call_log_id) !== "");
  const talked = row.call_status === "completed" && secs(row.duration_seconds) > 0;
  if (talked && proven(row)) return "log_talk";
  if (fromLog && !talked) return "log_no_answer";
  return "not_matched";
}

export const CALL_LOG_MATCH_LABEL: Record<CallLogMatch, { bn: string; en: string }> = {
  log_talk: { bn: "ফোন লগের সঙ্গে মিলেছে · কথা হয়েছে", en: "Matched phone log · talked" },
  log_no_answer: { bn: "ফোন লগের সঙ্গে মিলেছে · কথা হয়নি", en: "Matched phone log · no talk" },
  not_matched: { bn: "ফোন লগের সঙ্গে মেলেনি", en: "Not matched to phone log" },
  no_phone_log: { bn: "ফোন লগ নেই · এজেন্টের দেওয়া তথ্য", en: "No phone log · agent-reported" },
};
