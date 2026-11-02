import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Bi } from "@/components/crm/Bi";
import { Input } from "@/components/ui/input";
import { dhakaDateOf } from "@/lib/business-day";
import { leadImportFunnel } from "@/lib/import-funnel.functions";
import type { FunnelCounts, FunnelRow } from "@/lib/import-funnel";
import { useT } from "@/lib/i18n";
import { useDeckToken as useAdminToken } from "@/lib/local-session";

const SOURCE_LABEL: Record<string, string> = {
  "Winstone Company": "CSV import",
  head_database: "Head database",
  head_office: "Head office",
  public_directory: "Public directory",
  zhc_import: "ZHC import",
  csv: "CSV (old)",
  csv_import: "CSV import (old)",
  import: "File import",
};

function hours(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function daysAgo(n: number) {
  return dhakaDateOf(Date.now() - n * 86_400_000);
}

/** Import → cleanup → assignment completion for LeadHub; counts and delays only. */
export function ImportFunnelPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const run = useServerFn(leadImportFunnel);
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const q = useQuery({
    queryKey: ["import-funnel", adminToken ? "pin" : "none", from, to],
    queryFn: () => run({ data: { adminToken, from, to } }),
    enabled: from <= to,
  });
  const d = q.data;
  const k = d?.totals;

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            <Bi en="Import to assignment" bn="ইমপোর্ট থেকে এজেন্ট পর্যন্ত" />
          </h2>
          <p className="text-xs text-muted-foreground">
            {t({ bn: "এই সময়ে ইমপোর্ট হওয়া লিড কতগুলো পরিষ্কার হলো, পুলে পড়ে আছে, আর এজেন্টের কাছে গেলো — শুধু সংখ্যা।", en: "Leads imported in this period: how many were cleaned, are still in the pool, and reached an agent — counts only." })}
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
            <Stage label={t({ bn: "ইমপোর্ট হয়েছে", en: "Imported" })} value={k.imported}
              note={d.intake.batches ? t({ bn: `${d.intake.rowsTurnedAway} সারি ইমপোর্টের সময়ই বাদ`, en: `${d.intake.rowsTurnedAway} rows turned away at import` }) : undefined} />
            <Stage label={t({ bn: "পরিষ্কার", en: "Cleaned" })} value={k.clean}
              note={t({ bn: `${k.parked} ডুপ্লিকেট/ভুল হিসেবে আলাদা`, en: `${k.parked} parked as duplicate/invalid` })} />
            <Stage label={t({ bn: "পুলে পড়ে আছে", en: "Still unassigned" })} value={k.unassigned} tone="warn"
              note={t({ bn: `গড় অপেক্ষা ${hours(k.waiting.medianHours)} · সবচেয়ে পুরোনো ${hours(k.waiting.oldestHours)}`, en: `Median wait ${hours(k.waiting.medianHours)} · oldest ${hours(k.waiting.oldestHours)}` })} />
            <Stage label={t({ bn: "এজেন্টের কাছে গেছে", en: "Distributed" })} value={k.distributed} tone="good"
              note={k.completionPct == null ? undefined : t({ bn: `পরিষ্কার লিডের ${k.completionPct}%`, en: `${k.completionPct}% of cleaned leads` })} />
          </ol>

          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <Delay label={t({ bn: "ইমপোর্ট → পরিষ্কার", en: "Import → cleaned" })}
              value={t({ bn: "সময় সংরক্ষিত হয় না", en: "Time not recorded" })} />
            <Delay label={t({ bn: "ইমপোর্ট → প্রথম এজেন্ট (মাঝামাঝি / ৯০%)", en: "Import → first agent (median / 90%)" })}
              value={`${hours(k.toAssignment.medianHours)} / ${hours(k.toAssignment.p90Hours)}`}
              sub={t({ bn: `${k.toAssignment.measured} লিড মাপা গেছে${k.distributedUntimed ? ` · ${k.distributedUntimed}টির সময় নেই` : ""}`, en: `${k.toAssignment.measured} leads timed${k.distributedUntimed ? ` · ${k.distributedUntimed} without a time` : ""}` })} />
            <Delay label={t({ bn: "আবার পুলে ফিরেছে", en: "Returned to pool" })} value={String(k.returned)}
              sub={t({ bn: "আগে দেওয়া হয়েছিল, এখন অনির্ধারিত", en: "Given out before, unassigned now" })} />
          </div>

          <Breakdown title={t({ bn: "ইমপোর্টের দিন অনুযায়ী (ঢাকা)", en: "By import day (Dhaka)" })} rows={d.byDay} keyLabel={t({ bn: "দিন", en: "Day" })} />
          <Breakdown title={t({ bn: "উৎস অনুযায়ী", en: "By source" })} rows={d.bySource} keyLabel={t({ bn: "উৎস", en: "Source" })} format={(k) => SOURCE_LABEL[k] ?? k} />
          {k.imported === 0 && <p className="text-xs text-muted-foreground">{t({ bn: "এই সময়ে কোনো ইমপোর্ট নেই।", en: "No imports in this period." })}</p>}
        </>
      )}
    </section>
  );
}

function Stage({ label, value, note, tone }: { label: string; value: number; note?: string | undefined; tone?: "warn" | "good" }) {
  const color = tone === "warn" ? "text-warning" : tone === "good" ? "text-success" : "";
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`tabular text-2xl font-semibold ${color}`}>{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </li>
  );
}

function Delay({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="tabular text-base font-medium">{value}</div>
      {sub && <div className="text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Breakdown({ title, rows, keyLabel, format = (k) => k }: { title: string; rows: FunnelRow[]; keyLabel: string; format?: (k: string) => string }) {
  const t = useT();
  if (!rows.length) return null;
  const cols: { label: string; get: (r: FunnelCounts) => string }[] = [
    { label: t({ bn: "ইমপোর্ট", en: "Imported" }), get: (r) => String(r.imported) },
    { label: t({ bn: "আলাদা", en: "Parked" }), get: (r) => String(r.parked) },
    { label: t({ bn: "পুলে", en: "Unassigned" }), get: (r) => String(r.unassigned) },
    { label: t({ bn: "বিতরণ", en: "Distributed" }), get: (r) => String(r.distributed) },
    { label: "%", get: (r) => (r.completionPct == null ? "—" : `${r.completionPct}%`) },
    { label: t({ bn: "এজেন্ট পর্যন্ত সময়", en: "To agent (median)" }), get: (r) => hours(r.toAssignment.medianHours) },
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold">{title}</h3>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-lg border p-2 text-xs">
            <div className="font-medium">{format(r.key)}</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {cols.map((c) => <div key={c.label}><span className="text-muted-foreground">{c.label}</span> <span className="tabular">{c.get(r)}</span></div>)}
            </div>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm md:table">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2 text-left">{keyLabel}</th>
            {cols.map((c) => <th key={c.label} className="py-2 text-right">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/70">
              <td className="py-2">{format(r.key)}</td>
              {cols.map((c) => <td key={c.label} className="tabular py-2 text-right">{c.get(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
