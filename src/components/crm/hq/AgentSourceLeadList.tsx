import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { readAgentSourceLeads } from "@/lib/agent-sales-scorecard.functions";
import type { LeadSourceBucket } from "@/lib/agent-sales-scorecard";

export default function AgentSourceLeadList({ agentId, name, bucket, label, onClose }: { agentId: string; name: string; bucket: LeadSourceBucket; label: string; onClose: () => void }) {
  const t = useT(), token = useAdminToken(), read = useServerFn(readAgentSourceLeads);
  const [search, setSearch] = useState(""), [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["agent-source-leads", token ?? "session", agentId, bucket], queryFn: () => read({ data: { adminToken: token, agentId, bucket } }), staleTime: 0 });
  const needle = search.trim().toLowerCase();
  const rows = q.data?.rows.filter(l => `${l.name ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(needle)) ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / 25)), current = Math.min(page, pages - 1);
  const visible = rows.slice(current * 25, (current + 1) * 25);
  const statuses: Record<string, { bn: string; en: string }> = { pending: { bn: "অপেক্ষমাণ", en: "Pending" }, contacted: { bn: "যোগাযোগ হয়েছে", en: "Contacted" }, follow_up: { bn: "ফলো-আপ", en: "Follow-up" }, closed: { bn: "বন্ধ", en: "Closed" } };
  const sources: Record<string, { bn: string; en: string }> = { head_database: { bn: "কোম্পানি ডেটাবেজ", en: "Company database" }, public_directory: { bn: "পাবলিক ডিরেক্টরি", en: "Public directory" }, agent_app: { bn: "এজেন্ট অ্যাপ", en: "Agent app" } };
  const sourceLabel = (source: string | null) => {
    const label = sources[source ?? ""];
    return label ? t(label) : source || t({ bn: "উৎস অজানা", en: "Unknown source" });
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-3xl" aria-label="Source lead list">
    <DialogHeader><DialogTitle>{name} · {label}</DialogTitle><DialogDescription>{t({ bn: "বর্তমান লিড", en: "Current portfolio" })} · {q.isSuccess ? q.data.rows.length : "—"}</DialogDescription></DialogHeader>
    <div className="flex min-w-0 gap-2"><Input aria-label="Search source leads" placeholder={t({ bn: "নাম বা ফোন খুঁজুন", en: "Search name or phone" })} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /><Button size="icon" variant="outline" aria-label="Refresh source leads" title="Refresh source leads" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /></Button></div>
    {q.isPending ? <p role="status">{t({ bn: "লিড লোড হচ্ছে…", en: "Loading leads…" })}</p> : q.isError ? <p role="alert" className="text-destructive">{t({ bn: "লিড পড়া যায়নি। আবার চেষ্টা করুন।", en: "Leads unavailable. Please refresh." })}</p> : <>
      <p className="text-xs text-muted-foreground">{rows.length} {t({ bn: "লিড", en: "leads" })}</p>
      {!rows.length ? <p>{t({ bn: "কোনো লিড পাওয়া যায়নি।", en: "No leads match." })}</p> : <>
        <ul className="space-y-3 md:hidden">{visible.map(l => <li key={l.id} className="border-b border-border pb-3"><p className="break-words font-medium">{l.name || "—"}</p><p className="break-all text-sm">{l.phone || "—"}</p><p className="break-words text-xs text-muted-foreground">{t(statuses[l.status] ?? { bn: l.status, en: l.status })} · {sourceLabel(l.source)}</p></li>)}</ul>
        <div className="table-scroll hidden md:block"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground">{[t({ bn: "নাম", en: "Name" }),t({ bn: "ফোন", en: "Phone" }),t({ bn: "অবস্থা", en: "Status" }),t({ bn: "সংরক্ষিত উৎস", en: "Saved source" })].map(h => <th className="py-2 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map(l => <tr key={l.id} className="border-b border-border"><td className="max-w-56 break-words py-3 pr-3">{l.name || "—"}</td><td className="py-3 pr-3">{l.phone || "—"}</td><td className="py-3 pr-3">{t(statuses[l.status] ?? { bn:l.status,en:l.status })}</td><td className="max-w-40 break-words py-3">{sourceLabel(l.source)}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between"><Button variant="outline" size="icon" aria-label="Previous lead page" title="Previous lead page" disabled={current===0} onClick={() => setPage(current-1)}><ChevronLeft className="size-4" /></Button><span className="text-sm tabular-nums">{current+1} / {pages}</span><Button variant="outline" size="icon" aria-label="Next lead page" title="Next lead page" disabled={current+1>=pages} onClick={() => setPage(current+1)}><ChevronRight className="size-4" /></Button></div>
      </>}
    </>}
  </DialogContent></Dialog>;
}