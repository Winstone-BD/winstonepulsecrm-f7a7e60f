import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, GitCompare, HelpCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { getGithubSyncComparison } from "@/lib/github-status.functions";
import { githubCheckInput } from "@/lib/github-status-shared";
import { CRM_BRANCH, CRM_REPOSITORY } from "@/lib/github-access";
import type { SyncCommit, SyncState } from "@/lib/github-sync-compare";
import { useT } from "@/lib/i18n";

const dhaka = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} Dhaka` : "Unknown";

function CommitList({ commits, repo, link }: { commits: SyncCommit[]; repo: string; link: boolean }) {
  return (
    <ul className="space-y-2">
      {commits.map((c) => (
        <li key={c.sha} className="rounded-md border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {link
              ? <a className="font-mono text-xs underline" href={`https://github.com/${repo}/commit/${c.sha}`} target="_blank" rel="noreferrer">{c.sha.slice(0, 7)}</a>
              : <span className="font-mono text-xs">{c.sha.slice(0, 7)}</span>}
            <span className="min-w-0 flex-1 break-words font-medium">{c.message || "—"}</span>
            <time className="text-xs text-muted-foreground" dateTime={c.date ?? undefined}>{dhaka(c.date)}</time>
          </div>
          {c.files.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
              {c.files.map((f) => <li key={f} className="break-all">{f}</li>)}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function GitSyncComparisonPanel() {
  const t = useT();
  const load = useServerFn(getGithubSyncComparison);
  const check = useMutation({
    mutationFn: () => load({ data: githubCheckInput.parse({ adminToken: getAdminToken(), repository: CRM_REPOSITORY, branch: CRM_BRANCH }) }),
  });
  const r = check.data;

  const verdict: Record<SyncState, { tone: "ok" | "warn" | "bad" | "unknown"; en: string; bn: string }> = {
    in_sync: { tone: "ok", en: "In sync — GitHub has the project's latest change", bn: "সিঙ্কড — GitHub-এ প্রজেক্টের সর্বশেষ পরিবর্তন আছে" },
    project_ahead: { tone: "warn", en: "Project changes are not on GitHub yet", bn: "প্রজেক্টের পরিবর্তন এখনও GitHub-এ যায়নি" },
    github_ahead: { tone: "warn", en: "GitHub has changes the project does not have", bn: "GitHub-এ এমন পরিবর্তন আছে যা প্রজেক্টে নেই" },
    diverged: { tone: "bad", en: "Diverged — each side has changes the other lacks", bn: "আলাদা হয়ে গেছে — দুই দিকেই অন্যটির নেই এমন পরিবর্তন আছে" },
    no_common: { tone: "bad", en: "No shared change found in the latest 100 on GitHub", bn: "GitHub-এর সর্বশেষ ১০০টিতে কোনো মিল পাওয়া যায়নি" },
    project_unknown: { tone: "unknown", en: "Unknown — this version has no project change list", bn: "অজানা — এই ভার্সনে প্রজেক্টের পরিবর্তনের তালিকা নেই" },
  };
  const v = r ? verdict[r.state] : null;
  const Icon = v?.tone === "ok" ? CheckCircle2 : v?.tone === "unknown" ? HelpCircle : TriangleAlert;
  const toneClass = v?.tone === "ok" ? "text-success" : v?.tone === "unknown" ? "text-muted-foreground" : v?.tone === "bad" ? "text-destructive" : "text-warning";

  return (
    <section className="space-y-4 border-t border-border py-4" aria-label="GitHub sync comparison">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 font-semibold"><GitCompare className="size-4 text-primary" />{t({ en: "GitHub sync comparison", bn: "GitHub সিঙ্ক তুলনা" })}</h2>
          <p className="break-all text-xs text-muted-foreground">{CRM_REPOSITORY} · {CRM_BRANCH}</p>
        </div>
        <Button type="button" variant="outline" disabled={check.isPending} onClick={() => check.mutate()}>
          <RefreshCw className={`size-4 ${check.isPending ? "animate-spin motion-reduce:animate-none" : ""}`} />
          {check.isPending ? t({ en: "Comparing…", bn: "তুলনা হচ্ছে…" }) : t({ en: "Compare now", bn: "এখন তুলনা করুন" })}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t({ en: "Read-only. Matches exact change IDs; nothing is pushed or changed. The project list is the one saved when this version was built.", bn: "শুধু দেখা। পরিবর্তনের ID হুবহু মেলানো হয়; কিছু পাঠানো বা বদলানো হয় না। প্রজেক্টের তালিকাটি এই ভার্সন তৈরির সময়ের।" })}</p>

      {check.isError && <p role="alert" className="text-sm text-destructive">{check.error.message}</p>}

      <div aria-live="polite" aria-atomic="true">
        {r && v && (
          <div className="space-y-4 text-sm">
            <p className={`flex items-start gap-2 font-medium ${toneClass}`}><Icon className="mt-0.5 size-4 shrink-0" />{t(v)}</p>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{t({ en: "Project latest", bn: "প্রজেক্টের সর্বশেষ" })}</dt><dd className="font-mono">{r.projectHead?.slice(0, 7) ?? "Unknown"}</dd></div>
              <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{t({ en: "GitHub latest", bn: "GitHub-এর সর্বশেষ" })}</dt><dd className="font-mono">{r.githubHead?.slice(0, 7) ?? "Unknown"}</dd></div>
              <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{t({ en: "Last shared change", bn: "শেষ মিল থাকা পরিবর্তন" })}</dt><dd className="font-mono">{r.commonSha?.slice(0, 7) ?? "None found"}</dd></div>
              <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">{t({ en: "Checked / project list saved", bn: "যাচাই / তালিকা সংরক্ষণ" })}</dt><dd className="text-xs">{dhaka(r.checkedAt)} · {dhaka(r.projectCapturedAt)}</dd></div>
            </dl>

            {r.state !== "project_unknown" && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 font-medium"><ArrowUpFromLine className="size-4" />{t({ en: "In the project, not on GitHub", bn: "প্রজেক্টে আছে, GitHub-এ নেই" })} ({r.projectOnly.length}{r.state === "no_common" ? "+" : ""})</h3>
                {r.projectOnly.length ? <CommitList commits={r.projectOnly} repo={r.repository} link={false} /> : <p className="text-muted-foreground">{t({ en: "None", bn: "নেই" })}</p>}
              </div>
            )}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-medium"><ArrowDownToLine className="size-4" />{t({ en: "On GitHub, not in the project", bn: "GitHub-এ আছে, প্রজেক্টে নেই" })} ({r.state === "project_unknown" ? "Unknown" : r.githubOnly.length}{r.state === "no_common" ? "+" : ""})</h3>
              {r.state === "project_unknown"
                ? <p className="text-muted-foreground">{t({ en: "Cannot tell without the project change list.", bn: "প্রজেক্টের তালিকা ছাড়া বলা যাচ্ছে না।" })}</p>
                : r.githubOnly.length ? <CommitList commits={r.githubOnly} repo={r.repository} link /> : <p className="text-muted-foreground">{t({ en: "None", bn: "নেই" })}</p>}
            </div>
            {(r.state === "diverged" || r.state === "github_ahead") && (
              <p className="rounded-md border border-border bg-muted p-3 text-xs">{t({ en: "Review the GitHub-only changes before anything else. Open Project settings → Git to see the official sync status; do not force-push.", bn: "আগে GitHub-এর আলাদা পরিবর্তনগুলো দেখুন। অফিসিয়াল সিঙ্ক অবস্থা দেখতে Project settings → Git খুলুন; force-push করবেন না।" })}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
