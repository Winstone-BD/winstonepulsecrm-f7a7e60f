import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { sheetLeadStreamStatus, syncNewSheetLeads } from "@/lib/sheet-lead-stream.functions";
export function SheetLeadStreamPanel() {
  const token = useAdminToken(), t = useT(), client = useQueryClient();
  const read = useServerFn(sheetLeadStreamStatus), sync = useServerFn(syncNewSheetLeads);
  const q = useQuery({ queryKey: ["sheet-lead-stream", token], queryFn: () => read({ data: { adminToken: token } }) });
  const m = useMutation({ mutationFn: () => sync({ data: { adminToken: token } }), onSuccess: () => client.invalidateQueries({ queryKey: ["sheet-lead-stream"] }) });
  return <section className="space-y-3 border-y border-border py-4" aria-label="New Leads sheet intake"><header className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">New Leads → CRM</h2><Button variant="outline" disabled={m.isPending} onClick={() => m.mutate()}><RefreshCw className="size-4" />{t({ bn: "এখন সিঙ্ক করুন", en: "Sync now" })}</Button></header>
    <p className="text-sm text-muted-foreground">{t({ bn: "স্বয়ংক্রিয় সিঙ্ক বন্ধ · প্রকাশনার অপেক্ষায় · প্রস্তাবিত সময় সকাল ৯:৩০ ও সন্ধ্যা ৬:৩০ ঢাকা।", en: "Automatic sync inactive · awaiting publication · planned times 09:30 and 18:30 Dhaka." })}</p>
    {(q.isError || m.isError) && <p role="alert" className="text-sm text-destructive">{t({ bn: "সিঙ্ক যাচাই করা যায়নি।", en: "Sync could not be verified." })}</p>}
    <p className="text-sm">{q.data ? `${q.data.status} · ${new Date(q.data.started_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}` : t({ bn: "এখনও সিঙ্কের ফল নেই।", en: "No sync result yet." })}</p>
    {q.data?.result && typeof q.data.result === "object" && !Array.isArray(q.data.result) && <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{Object.entries(q.data.result).map(([key,value]) => <div key={key}><dt className="text-xs text-muted-foreground">{t(({created:{bn:"নতুন",en:"New"},duplicates:{bn:"আগে আছে",en:"Existing"},unchanged:{bn:"অপরিবর্তিত",en:"Unchanged"},invalid:{bn:"অবৈধ/অসম্পূর্ণ",en:"Invalid/incomplete"},total:{bn:"মোট",en:"Total"}} as Record<string,{bn:string;en:string}>)[key] ?? {bn:key,en:key})}</dt><dd className="font-semibold">{String(value)}</dd></div>)}</dl>}
  </section>;
}