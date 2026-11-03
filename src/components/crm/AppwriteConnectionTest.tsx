import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PlugZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAppwriteConfig } from "@/lib/appwrite-config";
import type { AppwritePingFailureKind, AppwritePingResult } from "@/lib/appwrite-ping";
import { getAppwriteStartupState, subscribeAppwriteStartup } from "@/lib/appwrite-startup";
import { useT } from "@/lib/i18n";

const HINT: Record<AppwritePingFailureKind, { bn: string; en: string }> = {
  unknown_origin: {
    bn: "এই ওয়েব ঠিকানাটি Appwrite প্রজেক্টে Web platform হিসেবে যুক্ত নেই। Appwrite Console → Overview → Add platform → Web-এ এই হোস্টনেমটি যোগ করুন।",
    en: "This web address isn't registered as a Web platform in the Appwrite project. Add this hostname in Appwrite Console → Overview → Add platform → Web.",
  },
  project_not_found: {
    bn: "Appwrite এই প্রজেক্ট আইডি খুঁজে পায়নি। আইডি ও রিজিয়ন (endpoint) মিলিয়ে দেখুন।",
    en: "Appwrite couldn't find this project ID. Check the project ID and region endpoint.",
  },
  network: {
    bn: "Appwrite সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট, VPN বা ব্রাউজার ব্লকার দেখুন।",
    en: "Couldn't reach the Appwrite server. Check the internet connection, VPN or browser blockers.",
  },
  timeout: {
    bn: "নির্ধারিত সময়ের মধ্যে Appwrite উত্তর দেয়নি। একটু পরে আবার চেষ্টা করুন।",
    en: "Appwrite didn't answer in time. Try again shortly.",
  },
  sdk_load: {
    bn: "Appwrite টুলকিট লোড হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন। কোনো অনুরোধ Appwrite-এ যায়নি।",
    en: "The Appwrite toolkit didn't load — refresh the page and try again. No request reached Appwrite.",
  },
  http: {
    bn: "Appwrite একটি ত্রুটি ফেরত দিয়েছে। নিচের বিস্তারিত দেখুন।",
    en: "Appwrite returned an error. See the details below.",
  },
  unexpected: {
    bn: "অপ্রত্যাশিত উত্তর। নিচের বিস্তারিত দেখুন।",
    en: "Unexpected result. See the details below.",
  },
};

/**
 * IT Console: "Test Appwrite connection". Sends one real ping to Appwrite from
 * this browser. Independent of the CRM backend — no sign-in, no data, no writes.
 */
export function AppwriteConnectionTest() {
  const t = useT();
  const config = getAppwriteConfig();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<AppwritePingResult | null>(null);
  // The app's one startup ping (sent once per page load from the root layout).
  const startup = useSyncExternalStore(subscribeAppwriteStartup, getAppwriteStartupState, () => ({ status: "idle" as const }));
  const startupResult = startup.status === "done" ? startup.result : null;
  const result = manual ?? startupResult;
  const fromStartup = !manual && !!startupResult;

  async function run() {
    setBusy(true);
    try {
      const { pingAppwrite } = await import("@/lib/appwrite-ping");
      setManual(await pingAppwrite());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-live="polite">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <PlugZap className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">
              {t({ bn: "Appwrite সংযোগ পরীক্ষা", en: "Appwrite connection test" })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t({
                bn: "এই ব্রাউজার থেকে Appwrite-এ একটি আসল ping পাঠায়। CRM-এর ডেটা, সাইন-ইন বা কাজের কিছু বদলায় না।",
                en: "Sends one real ping from this browser to Appwrite. It doesn't touch CRM data, sign-in or workflows.",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result ? (
            <Badge variant={result.ok ? "secondary" : "destructive"}>
              {result.ok ? t({ bn: "সংযুক্ত", en: "Connected" }) : t({ bn: "ব্যর্থ", en: "Failed" })}
            </Badge>
          ) : null}
          <Button size="sm" variant="outline" onClick={run} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
            {busy
              ? t({ bn: "পরীক্ষা চলছে…", en: "Testing…" })
              : t({ bn: "Appwrite সংযোগ পরীক্ষা করুন", en: "Test Appwrite connection" })}
          </Button>
        </div>
      </header>

      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="font-medium">{t({ bn: "প্রজেক্ট", en: "Project" })}</dt>
        <dd className="break-all">
          {config.projectName} · <span className="font-mono">{config.projectId}</span>
        </dd>
        <dt className="font-medium">Endpoint</dt>
        <dd className="break-all font-mono">{config.endpoint}</dd>
      </dl>

      {!manual && startup.status === "running" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {t({ bn: "অ্যাপ চালুর সময়ের পরীক্ষা চলছে…", en: "Startup check running…" })}
        </p>
      ) : null}

      {result ? (
        <p className="mt-3 text-xs font-medium text-muted-foreground">
          {fromStartup
            ? t({ bn: "অ্যাপ চালুর সময়ের স্বয়ংক্রিয় পরীক্ষা (এই পেজ লোডে একবার)", en: "Automatic startup check (once per page load)" })
            : t({ bn: "আপনার চালানো পরীক্ষা", en: "Your manual test" })}
        </p>
      ) : null}

      {result ? (
        result.ok ? (
          <div className="mt-1 flex items-start gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium">
                {t({ bn: "Appwrite উত্তর দিয়েছে", en: "Appwrite responded" })}: “{result.response}”
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {result.latencyMs} ms ·{" "}
                {new Date(result.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}{" "}
                {t({ bn: "(ঢাকা)", en: "(Dhaka)" })}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-medium">{t(HINT[result.kind])}</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {result.code ? `HTTP ${result.code} · ` : ""}
                {result.type ? `${result.type} · ` : ""}
                {result.message}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{result.latencyMs} ms</p>
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}
