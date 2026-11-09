import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Bi } from "@/components/crm/Bi";
import { useT } from "@/lib/i18n";
import { getAdminToken } from "@/lib/local-session";
import { getVipRecoveryQueue, saveVipRecoveryReview } from "@/lib/vip-recovery.functions";
import { REVIEW_ACTIONS, REVIEW_DECISIONS, type RecoveryReason } from "@/lib/vip-recovery";

const REASONS: Record<RecoveryReason, { en: string; bn: string }> = {
  positive_then_rejected: { en: "Positive evidence → rejection", bn: "ইতিবাচক তথ্যের পরে প্রত্যাখ্যান" },
  recorded_rejection: { en: "Recorded rejection", bn: "সংরক্ষিত প্রত্যাখ্যান" },
  unassessed: { en: "No submitted assessment", bn: "জমা মূল্যায়ন নেই" },
  low_score: { en: "Low six-answer score", bn: "ছয় উত্তরের স্কোর কম" },
  positive_signal: { en: "Positive reported signal", bn: "রিপোর্টে ইতিবাচক সংকেত" },
  needs_evidence: { en: "Qualification needs evidence", bn: "যোগ্যতার প্রমাণ প্রয়োজন" },
};
const STATUSES = { pending: { en: "Pending", bn: "অপেক্ষমাণ" }, reviewing: { en: "Under review", bn: "পর্যালোচনাধীন" }, resolved: { en: "Reviewed", bn: "পর্যালোচিত" } };
const DECISIONS = {
  needs_evidence: { en: "More evidence needed", bn: "আরও প্রমাণ প্রয়োজন" },
  recovery_candidate: { en: "Recovery candidate", bn: "পুনরুদ্ধারের সম্ভাবনা" },
  unqualified: { en: "Management assessed: unqualified", bn: "ম্যানেজমেন্ট মূল্যায়ন: অযোগ্য" },
  no_change: { en: "No change recommended", bn: "পরিবর্তনের সুপারিশ নেই" },
};
const ACTIONS = { reviewing: { en: "Start review", bn: "পর্যালোচনা শুরু" }, resolved: { en: "Complete review", bn: "পর্যালোচনা শেষ" }, reopened: { en: "Reopen", bn: "আবার খুলুন" }, note: { en: "Add evidence note", bn: "প্রমাণের নোট যোগ করুন" } };
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", year: "numeric" }) : "—";
type Task = Awaited<ReturnType<typeof getVipRecoveryQueue>>["tasks"][number];

