import { Check, Copy, Download, Link2, QrCode, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { useT, useLang } from "@/lib/i18n";
import { getAdminToken } from "@/lib/local-session";
import { getApkDownloadLink, getCurrentApkRelease } from "@/lib/apk-download.functions";
import { ApkUploadPanel } from "@/components/crm/ApkUploadPanel";
import {
  APK_LINK_MINUTES,
  APK_RELEASE,
  APPROVED_SIGNER_SHA256,
  APPROVED_SIGNER_SUBJECT,
  apkReleaseStatus,
  formatFingerprint,
  type ApkRelease,
} from "@/lib/apk-release";

const dhakaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
const fileName = (path: string) => path.split("/").pop() ?? path;

const INSTALL_STEPS: { bn: string; en: string }[] = [
  { bn: "এজেন্টের ফোনে লিংক বা QR খুলে ফাইলটি ডাউনলোড করুন।", en: "Open the link or scan the QR on the agent's phone and download the file." },
  { bn: "উপরের চেকসাম মিলিয়ে নিন (IT কম্পিউটারে যাচাই করে দিলে ভালো)।", en: "Check the checksum above (best done by IT on a computer)." },
  { bn: "পুরনো টেস্ট অ্যাপ (Winstone Connect Test) থাকলে আগে আনইনস্টল করুন।", en: "Uninstall any old test app (Winstone Connect Test) first." },
  { bn: "ফাইলটি খুলুন; ফোন জিজ্ঞেস করলে শুধু এই একবারের জন্য \"অজানা অ্যাপ ইনস্টল\" অনুমতি দিন।", en: "Open the file; if the phone asks, allow \"Install unknown apps\" for this one install." },
  { bn: "Install চাপুন, তারপর অ্যাপ খুলে CRM-এর ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।", en: "Tap Install, then open the app and sign in with the CRM email and password." },
  { bn: "ফোন, কল লগ ও নোটিফিকেশন অনুমতি দিন, তারপর একটি টেস্ট কল করে CRM-এ রিপোর্ট আসছে কিনা দেখুন।", en: "Allow phone, call log and notification permissions, then make one test call and check the report reaches the CRM." },
];

function CopyChip({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? done : label}
    </Button>
  );
}

type SmokeCheck = { name: string; ok: boolean; status: number | null; detail: string };
type SmokeResult = {
  ok: boolean;
  origin: string;
  checkedAt: string;
  passed: number;
  total: number;
  checks: SmokeCheck[];
};

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * IT Console card: PIN-gated private download of the agent phone app (link,
 * QR, file facts) plus the automatic post-publish smoke test.
 */
