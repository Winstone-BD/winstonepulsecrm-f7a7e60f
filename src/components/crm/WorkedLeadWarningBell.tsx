import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";
import { useT, useLang } from "@/lib/i18n";
import { getWorkedLeadWarnings } from "@/lib/worked-lead-inactivity.functions";

export function WorkedLeadWarningBell() {
  const adminToken = useAdminToken();
  const { account, scope } = useMyAccount();
  const load = useServerFn(getWorkedLeadWarnings);
  const t = useT();
  const lang = useLang();
  const identity = `${adminToken ?? "session"}:${scope}:${account?.profile?.id ?? ""}`;
  const query = useQuery({
    queryKey: ["worked-lead-warnings", identity], queryFn: () => load({ data: { adminToken } }),
    enabled: scope === "agent" || scope === "authority", staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000, refetchIntervalInBackground: false, retry: false,
  });
  const seen = useRef({ identity, ids: new Set<string>() });
  useEffect(() => {
    if (seen.current.identity !== identity) seen.current = { identity, ids: new Set() };
    if (!query.data) return;
    const fresh = query.data.alerts.filter(a => !seen.current.ids.has(a.id));
    for (const a of query.data.alerts) seen.current.ids.add(a.id);
    if (fresh.length) toast.warning(t({ bn: `${fresh.length}টি পেন্ডিং লিডে ৭ কার্যদিবস নতুন কাজ নেই`, en: `${fresh.length} pending leads inactive for 7 business days` }), { duration: 8000 });
  }, [query.data, identity, lang]);
  const alerts = query.data?.alerts ?? [];
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="icon" className="relative size-8 shrink-0" aria-label={t({ bn: "পেন্ডিং লিড সতর্কবার্তা", en: "Pending lead warnings" })} title={t({ bn: "পেন্ডিং লিড সতর্কবার্তা", en: "Pending lead warnings" })}>
        <AlertTriangle className="size-4" />
        {(alerts.length > 0 || query.isError) && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">{query.isError ? "!" : alerts.length}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[min(92vw,28rem)] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{t({ bn: "৭ কার্যদিবস নতুন কাজ নেই", en: "No new work for 7 business days" })}</h3>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" disabled={query.isFetching} onClick={() => void query.refetch()} aria-label={t({ bn: "আবার যাচাই", en: "Refresh warnings" })}><RefreshCw className="size-3.5" /></Button>
      </div>
      {query.isPending ? <p className="text-sm text-muted-foreground">{t({ bn: "যাচাই হচ্ছে…", en: "Checking…" })}</p> : query.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "সতর্কবার্তা যাচাই করা যায়নি।", en: "Warnings could not be checked." })}</p> : <>
        <p className="text-xs text-muted-foreground">{t({ bn: "পেন্ডিং লিড", en: "Pending leads" })}: {alerts.length}</p>
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">{t({ bn: "এখন কোনো সতর্কবার্তা নেই।", en: "No current warnings." })}</p> : <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
          {alerts.map(a => <li key={a.id} className="border-b border-border pb-3 last:border-0">
            <div className="break-words font-medium">{a.leadName ?? t({ bn: "লিড", en: "Lead" })}</div>
            {scope === "authority" && <div className="break-words text-xs">{a.agentName ?? t({ bn: "এজেন্ট", en: "Agent" })}</div>}
            <div className="text-xs text-destructive">{a.idleDays} {t({ bn: "কার্যদিবস কাজ নেই", en: "business days inactive" })}</div>
            <div className="text-xs text-muted-foreground">{t({ bn: "শেষ কাজ", en: "Last work" })}: {fmt(a.lastWorkAt)}</div>
            <div className="text-xs text-muted-foreground">{t({ bn: "অবস্থা", en: "Status" })}: {a.workState ?? a.status}</div>
          </li>)}
        </ul>}
        {query.data && <p className="text-xs text-muted-foreground">{t({ bn: "যাচাই", en: "Checked" })}: {fmt(query.data.checkedAt)}</p>}
      </>}
    </PopoverContent>
  </Popover>;
}