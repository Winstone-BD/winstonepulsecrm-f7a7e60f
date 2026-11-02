import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCallLogMatchSummary } from "@/lib/call-log-match-summary.functions";
import { getAiCallLogInsights } from "@/lib/ai-features.functions";
import { NEXT_STEP, type SyncErrorKind } from "@/lib/android-sync-failures";
import { dhakaDateOf } from "@/lib/business-day";
import { useAdminToken } from "@/lib/local-session";
import { useLang, useT } from "@/lib/i18n";

type Counts = {
  matched: number; noAnswer: number; notMatched: number; noPhoneLog: number;
  verifiedLeads: number; failureTotal: number; failures: Partial<Record<SyncErrorKind, number>>;
};

function failureText(f: Counts["failures"]) {
  const parts = Object.entries(f).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([k, n]) => `${NEXT_STEP[k as SyncErrorKind]?.label ?? k}: ${n}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function CallLogMatchSummaryPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(getCallLogMatchSummary);
  const [day, setDay] = useState(() => dhakaDateOf());
  const q = useQuery({
    queryKey: ["call-log-match-summary", day, adminToken ? "pin" : "session"],
    queryFn: () => read({ data: { adminToken, day } }),
    retry: false,
    refetchInterval: 120_000,
  });
  const team = q.data?.team;
  const stats: Array<{ label: { en: string; bn: string }; value: number | undefined }> = [
    { label: { en: "Leads reached (call-log proven)", bn: "যাচাই হওয়া কথা হয়েছে এমন লিড" }, value: team?.verifiedLeads },
    { label: { en: "Matched · talked", bn: "মিলেছে · কথা হয়েছে" }, value: team?.matched },
    { label: { en: "Matched · no talk", bn: "মিলেছে · কথা হয়নি" }, value: team?.noAnswer },
    { label: { en: "Not matched yet", bn: "এখনো মেলেনি" }, value: team?.notMatched },
    { label: { en: "No phone log (web)", bn: "ফোন লগ নেই (ওয়েব)" }, value: team?.noPhoneLog },
    { label: { en: "Phone send failures", bn: "ফোন থেকে পাঠাতে ব্যর্থ" }, value: team?.failureTotal },
  ];
  const lang = useLang();
  const explainFn = useServerFn(getAiCallLogInsights);
  const explain = useMutation({ mutationFn: () => explainFn({ data: { adminToken, day, lang } }) });
  const agents = (q.data?.agents ?? []).filter((a) => a.matched + a.noAnswer + a.notMatched + a.noPhoneLog + a.failureTotal > 0);

  return (
    <section className="space-y-4 border-b border-border pb-6" aria-label="Daily call-log match summary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{t({ en: "Daily call-log match summary", bn: "দৈনিক কল-লগ মিলের সারাংশ" })}</h2>
        <div className="flex items-center gap-2">
          <Input type="date" value={day} max={dhakaDateOf()} onChange={(e) => e.target.value && setDay(e.target.value)}
            className="w-40" aria-label={t({ en: "Dhaka day", bn: "ঢাকার দিন" })} />
          <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
            <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />{t({ en: "Refresh", bn: "আবার দেখুন" })}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t({
          en: "Read-only counts from saved calls and phone send failures for the chosen Dhaka day. No phone numbers, notes or call content. Same match rules as the phone app's call list.",
          bn: "বেছে নেওয়া ঢাকার দিনের সেভ হওয়া কল ও ফোনের পাঠানো-ব্যর্থতা থেকে শুধু সংখ্যা। কোনো ফোন নম্বর, নোট বা কলের কথা নেই। ফোন অ্যাপের কল তালিকার একই মিলের নিয়ম।",
        })}
      </p>
      {q.isLoading && <p role="status">{t({ en: "Loading…", bn: "তথ্য আসছে…" })}</p>}
      {q.isError && <p role="alert" className="text-destructive">{q.error.message}</p>}
      {team && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label.en} className="rounded-lg border border-border bg-card p-3">
                <div className="text-2xl font-semibold tabular-nums">{s.value ?? 0}</div>
                <div className="text-xs text-muted-foreground">{t(s.label)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <Button size="sm" variant="outline" disabled={explain.isPending} onClick={() => explain.mutate()}>
              {explain.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {t({ en: "Explain with Winstone AI", bn: "Winstone AI দিয়ে ব্যাখ্যা" })}
            </Button>
            {explain.isError && <p role="alert" className="text-sm text-destructive">{explain.error.message}</p>}
            {explain.data && (
              <div className="space-y-1 text-sm">
                <p>{explain.data.summary}</p>
                {explain.data.actions.length > 0 && (
                  <ul className="list-disc pl-5 text-muted-foreground">{explain.data.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                )}
                <p className="text-xs text-muted-foreground">{t({ en: "Built from the counts above only. Suggestion — nothing is changed.", bn: "শুধু উপরের সংখ্যা থেকে তৈরি। পরামর্শ মাত্র — কিছু বদলানো হয় না।" })}</p>
              </div>
            )}
          </div>
          {team.failureTotal > 0 && (
            <p className="text-sm"><span className="font-medium">{t({ en: "Failure reasons", bn: "ব্যর্থতার কারণ" })}:</span> {failureText(team.failures)}</p>
          )}
          {!agents.length ? (
            <p className="text-muted-foreground">{t({ en: "No calls saved for this day yet.", bn: "এই দিনে এখনো কোনো কল সেভ হয়নি।" })}</p>
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {agents.map((a) => (
                  <li key={a.agentId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">{a.agentName}</div>
                    <div className="mt-1 text-muted-foreground">
                      {t({ en: "Leads", bn: "লিড" })} {a.verifiedLeads} · {t({ en: "Talked", bn: "কথা" })} {a.matched} · {t({ en: "No talk", bn: "কথা হয়নি" })} {a.noAnswer} · {t({ en: "Not matched", bn: "মেলেনি" })} {a.notMatched} · {t({ en: "Web", bn: "ওয়েব" })} {a.noPhoneLog}
                    </div>
                    {a.failureTotal > 0 && <div className="mt-1 text-destructive">{failureText(a.failures)}</div>}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 font-medium">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t({ en: "Leads reached", bn: "যাচাই লিড" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t({ en: "Talked", bn: "কথা হয়েছে" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t({ en: "No talk", bn: "কথা হয়নি" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t({ en: "Not matched", bn: "মেলেনি" })}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t({ en: "Web only", bn: "ওয়েব" })}</th>
                      <th className="py-2 font-medium">{t({ en: "Send failures", bn: "পাঠাতে ব্যর্থ" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.agentId} className="border-t border-border">
                        <td className="py-2 pr-3">{a.agentName}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">{a.verifiedLeads}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.matched}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.noAnswer}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.notMatched}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{a.noPhoneLog}</td>
                        <td className="py-2 text-xs">{a.failureTotal ? `${a.failureTotal} — ${failureText(a.failures)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
