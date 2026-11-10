import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { readSiteVisitAlerts } from "@/lib/site-visit-alerts.functions";
import { supabase } from "@/integrations/supabase/client";

export function SiteVisitAlerts() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(readSiteVisitAlerts);
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`management-visit-alerts-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["site-visit-alerts"], refetchType: document.visibilityState === "hidden" ? "none" : "active" });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
  const q = useQuery({ queryKey: ["site-visit-alerts", adminToken], queryFn: () => read({ data: { adminToken } }), retry: false });
  return <section aria-label={t({ bn: "সাইট ভিজিট সতর্কতা", en: "Site visit alerts" })} className="min-w-0 space-y-3 border-y border-border py-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-warning" aria-hidden />{t({ bn: "ভিজিট আগ্রহ আছে, নির্ধারিত ভিজিট নেই", en: "Visit interest without a scheduled visit" })}{q.data && <span className="text-muted-foreground">({q.data.alerts.length})</span>}</h2>
      <Button variant="ghost" size="icon" disabled={q.isFetching} onClick={() => void q.refetch()} aria-label={t({ bn: "ভিজিট সতর্কতা আবার দেখুন", en: "Refresh site visit alerts" })} title={t({ bn: "আবার দেখুন", en: "Refresh" })}><RefreshCw className="size-4" /></Button>
    </header>
    {q.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "ভিজিট সতর্কতা যাচাই করা যায়নি।", en: "Site visit alerts could not be verified." })}</p>
      : q.isPending ? <p className="text-sm text-muted-foreground">{t({ bn: "তথ্য আনা হচ্ছে…", en: "Loading…" })}</p>
      : !q.data?.alerts.length ? <p className="text-sm text-muted-foreground">{t({ bn: "নতুন খোলা ভিজিট সতর্কতা নেই।", en: "No new open site visit alerts." })}</p>
      : <ul className="max-h-80 space-y-3 overflow-y-auto">{q.data.alerts.map(a => <li key={a.id} role="alert" className="border-l-2 border-warning pl-3 text-sm">
        <p className="font-medium">{t({ bn: "সাইট ভিজিটের রিপোর্ট আছে — বুকিং যাচাই প্রয়োজন", en: "Site visit reported — booking review needed" })}</p>
        <p className="mt-1 break-words text-muted-foreground">{a.detail}</p>
        <time className="mt-1 block text-xs text-muted-foreground" dateTime={a.created_at}>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(a.created_at))} · {t({ bn: "ঢাকা", en: "Dhaka" })}</time>
      </li>)}</ul>}
    <Link to="/site-visits" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><CalendarCheck className="size-4" aria-hidden />{t({ bn: "সাইট ভিজিট তালিকা", en: "Site visit list" })}</Link>
  </section>;
}