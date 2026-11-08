import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useLang, useT } from "@/lib/i18n";
import { FINOS_LOG_PAGE_SIZE, type FinosLogRow } from "@/lib/finos-access";
import { getFinosAccessLog, getFinosSecurityStatus } from "@/lib/finos-access.functions";

export function FinosAccessLogPanel() {
  const token = useAdminToken();
  const t = useT();
  const lang = useLang();
  const fetchLog = useServerFn(getFinosAccessLog);
  const fetchSecurity = useServerFn(getFinosSecurityStatus);
  const security = useQuery({
    queryKey: ["finos-security-status", token],
    queryFn: () => fetchSecurity({ data: { adminToken: token } }),
    enabled: Boolean(token), retry: false,
  });
  const [page, setPage] = useState(0);
  const [type, setType] = useState<"all" | "financial" | "work">("all");
  const log = useQuery({
    queryKey: ["finos-access-log", token, page, type],
    queryFn: () => fetchLog({ data: { adminToken: token, page, summaryType: type } }),
    enabled: Boolean(token), retry: false,
  });
  const last = Math.max(0, Math.ceil((log.data?.total ?? 0) / FINOS_LOG_PAGE_SIZE) - 1);
  const summary = (row: FinosLogRow) => row.summaryType === "financial"
    ? t({ bn: "আর্থিক সারসংক্ষেপ", en: "Financial summary" })
    : t({ bn: "কাজের সারসংক্ষেপ", en: "Work summary" });
  const time = (row: FinosLogRow) => new Date(row.servedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" });
  return <section className="space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><ScrollText className="size-4 text-primary" />{t({ bn: "FinOS অ্যাক্সেস লগ", en: "FinOS access log" })}</h2>
      <Button variant="outline" size="icon" aria-label={t({ bn: "রিফ্রেশ", en: "Refresh" })} title={t({ bn: "রিফ্রেশ", en: "Refresh" })} disabled={!token || log.isFetching} onClick={() => void log.refetch()}><RefreshCw className={log.isFetching ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} /></Button>
    </header>
    <div className="space-y-2 border-b border-border pb-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t({ bn: "FinOS API নিরাপত্তা", en: "FinOS API security" })}</h3>
        <Button variant="outline" size="sm" disabled={!token || security.isFetching} onClick={() => void security.refetch()}><RefreshCw className="size-3.5" />{t({ bn: "অবস্থা যাচাই", en: "Check status" })}</Button>
      </div>
      {security.isError ? <p role="alert" className="text-destructive">{t({ bn: "পূর্ণ IT অনুমতি দিয়ে আবার যাচাই করুন।", en: "Check again with full IT authorization." })}</p> : security.data ? <dl className="grid grid-cols-2 gap-2">
        <dt className="text-muted-foreground">{t({ bn: "API কী", en: "API key" })}</dt><dd>{security.data.keyConfigured ? t({ bn: "সেট করা আছে", en: "Configured" }) : t({ bn: "সেট করা নেই", en: "Not configured" })}</dd>
        <dt className="text-muted-foreground">{t({ bn: "সংযোগ", en: "Connection" })}</dt><dd>{security.data.enabled ? t({ bn: "সুইচ চালু; সফল সংযোগ যাচাই বাকি", en: "Switch on; connection not verified" }) : t({ bn: "বন্ধ", en: "Off" })}</dd>
      </dl> : <p className="text-muted-foreground">{t({ bn: "অবস্থা যাচাই করা হয়নি।", en: "Status not checked." })}</p>}
      <details><summary className="cursor-pointer font-medium">{t({ bn: "নিরাপদ কী পরিবর্তন", en: "Secure key replacement" })}</summary><p className="mt-2 text-muted-foreground">{t({ bn: "প্রথমে সংযোগ বন্ধ করুন। Project Settings → Secrets-এ FINOS_SUMMARY_SECRET পরিবর্তন করুন এবং FinOS-এর নিরাপদ Secrets-এ একই কী দিন। এখানে বা চ্যাটে কী লিখবেন না। দুই অ্যাপ আপডেটের পর স্বাক্ষরিত অনুরোধ যাচাই করে সংযোগ চালু করুন।", en: "Turn the connection off first. Replace FINOS_SUMMARY_SECRET in Project Settings → Secrets and set the same key in FinOS secure Secrets. Never enter it here or in chat. Update both apps and verify signed requests before enabling the connection." })}</p></details>
    </div>
    <label className="flex flex-wrap items-center gap-2 text-xs">
      {t({ bn: "সারসংক্ষেপের ধরন", en: "Summary type" })}
      <select className="rounded-md border border-input bg-background px-2 py-2 text-foreground" value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(0); }}>
        <option value="all">{t({ bn: "সব", en: "All" })}</option>
        <option value="financial">{t({ bn: "আর্থিক", en: "Financial" })}</option>
        <option value="work">{t({ bn: "কাজ", en: "Work" })}</option>
      </select>
    </label>
    {!token ? <p className="text-sm text-muted-foreground">{t({ bn: "পূর্ণ IT PIN প্রয়োজন।", en: "Full IT PIN required." })}</p>
      : log.isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "অ্যাক্সেস লগ আনা যায়নি; আবার চেষ্টা করুন।", en: "Access log unavailable. Try again." })}</p>
      : log.isPending ? <p role="status" className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>
      : !log.data?.rows.length ? <p className="text-sm text-muted-foreground">{t({ bn: "এই ধরনে FinOS-কে সারসংক্ষেপ দেওয়ার কোনো সংরক্ষিত লগ নেই।", en: "No saved summary-serving receipts for this selection." })}</p>
      : <>
        <div className="table-scroll hidden md:block"><table className="w-full text-left text-xs">
          <thead><tr className="text-muted-foreground"><th className="py-2 font-medium">{t({ bn: "দেওয়ার সময় (ঢাকা)", en: "Served at (Dhaka)" })}</th><th className="py-2 font-medium">{t({ bn: "ধরন", en: "Type" })}</th><th className="py-2 font-medium">{t({ bn: "তথ্যের সময়সীমা", en: "Summary period" })}</th></tr></thead>
          <tbody>{log.data.rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="py-3 pr-3 whitespace-nowrap">{time(row)}</td><td className="py-3 pr-3">{summary(row)}</td><td className="py-3">{row.from} — {row.to}</td></tr>)}</tbody>
        </table></div>
        <ul className="space-y-2 md:hidden">{log.data.rows.map((row) => <li key={row.id} className="space-y-1 rounded-lg border border-border p-3 text-xs"><p className="font-medium">{summary(row)}</p><p>{time(row)} ({t({ bn: "ঢাকা", en: "Dhaka" })})</p><p className="text-muted-foreground">{row.from} — {row.to}</p></li>)}</ul>
        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t({ bn: `মোট ${log.data.total} · পাতা ${page + 1}/${last + 1}`, en: `${log.data.total} receipts · Page ${page + 1}/${last + 1}` })}</span><div className="flex gap-2">
          <Button variant="outline" size="icon" disabled={page === 0 || log.isFetching} aria-label={t({ bn: "আগের পাতা", en: "Previous page" })} title={t({ bn: "আগের পাতা", en: "Previous page" })} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" disabled={page >= last || log.isFetching} aria-label={t({ bn: "পরের পাতা", en: "Next page" })} title={t({ bn: "পরের পাতা", en: "Next page" })} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div></footer>
      </>}
  </section>;
}