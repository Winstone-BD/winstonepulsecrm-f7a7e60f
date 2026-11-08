import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useLang, useT } from "@/lib/i18n";
import { FINOS_LOG_PAGE_SIZE, type FinosLogRow } from "@/lib/finos-access";
import { getFinosAccessLog } from "@/lib/finos-access.functions";

export function FinosAccessLogPanel() {
  const token = useAdminToken();
  const t = useT();
  const lang = useLang();
  const fetchLog = useServerFn(getFinosAccessLog);
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