export function VipRecoveryQueue({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const t = useT();
  const run = useServerFn(getVipRecoveryQueue);
  const save = useServerFn(saveVipRecoveryReview);
  const q = useQuery({ queryKey: ["vip-recovery-queue"], queryFn: () => run({ data: { adminToken: getAdminToken() } }), refetchOnWindowFocus: true });
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState("all");
  const [reason, setReason] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [action, setAction] = useState<(typeof REVIEW_ACTIONS)[number]>("reviewing");
  const [decision, setDecision] = useState<(typeof REVIEW_DECISIONS)[number]>("needs_evidence");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const mutation = useMutation({ mutationFn: () => save({ data: { adminToken: getAdminToken(), leadId: selectedId ?? "", requestId, action, decision, note } }),
    onSuccess: async () => { await q.refetch(); setNote(""); setRequestId(crypto.randomUUID()); } });
  const tasks = q.data?.tasks ?? [];
  const selected = tasks.find(r => r.leadId === selectedId);
  const agents = [...new Set(tasks.map(r => r.agentName))].sort();
  const rows = tasks.filter(r => (agent === "all" || r.agentName === agent) && (reason === "all" || r.reason === reason) && `${r.name} ${r.agentName} ${r.caseNumber} ${r.leadId}`.toLowerCase().includes(search.toLowerCase()));
  // Management task status is separate from CRM lead status.
  const filtered = rows.filter(r => status === "all" || r.taskStatus === status);
  function open(task: Task) {
    setSelectedId(task.leadId); setAction("reviewing"); setDecision("needs_evidence"); setNote(""); setRequestId(crypto.randomUUID()); mutation.reset();
  }
  const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground";
  return <section className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-gold-ink"><ShieldCheck className="size-4" /> EXECUTIVE HQ · 100-CASE AUDIT</div>
        <h2 className="text-xl font-semibold"><Bi en="Executive VIP Recovery Queue" bn="এক্সিকিউটিভ VIP পুনরুদ্ধার তালিকা" /></h2>
        <p className="mt-2 text-sm text-muted-foreground">{t({ en: "Recorded rejection is not proof of poor leads or agent fault. Management conclusions stay separate from CRM qualification and ownership.", bn: "সংরক্ষিত প্রত্যাখ্যান মানেই খারাপ লিড বা এজেন্টের দোষ নয়। ম্যানেজমেন্টের সিদ্ধান্ত CRM-এর যোগ্যতা ও মালিকানা বদলায় না।" })}</p>
      </div>
      <Button variant="outline" size="icon" title={t({ en: "Refresh evidence", bn: "তথ্য পুনরায় পড়ুন" })} aria-label="Refresh recovery evidence" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className={q.isFetching ? "animate-spin" : ""} /></Button>
    </header>
    {q.isPending && <p role="status" className="text-sm text-muted-foreground">{t({ en: "Reading audited cases…", bn: "অডিটের তথ্য পড়া হচ্ছে…" })}</p>}
    {q.isError && <div role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">{t({ en: "Recovery evidence unavailable. No empty or stale result is treated as today's evidence.", bn: "তথ্য পাওয়া যায়নি। খালি বা পুরোনো ফল আজকের প্রমাণ হিসেবে দেখানো হচ্ছে না।" })}</div>}
    {q.data && !q.isError && <>
      <div className="grid grid-cols-2 gap-4 border-y border-border py-4 lg:grid-cols-4">
        {[{ label: { en: "Audited cases", bn: "অডিটের লিড" }, count: tasks.length }, { label: { en: "Awaiting review", bn: "পর্যালোচনার অপেক্ষায়" }, count: tasks.filter(r => r.taskStatus === "pending").length }, { label: { en: "Under review", bn: "পর্যালোচনাধীন" }, count: tasks.filter(r => r.taskStatus === "reviewing").length }, { label: { en: "Reviewed", bn: "পর্যালোচিত" }, count: tasks.filter(r => r.taskStatus === "resolved").length }].map(s => <div key={s.label.en}><div className="text-xs text-muted-foreground">{t(s.label)}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{s.count}</div></div>)}
      </div>
      <p className="text-xs text-muted-foreground">{t({ en: "Original audit", bn: "মূল অডিট" })}: {date(q.data.auditAt)} · {t({ en: "Current evidence read", bn: "বর্তমান তথ্য পড়া" })}: {date(q.data.readAt)} (Dhaka)</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Search recovery leads" className="pl-9" placeholder={t({ en: "Lead / agent / case", bn: "লিড / এজেন্ট / কেস" })} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select aria-label="Filter recovery agent" className={selectClass} value={agent} onChange={e => setAgent(e.target.value)}><option value="all">{t({ en: "All agents", bn: "সব এজেন্ট" })}</option>{agents.map(a => <option key={a}>{a}</option>)}</select>
        <select aria-label="Filter review status" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t({ en: "All review stages", bn: "সব পর্যালোচনা" })}</option>{Object.entries(STATUSES).map(([k, v]) => <option value={k} key={k}>{t(v)}</option>)}</select>
        <select aria-label="Filter recovery reason" className={selectClass} value={reason} onChange={e => setReason(e.target.value)}><option value="all">{t({ en: "All evidence reasons", bn: "সব কারণ" })}</option>{Object.entries(REASONS).map(([k, v]) => <option value={k} key={k}>{t(v)}</option>)}</select>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{filtered.length} / {tasks.length}</span><span>{t({ en: "Management: Executive HQ", bn: "ম্যানেজমেন্ট: এক্সিকিউটিভ HQ" })}</span></div>
      <ul className="space-y-3 md:hidden">{filtered.map(r => <li key={r.leadId} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs text-muted-foreground">#{String(r.caseNumber).padStart(3, "0")} · {r.agentName}</div><div className="break-words font-semibold">{r.name}</div></div><Button variant="outline" size="icon" aria-label={`Review case ${r.caseNumber}`} onClick={() => open(r)}><ClipboardCheck /></Button></div><div className="mt-2 text-sm">{t(REASONS[r.reason])}</div><div className="mt-1 text-xs text-muted-foreground">{r.source} · {t(STATUSES[r.taskStatus])}</div></li>)}</ul>
      <div className="table-scroll hidden md:block"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{[{ en: "Case / lead", bn: "কেস / লিড" }, { en: "Current agent", bn: "বর্তমান এজেন্ট" }, { en: "Source / outcome", bn: "উৎস / ফল" }, { en: "Review reason", bn: "পর্যালোচনার কারণ" }, { en: "Management task", bn: "ম্যানেজমেন্ট কাজ" }].map(h => <th className="px-2 py-3 font-medium" key={h.en}>{t(h)}</th>)}</tr></thead><tbody>{filtered.map(r => <tr className="border-b border-border" key={r.leadId}><td className="max-w-52 px-2 py-3"><div className="text-xs text-muted-foreground">#{String(r.caseNumber).padStart(3, "0")}</div><Button variant="link" className="h-auto whitespace-normal p-0 text-left text-foreground" onClick={() => onOpenLead(r.leadId)} disabled={r.missing}>{r.name}</Button></td><td className="max-w-44 break-words px-2 py-3">{r.agentName}</td><td className="px-2 py-3"><div>{r.source}</div><div className="text-xs text-muted-foreground">{r.latest?.category ?? "—"}</div></td><td className="max-w-52 px-2 py-3"><div className={r.priority === "high" ? "text-warning" : ""}>{t(REASONS[r.reason])}</div><div className="text-xs text-muted-foreground">{r.submittedCount} {t({ en: "reports", bn: "রিপোর্ট" })} · V2: {r.latestScore ?? "—"}</div></td><td className="px-2 py-3"><div className="mb-1 text-xs">{t(STATUSES[r.taskStatus])}</div><Button variant="outline" size="sm" onClick={() => open(r)}><ClipboardCheck />{t({ en: "Review", bn: "পর্যালোচনা" })}</Button></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="py-6 text-center text-sm text-muted-foreground">{t({ en: "No cases match these filters.", bn: "এই ফিল্টারে কোনো কেস নেই।" })}</p>}
    </>}
    <Dialog open={Boolean(selectedId)} onOpenChange={v => { if (!mutation.isPending && !v) setSelectedId(null); }}><DialogContent className="z-[70]">{selected && <>
      <DialogHeader><DialogTitle>#{String(selected.caseNumber).padStart(3, "0")} · {selected.name}</DialogTitle><DialogDescription>{selected.agentName} · {t(STATUSES[selected.taskStatus])}</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">{t({ en: "Audit-time agent", bn: "অডিটকালের এজেন্ট" })}</dt><dd>{selected.auditAgentName}</dd></div><div><dt className="text-xs text-muted-foreground">{t({ en: "Source / reference", bn: "উৎস / রেফারেন্স" })}</dt><dd className="break-words">{selected.source} / {selected.reference ?? "—"}</dd></div><div><dt className="text-xs text-muted-foreground">{t({ en: "Lead state / stage", bn: "লিডের অবস্থা / ধাপ" })}</dt><dd>{selected.status} / {selected.stage}</dd></div><div><dt className="text-xs text-muted-foreground">{t({ en: "Latest submitted report", bn: "সর্বশেষ জমা রিপোর্ট" })}</dt><dd>{date(selected.latest?.submitted_at ?? null)}</dd></div></dl>
      <div className="border-l-2 border-warning pl-3 text-sm"><p>{t(REASONS[selected.reason])}</p><p className="mt-1 text-xs text-muted-foreground">{t({ en: "Source labels do not establish buyer intent. Review evidence before recording an unqualified conclusion.", bn: "উৎসের নাম ক্রয়ের ইচ্ছা প্রমাণ করে না। অযোগ্য সিদ্ধান্তের আগে প্রমাণ পর্যালোচনা করুন।" })}</p></div>
      <Button variant="outline" onClick={() => { setSelectedId(null); onOpenLead(selected.leadId); }} disabled={selected.missing}>{t({ en: "Open lead history", bn: "লিডের ইতিহাস খুলুন" })}</Button>
      {q.data?.canReview && !selected.missing && <form className="space-y-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
        <label className="grid gap-1 text-xs">{t({ en: "Review action", bn: "পর্যালোচনার ধাপ" })}<select className={selectClass} value={action} disabled={mutation.isPending} onChange={e => { setAction(e.target.value as typeof action); setRequestId(crypto.randomUUID()); mutation.reset(); }}>{REVIEW_ACTIONS.map(k => <option key={k} value={k}>{t(ACTIONS[k])}</option>)}</select></label>
        <label className="grid gap-1 text-xs">{t({ en: "Management assessment", bn: "ম্যানেজমেন্ট মূল্যায়ন" })}<select className={selectClass} value={decision} disabled={mutation.isPending} onChange={e => { setDecision(e.target.value as typeof decision); setRequestId(crypto.randomUUID()); mutation.reset(); }}>{REVIEW_DECISIONS.map(k => <option key={k} value={k}>{t(DECISIONS[k])}</option>)}</select></label>
        <label className="grid gap-1 text-xs">{t({ en: "Evidence / reason (required)", bn: "প্রমাণ / কারণ (আবশ্যক)" })}<Textarea value={note} maxLength={1500} required disabled={mutation.isPending} onChange={e => { setNote(e.target.value); setRequestId(crypto.randomUUID()); mutation.reset(); }} /></label>
        <p className="text-xs text-muted-foreground">{t({ en: "Review only. No reassignment, customer messages or lead edits.", bn: "শুধু পর্যালোচনা। পুনর্বণ্টন, গ্রাহককে বার্তা বা লিড পরিবর্তন হবে না।" })}</p>
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{t({ en: "Review not confirmed. Retry to verify the saved receipt.", bn: "পর্যালোচনা নিশ্চিত হয়নি। আবার চেষ্টা করুন।" })}</p>}
        {mutation.isSuccess && <p role="status" className="text-sm text-success">{t({ en: "Review saved; history refreshed.", bn: "পর্যালোচনা সংরক্ষিত; ইতিহাস হালনাগাদ।" })}</p>}
        <Button type="submit" disabled={mutation.isPending || !note.trim()}><ClipboardCheck />{t({ en: mutation.isPending ? "Saving…" : "Save management review", bn: mutation.isPending ? "সংরক্ষণ হচ্ছে…" : "পর্যালোচনা সংরক্ষণ" })}</Button>
      </form>}
      {!q.data?.canReview && <p className="text-xs text-muted-foreground">{t({ en: "Read-only oversight. Executive HQ PIN is required to record management reviews.", bn: "শুধু তদারকি। পর্যালোচনা সংরক্ষণে এক্সিকিউটিভ HQ PIN প্রয়োজন।" })}</p>}
      <section className="space-y-2 border-t border-border pt-3"><h3 className="text-sm font-semibold">{t({ en: "Permanent review history", bn: "স্থায়ী পর্যালোচনার ইতিহাস" })}</h3>{!selected.reviews.length && <p className="text-xs text-muted-foreground">{t({ en: "No management review recorded yet.", bn: "এখনও ম্যানেজমেন্টের পর্যালোচনা নেই।" })}</p>}{[...selected.reviews].reverse().map(r => <article className="border-l border-border pl-3 text-sm" key={r.id}><div className="text-xs text-muted-foreground">{date(r.created_at)} · {r.actor_name}</div><div className="font-medium">{t(ACTIONS[r.action as keyof typeof ACTIONS])} · {t(DECISIONS[r.decision as keyof typeof DECISIONS])}</div><p className="whitespace-pre-wrap break-words">{r.note}</p></article>)}</section>
    </>}</DialogContent></Dialog>
  </section>;
}