export function ApkInstallCard() {
  const t = useT();
  const lang = useLang();
  const loadLink = useServerFn(getApkDownloadLink);
  const loadRelease = useServerFn(getCurrentApkRelease);
  const [release, setRelease] = useState<ApkRelease>(APK_RELEASE);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRelease = useCallback(async () => {
    try {
      setRelease(await loadRelease({ data: { adminToken: getAdminToken() } }));
    } catch {
      // Not unlocked yet: keep showing the built-in release facts.
    }
  }, [loadRelease]);
  useEffect(() => {
    void refreshRelease();
  }, [refreshRelease]);

  const releaseStatus = apkReleaseStatus(release);
  const signerFingerprint = formatFingerprint(release.signerSha256);
  const signerMatches = release.signerSha256.toLowerCase() === APPROVED_SIGNER_SHA256;
  const releaseDate = dhakaDate(release.addedAt);

  const makeLink = async () => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      setLink(await loadLink({ data: { adminToken: getAdminToken() } }));
    } catch {
      setLinkError(t({ bn: "লিংক তৈরি হয়নি। IT PIN দিয়ে আবার চেষ্টা করুন।", en: "Could not create the link. Unlock with the IT PIN and try again." }));
    } finally {
      setLinkBusy(false);
    }
  };

  useEffect(() => {
    if (!link) { setQr(null); return; }
    let cancelled = false;
    void (async () => {
      const { default: QRCode } = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(link.url, { width: 320, margin: 1, errorCorrectionLevel: "M" });
      if (!cancelled) setQr(dataUrl);
    })().catch(() => setQr(null));
    return () => {
      cancelled = true;
    };
  }, [link]);

  const runSmoke = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/public/smoke", { headers: { accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as Partial<SmokeResult> | null;
      // The check endpoint can answer with an error shape (e.g. rate limit or server error) that has no checks list.
      if (!body || !Array.isArray(body.checks)) {
        setResult(null);
        setError(t({ bn: `পরীক্ষা চালানো যায়নি (${res.status})`, en: `Could not run the check (${res.status})` }));
        return;
      }
      setResult({ ...body, checks: body.checks } as SmokeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t({ bn: "পরীক্ষা চালানো যায়নি", en: "Could not run the check" }));
    } finally {
      setRunning(false);
    }
  }, [t]);

  // Automatic run: every load of the console (i.e. right after a publish) checks the live site.
  useEffect(() => {
    void runSmoke();
  }, [runSmoke]);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const expires = link ? new Date(link.expiresAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <QrCode className="size-4 text-primary" /> {t({ bn: "অ্যাপ ইনস্টল ও সিস্টেম পরীক্ষা", en: "App install & system check" })}
      </h2>

      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img
              src={qr}
              alt={t({ bn: "এজেন্ট অ্যাপ ডাউনলোড লিংকের QR কোড", en: "QR code for the agent app download link" })}
              className="size-40 rounded-lg border bg-background p-1"
              width={160}
              height={160}
            />
          ) : (
            <div className="flex size-40 items-center justify-center rounded-lg border p-2 text-center text-xs text-muted-foreground">
              {link
                ? t({ bn: "QR তৈরি হচ্ছে…", en: "Generating QR…" })
                : t({ bn: "লিংক তৈরি করলে QR দেখাবে", en: "Create a link to show the QR" })}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {t({ bn: "ফোনের ক্যামেরা দিয়ে স্ক্যান করুন", en: "Scan with your phone's camera" })}
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t({ bn: "ফাইল", en: "File" })}</dt>
            <dd className="break-all font-mono">{APK_RELEASE.file}</dd>
            <dt className="text-muted-foreground">{t({ bn: "সংস্করণ", en: "Version" })}</dt>
            <dd>{APK_RELEASE.version} ({APK_RELEASE.versionCode}) · {mb(APK_RELEASE.sizeBytes)}</dd>
            <dt className="text-muted-foreground">{t({ bn: "রিলিজের তারিখ", en: "Release date" })}</dt>
            <dd>{releaseDate} {t({ bn: "(ঢাকা)", en: "(Dhaka)" })}</dd>
            <dt className="text-muted-foreground">{t({ bn: "প্যাকেজ", en: "Package" })}</dt>
            <dd className="break-all font-mono">{APK_RELEASE.packageName}</dd>
            <dt className="text-muted-foreground">{t({ bn: "সার্ভার", en: "Connects to" })}</dt>
            <dd>{APK_RELEASE.server}</dd>
          </dl>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="size-3.5 text-primary" />
              {t({ bn: "ইনস্টলের আগে ফাইল যাচাই করুন", en: "Verify the file before installing" })}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t({ bn: "ফাইলের SHA-256 চেকসাম", en: "File SHA-256 checksum" })}</span>
                <CopyChip value={APK_RELEASE.sha256} label={t({ bn: "কপি", en: "Copy" })} done={t({ bn: "কপি হয়েছে", en: "Copied" })} />
              </div>
              <code className="block break-all rounded bg-background px-2 py-1 font-mono">{APK_RELEASE.sha256}</code>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t({ bn: "সাইনিং সার্টিফিকেট SHA-256", en: "Signing certificate SHA-256" })}</span>
                <CopyChip value={signerFingerprint} label={t({ bn: "কপি", en: "Copy" })} done={t({ bn: "কপি হয়েছে", en: "Copied" })} />
              </div>
              <code className="block break-all rounded bg-background px-2 py-1 font-mono">{signerFingerprint}</code>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{t({ bn: "সাইনার", en: "Signer" })}</dt>
              <dd className="break-all font-mono">{APPROVED_SIGNER_SUBJECT}</dd>
              <dt className="text-muted-foreground">{t({ bn: "অনুমোদিত কী", en: "Approved key" })}</dt>
              <dd>
                {signerMatches
                  ? t({ bn: "✔ কোম্পানির অনুমোদিত কী-এর সাথে মিলেছে", en: "✔ Matches the approved company key" })
                  : t({ bn: "✖ অনুমোদিত কী নয় — ইনস্টল করবেন না", en: "✖ Not the approved key — do not install" })}
              </dd>
            </dl>
            <p className="text-muted-foreground">
              {t({
                bn: "কম্পিউটারে চেক: PowerShell-এ certutil -hashfile <ফাইল> SHA256 চালান — ফলাফল উপরের চেকসামের সাথে হুবহু মিলতে হবে। Android SDK থাকলে apksigner verify --print-certs <ফাইল> চালিয়ে সার্টিফিকেট SHA-256 মেলান। একটি অক্ষরও না মিললে ফাইলটি ইনস্টল করবেন না, IT-কে জানান।",
                en: "On a computer: run certutil -hashfile <file> SHA256 in PowerShell — the result must match the checksum above exactly. With the Android SDK, run apksigner verify --print-certs <file> and compare the certificate SHA-256. If even one character differs, do not install it and tell IT.",
              })}
            </p>
          </div>

          <div className="space-y-1.5 rounded-md border p-3 text-xs">
            <p className="font-semibold">{t({ bn: "ইনস্টল করার নিয়ম", en: "How to install" })}</p>
            <ol className="list-decimal space-y-1 pl-4">
              {INSTALL_STEPS.map((step, i) => (
                <li key={i}>{t(step)}</li>
              ))}
            </ol>
          </div>
          {releaseStatus === "official" ? (
            <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
              <span className="font-semibold">{t({ bn: "অফিশিয়াল রিলিজ", en: "Official release" })}</span>
              {" — "}
              {t({
                bn: "সর্বশেষ কোড থেকে কোম্পানির অনুমোদিত কী দিয়ে সাইন করা। সব এজেন্টকে দেওয়ার আগে নিচের Real phone test checklist একটি ফোনে পাস করান। ইনস্টলের পর CRM-এর ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।",
                en: "Built from the latest code and signed with the approved company key. Pass the Real phone test checklist below on one phone before giving it to all agents. After installing, sign in with the CRM email and password.",
              })}
            </p>
          ) : releaseStatus === "company_signed_older_code" ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              {t({
                bn: "কোম্পানির কী দিয়ে সাইন করা, কিন্তু পুরনো কোড থেকে তৈরি — এখনও অফিশিয়াল রিলিজ নয়। অফিশিয়াল 2.22 আসবে কী-রক্ষকের build-signed-apk বিল্ড থেকে। পুরনো টেস্ট অ্যাপ থাকলে আনইনস্টল করে দিন। ইনস্টলের পর CRM-এর ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।",
                en: "Company-signed, but built from older code — not the official release yet. The official 2.22 will come from the key holder's build-signed-apk run. Uninstall any old test app. After installing, sign in with the CRM email and password.",
              })}
            </p>
          ) : (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
              {t({
                bn: "এই ফাইলটি অনুমোদিত কোম্পানি কী দিয়ে সাইন করা নয় — এজেন্টদের দেবেন না।",
                en: "This file is not signed with the approved company key — do not give it to agents.",
              })}
            </p>
          )}
          {linkError ? <p className="text-xs text-destructive">{linkError}</p> : null}
          {link ? (
            <p className="text-xs text-muted-foreground">
              {t({ bn: `লিংক ${APK_LINK_MINUTES} মিনিট চলবে (ঢাকা ${expires} পর্যন্ত)।`, en: `Link works for ${APK_LINK_MINUTES} minutes (until ${expires} Dhaka).` })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {link ? (
              <Button asChild size="sm">
                <a href={link.url} download={APK_RELEASE.file}>
                  <Download className="size-4" /> {t({ bn: "ডাউনলোড", en: "Download" })}
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant={link ? "outline" : "default"} onClick={() => void makeLink()} disabled={linkBusy}>
              <Link2 className={`size-4 ${linkBusy ? "animate-pulse" : ""}`} />
              {link ? t({ bn: "নতুন লিংক", en: "New link" }) : t({ bn: "ডাউনলোড লিংক তৈরি", en: "Create download link" })}
            </Button>
            {link ? (
              <Button size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t({ bn: "কপি হয়েছে", en: "Copied" }) : t({ bn: "লিংক কপি", en: "Copy link" })}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void runSmoke()} disabled={running}>
              <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} /> {t({ bn: "আবার পরীক্ষা", en: "Re-check" })}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {result?.ok ? (
              <ShieldCheck className="size-4 text-primary" />
            ) : (
              <ShieldAlert className="size-4 text-warning" />
            )}
            {t({ bn: "লাইভ সাইট পরীক্ষা", en: "Live site check" })}
          </h3>
          {result ? (
            <span className="text-xs text-muted-foreground">
              {t({ bn: `${result.passed}/${result.total} ঠিক আছে`, en: `${result.passed}/${result.total} passing` })} ·{" "}
              {new Date(result.checkedAt).toLocaleString(lang === "en" ? "en-GB" : "bn-BD")}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        {!result && running ? (
          <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "পরীক্ষা চলছে…", en: "Checking…" })}</p>
        ) : null}

        <ul className="mt-3 space-y-1.5">
          {(result?.checks ?? []).map((check) => (
            <li
              key={check.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
            >
              <span className="font-mono">{check.name}</span>
              <span
                className={check.ok ? "text-primary" : "text-destructive"}
              >
                {check.ok ? "✔" : "✖"} {check.detail}
                {check.status ? ` (${check.status})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
