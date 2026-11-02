import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Bi } from "@/components/crm/Bi";
import { AGE_BUCKETS, type AgeBucket, type BookingStage } from "@/lib/booking-pipeline";
import { bookingPipeline } from "@/lib/bookings.functions";
import { useT } from "@/lib/i18n";
import { getAdminToken } from "@/lib/local-session";

const STAGE: Record<BookingStage, { bn: string; en: string; tone?: "warn" | "bad" | "good" }> = {
  pending: { bn: "HQ রিভিউর অপেক্ষায়", en: "Waiting for HQ review", tone: "warn" },
  awaiting_os: { bn: "অনুমোদিত · OS-এ যাচ্ছে", en: "Approved · going to Winstone OS", tone: "warn" },
  os_failed: { bn: "OS-এ পাঠানো ব্যর্থ", en: "Winstone OS send failed", tone: "bad" },
  confirmed: { bn: "নিশ্চিত (OS গ্রহণ করেছে)", en: "Confirmed (OS accepted)", tone: "good" },
  completed: { bn: "সম্পন্ন", en: "Completed", tone: "good" },
  rejected: { bn: "HQ বাতিল করেছে", en: "Rejected by HQ" },
  cancelled: { bn: "ক্যানসেল", en: "Cancelled" },
};
const BUCKET: Record<AgeBucket, { bn: string; en: string }> = {
  under_1d: { bn: "১ দিনের কম", en: "< 1 day" },
  "1_3d": { bn: "১–৩ দিন", en: "1–3 days" },
  "3_7d": { bn: "৩–৭ দিন", en: "3–7 days" },
  over_7d: { bn: "৭ দিনের বেশি", en: "7+ days" },
};
const TONE = { warn: "text-warning", bad: "text-destructive", good: "text-success" } as const;

function age(h: number | null) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

/** Status and aging of booking requests from review to Winstone OS confirmation. */
export function BookingPipelinePanel() {
  const t = useT();
  const run = useServerFn(bookingPipeline);
  const q = useQuery({
    queryKey: ["booking-pipeline"],
    queryFn: () => run({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 60_000,
  });
  const p = q.data;
  const aged = p?.stages.filter((s) => s.stage === "pending" || s.stage === "awaiting_os" || s.stage === "os_failed") ?? [];

  return (
    <section className="card-elevated space-y-4 p-4">
      <header>
        <h2 className="text-sm font-semibold"><Bi en="Booking pipeline" bn="বুকিং পাইপলাইন" /></h2>
        <p className="text-xs text-muted-foreground">
          {t({ bn: "প্রতিটি বুকিং অনুরোধ এখন কোন ধাপে আছে আর সেখানে কতদিন অপেক্ষা করছে — শুধু সংখ্যা।", en: "Where every booking request is now and how long it has waited there — counts only." })}
        </p>
      </header>

      {q.isPending && <p className="text-xs text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
      {q.isError && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}

      {p && (
        <>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {p.stages.map((s) => {
              const meta = STAGE[s.stage];
              return (
                <li key={s.stage} className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">{t(meta)}</div>
                  <div className={`tabular text-2xl font-semibold ${s.count && meta.tone ? TONE[meta.tone] : ""}`}>{s.count}</div>
                  {s.oldestAgeHours != null && (
                    <div className="text-xs text-muted-foreground">
                      {t({ bn: `মাঝামাঝি ${age(s.medianAgeHours)} · সবচেয়ে পুরোনো ${age(s.oldestAgeHours)}`, en: `Median ${age(s.medianAgeHours)} · oldest ${age(s.oldestAgeHours)}` })}
                    </div>
                  )}
                </li>
              );
            })}
            <li className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">{t({ bn: "রিভিউ করতে সময় (মাঝামাঝি / ৯০%)", en: "Time to HQ decision (median / 90%)" })}</div>
              <div className="tabular text-base font-medium">{age(p.reviewHours.medianHours)} / {age(p.reviewHours.p90Hours)}</div>
              <div className="text-xs text-muted-foreground">{t({ bn: `${p.reviewHours.measured}টি সিদ্ধান্ত`, en: `${p.reviewHours.measured} decisions` })}</div>
            </li>
          </ol>

          {aged.some((s) => s.count > 0) && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">{t({ bn: "কতদিন ধরে অপেক্ষা", en: "How long they've been waiting" })}</h3>
              <ul className="space-y-2 md:hidden">
                {aged.filter((s) => s.count).map((s) => (
                  <li key={s.stage} className="rounded-lg border p-2 text-xs">
                    <div className="font-medium">{t(STAGE[s.stage])}</div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {AGE_BUCKETS.map((k) => <div key={k}><span className="text-muted-foreground">{t(BUCKET[k])}</span> <span className="tabular">{s.buckets[k]}</span></div>)}
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-sm md:table">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">{t({ bn: "ধাপ", en: "Stage" })}</th>
                    {AGE_BUCKETS.map((k) => <th key={k} className="py-2 text-right">{t(BUCKET[k])}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {aged.filter((s) => s.count).map((s) => (
                    <tr key={s.stage} className="border-t border-border/70">
                      <td className="py-2">{t(STAGE[s.stage])}</td>
                      {AGE_BUCKETS.map((k) => <td key={k} className={`tabular py-2 text-right ${k === "over_7d" && s.buckets[k] ? "text-destructive" : ""}`}>{s.buckets[k]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.pendingByAgent.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">{t({ bn: "রিভিউর অপেক্ষায় — এজেন্ট অনুযায়ী", en: "Waiting for review — by agent" })}</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {p.pendingByAgent.map((a) => (
                  <li key={a.agentId} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span className="font-medium">{a.name}</span>
                    <span className="tabular text-muted-foreground">{a.pending} · {t({ bn: "সবচেয়ে পুরোনো", en: "oldest" })} {age(a.oldestAgeHours)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.total === 0 && <p className="text-xs text-muted-foreground">{t({ bn: "এখনো কোনো বুকিং নেই।", en: "No bookings yet." })}</p>}
        </>
      )}
    </section>
  );
}
