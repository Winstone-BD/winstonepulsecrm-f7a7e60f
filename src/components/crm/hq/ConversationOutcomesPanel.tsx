import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Bi } from "@/components/crm/Bi";
import { Input } from "@/components/ui/input";
import { dhakaDateOf } from "@/lib/business-day";
import { conversationOutcomes } from "@/lib/conversation-outcomes.functions";
import type { OcCounts } from "@/lib/conversation-outcomes";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const daysAgo = (n: number) => dhakaDateOf(Date.now() - n * 86_400_000);

/** Which recorded conversations led to a next action, site visit or booking — counts only. */
export function ConversationOutcomesPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const run = useServerFn(conversationOutcomes);
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const q = useQuery({
    queryKey: ["conversation-outcomes", adminToken ? "pin" : "session", from, to],
    queryFn: () => run({ data: { adminToken, from, to } }),
    enabled: from <= to,
  });
  const d = q.data;
  const k = d?.totals;

  const cols: { label: string; get: (r: OcCounts) => string }[] = [
    { label: t({ bn: "কথোপকথন", en: "Conversations" }), get: (r) => String(r.conversations) },
    { label: t({ bn: "পরের পদক্ষেপ", en: "Next action" }), get: (r) => `${r.nextAction} · ${pct(r.nextAction, r.conversations)}` },
    { label: t({ bn: "সাইট ভিজিট", en: "Site visit" }), get: (r) => `${r.siteVisit} · ${pct(r.siteVisit, r.conversations)}` },
    { label: t({ bn: "বুকিং", en: "Booking" }), get: (r) => `${r.booking} · ${pct(r.booking, r.conversations)}` },
    { label: t({ bn: "কিছুই না", en: "No outcome" }), get: (r) => String(r.noOutcome) },
  ];

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold"><Bi en="Follow-up outcomes" bn="কথোপকথনের ফলাফল" /></h2>
          <p className="text-xs text-muted-foreground">
            {t({
              bn: `সংযুক্ত কলের রিপোর্ট থেকে কতগুলো পরের পদক্ষেপ, সাইট ভিজিট বা বুকিং-এ গেলো। ভিজিট/বুকিং ${d?.attributionDays ?? 30} দিনের মধ্যে, একই লিডের সর্বশেষ কথোপকথনে গণনা — শুধু সংখ্যা।`,
              en: `Of the connected-call reports in this period, how many led to a next action, a site visit or a booking. Visits and bookings count within ${d?.attributionDays ?? 30} days, credited once to the latest conversation on that lead — counts only.`,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="text-xs">{t({ bn: "থেকে", en: "From" })}
            <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="text-xs">{t({ bn: "পর্যন্ত", en: "To" })}
            <Input type="date" value={to} min={from} max={daysAgo(0)} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
      </header>

      {q.isPending && <p className="text-xs text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
      {q.isError && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}

      {k && d && (
        <>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={t({ bn: "সংযুক্ত কথোপকথন", en: "Connected conversations" })} value={k.conversations}
              note={t({ bn: `${k.verified}টি ফোন কল-লগে যাচাই`, en: `${k.verified} confirmed by phone call log` })} />
            <Tile label={t({ bn: "পরের পদক্ষেপ ঠিক হয়েছে", en: "Led to a next action" })} value={k.nextAction}
              note={pct(k.nextAction, k.conversations)} />
            <Tile label={t({ bn: "সাইট ভিজিট হয়েছে", en: "Led to a site visit" })} value={k.siteVisit}
              note={pct(k.siteVisit, k.conversations)} />
            <Tile label={t({ bn: "বুকিং হয়েছে", en: "Led to a booking" })} value={k.booking}
              note={t({ bn: `${pct(k.booking, k.conversations)} · ${k.bookingApproved}টি HQ অনুমোদিত`, en: `${pct(k.booking, k.conversations)} · ${k.bookingApproved} HQ-approved` })} />
          </ol>
          <p className="text-xs text-muted-foreground">
            {t({ bn: `${k.noOutcome}টি কথোপকথনের পর কোনো পরের পদক্ষেপ, ভিজিট বা বুকিং সংরক্ষিত হয়নি।`, en: `${k.noOutcome} conversations have no saved next action, visit or booking.` })}
          </p>

          {d.byAgent.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">{t({ bn: "এজেন্ট অনুযায়ী", en: "By agent" })}</h3>
              <ul className="space-y-2 md:hidden">
                {d.byAgent.map((r) => (
                  <li key={r.agentId} className="rounded-lg border p-2 text-xs">
                    <div className="font-medium">{r.name}</div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {cols.map((c) => <div key={c.label}><span className="text-muted-foreground">{c.label}</span> <span className="tabular">{c.get(r)}</span></div>)}
                    </div>
                  </li>
                ))}
              </ul>
              <table className="hidden w-full text-sm md:table">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">{t({ bn: "এজেন্ট", en: "Agent" })}</th>
                    {cols.map((c) => <th key={c.label} className="py-2 text-right">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.byAgent.map((r) => (
                    <tr key={r.agentId} className="border-t border-border/70">
                      <td className="py-2">{r.name}</td>
                      {cols.map((c) => <td key={c.label} className="tabular py-2 text-right">{c.get(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {k.conversations === 0 && <p className="text-xs text-muted-foreground">{t({ bn: "এই সময়ে কোনো সংযুক্ত কথোপকথন নেই।", en: "No connected conversations in this period." })}</p>}
        </>
      )}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string | undefined }) {
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-2xl font-semibold">{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </li>
  );
}
