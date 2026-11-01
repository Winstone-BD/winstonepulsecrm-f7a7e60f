import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listRecordingReadiness } from "@/lib/recording-readiness.functions";
import { READINESS_LABEL, type ReadinessStatus } from "@/lib/recording-readiness";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const dhaka = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const t = useT();
  const variant = status === "ready" ? "default" : status === "web_only" || status === "not_reported" || status === "offline" ? "secondary" : "destructive";
  return <Badge variant={variant}>{t(READINESS_LABEL[status])}</Badge>;
}

export function RecordingReadinessPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(listRecordingReadiness);
  const q = useQuery({
    queryKey: ["recording-readiness", adminToken ? "pin" : "session"],
    queryFn: () => read({ data: { adminToken } }),
    retry: false,
    refetchInterval: 60_000,
  });
  const rows = q.data?.rows ?? [];
  const ready = rows.filter((r) => r.status === "ready").length;
  const webOnly = rows.filter((r) => r.status === "web_only").length;
  const yesNo = (v: string | null, yes: string) =>
    v === null ? t({ en: "Not reported", bn: "রিপোর্ট আসেনি" }) : v === yes ? t({ en: "Yes", bn: "হ্যাঁ" }) : v === "declined" ? t({ en: "Declined", bn: "প্রত্যাখ্যাত" }) : t({ en: "No", bn: "না" });

  return (
    <section className="space-y-4 border-b border-border pb-6" aria-label="Recording readiness per phone">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t({ en: "Recording readiness per phone", bn: "ফোন অনুযায়ী রেকর্ডিং প্রস্তুতি" })}</h2>
        <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />{t({ en: "Refresh", bn: "আবার দেখুন" })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t({
          en: "Read-only. Shows only what each agent's Android app reported: recording consent, microphone permission and recorder support. Web-only agents cannot record — a browser has no access to call audio. Recordings do not affect scores.",
          bn: "শুধু দেখার জন্য। প্রতিটি এজেন্টের অ্যান্ড্রয়েড অ্যাপ যা জানিয়েছে শুধু তা-ই: রেকর্ডিং সম্মতি, মাইক্রোফোন অনুমতি ও রেকর্ডার সমর্থন। শুধু ওয়েব ব্যবহারকারী এজেন্টের কল রেকর্ড হয় না — ব্রাউজার কলের অডিও পায় না। রেকর্ডিং স্কোরে গণ্য হয় না।",
        })}
      </p>
      {q.isLoading && <p role="status">{t({ en: "Loading…", bn: "তথ্য আসছে…" })}</p>}
      {q.isError && <p role="alert" className="text-destructive">{q.error.message}</p>}
      {q.data && (
        <p className="text-sm" role="status">
          {t({ en: `${ready} of ${rows.length} agents ready · ${webOnly} web only`, bn: `${rows.length} জনের মধ্যে ${ready} জন প্রস্তুত · ${webOnly} জন শুধু ওয়েব` })}
          <span className="text-muted-foreground"> · {t({ en: "Checked", bn: "দেখা হয়েছে" })} {dhaka(q.data.checkedAt)} {t({ en: "Dhaka", bn: "ঢাকা" })}</span>
        </p>
      )}
      {q.data && !rows.length && <p className="text-muted-foreground">{t({ en: "No active sales agents.", bn: "কোনো সক্রিয় সেলস এজেন্ট নেই।" })}</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.agentId} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.agentName}</p>
              <StatusBadge status={r.status} />
            </div>
            {r.phones.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t(READINESS_LABEL.web_only.next)}</p>}
            {r.phones.length > 0 && (
              <ul className="mt-2 space-y-2">
                {r.phones.map((p) => (
                  <li key={p.id} className="rounded border border-border/60 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>{p.label} · {t({ en: "App", bn: "অ্যাপ" })} {p.appVersion ?? "—"} · Android {p.androidVersion ?? "—"}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
                      <div><dt className="inline text-muted-foreground">{t({ en: "Consent", bn: "সম্মতি" })}: </dt><dd className="inline">{yesNo(p.consent, "granted")}</dd></div>
                      <div><dt className="inline text-muted-foreground">{t({ en: "Microphone", bn: "মাইক্রোফোন" })}: </dt><dd className="inline">{yesNo(p.mic, "granted")}</dd></div>
                      <div><dt className="inline text-muted-foreground">{t({ en: "Recorder", bn: "রেকর্ডার" })}: </dt><dd className="inline">{p.recorder ?? "—"}</dd></div>
                    </dl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t({ en: "Last seen", bn: "শেষ দেখা" })} {dhaka(p.lastSeenAt)} · {t({ en: "Status reported", bn: "স্ট্যাটাস এসেছে" })} {dhaka(p.reportedAt)} {t({ en: "Dhaka", bn: "ঢাকা" })}
                    </p>
                    {p.status !== "ready" && <p className="mt-1 text-xs">{t(READINESS_LABEL[p.status].next)}</p>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
