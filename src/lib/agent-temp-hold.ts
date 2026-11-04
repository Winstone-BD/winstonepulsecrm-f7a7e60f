/**
 * One-day management hold (owner request, 2026-11-04). Listed agents cannot
 * use the CRM until Executive HQ approves today's accountability review
 * (existing HQ PIN path) or 11:15 Dhaka passes. Pure rule, shared by server + tests.
 */
export const TEMP_HOLD_DATE = "2026-11-04";
/** 11:15 Dhaka (UTC+6) = 05:15 UTC. */
export const TEMP_HOLD_UNTIL_ISO = "2026-11-04T05:15:00.000Z";

export type TempHoldEntry = { name: string; reasonBn: string; reasonEn: string };

export const TEMP_HOLDS: Record<string, TempHoldEntry> = {
  "ec5c2a7f-23f7-4c48-bf9f-fd5961a3f9c2": {
    name: "Sabbir Ahmmed",
    reasonBn:
      "৩ নভেম্বর ১৫০টি লিড দেওয়া হলেও ০টি লিডে কাজ হয়েছে (১০০% পেন্ডিং)। ১ নভেম্বরের একমাত্র কাজটিও করা হয়নি।",
    reasonEn: "On 3 Nov, 0 of 150 assigned leads were worked (100% pending). The single 1 Nov task was also not done.",
  },
  "240dd5e2-a436-449e-8231-2bb5ea18e5d7": {
    name: "Mst. Soniya Yeasmin",
    reasonBn:
      "নতুন লিডে কল হয়েছে (১ নভেম্বর ১৩টি, ৩ নভেম্বর ১৭টি), কিন্তু নির্ধারিত ফলো-আপ (যথাক্রমে ২৫টি ও ১৬টি) করা হয়নি।",
    reasonEn: "New leads were called (13 on 1 Nov, 17 on 3 Nov) but scheduled follow-ups (25 and 16) were skipped.",
  },
  "7f4631f0-348b-4c11-a447-10b5ff4e866f": {
    name: "Monisha Biswas",
    reasonBn:
      "১ নভেম্বর ৮টি কাজের মধ্যে ৭টি ফলো-আপ করা হয়নি; ৩ নভেম্বর ৫টি ফলো-আপ ওভারডিউ এবং ১০৪টি নতুন লিড স্পর্শ করা হয়নি।",
    reasonEn: "On 1 Nov, 7 of 8 follow-ups were missed; on 3 Nov, 5 follow-ups went overdue and 104 new leads were untouched.",
  },
};

export type TempHoldStatus = { active: boolean; until: string; reasonBn?: string; reasonEn?: string };

export function tempHoldFor(agentId: string, hqApproved: boolean, now: Date | number = Date.now()): TempHoldStatus {
  const entry = TEMP_HOLDS[agentId];
  const until = TEMP_HOLD_UNTIL_ISO;
  if (!entry || hqApproved || new Date(now).getTime() >= Date.parse(until)) return { active: false, until };
  return { active: true, until, reasonBn: entry.reasonBn, reasonEn: entry.reasonEn };
}
