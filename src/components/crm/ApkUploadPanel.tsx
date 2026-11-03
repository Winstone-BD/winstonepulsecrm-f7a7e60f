import { CheckCircle2, FileUp, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { getAdminToken } from "@/lib/local-session";
import { APPROVED_SIGNER_SHA256, formatFingerprint, type ApkRelease } from "@/lib/apk-release";
import { APK_MAX_BYTES, apkReleaseChecks, inspectApk, type ApkCheck, type ApkInspection } from "@/lib/apk-verify";
import { createApkUploadSlot, verifyApkUpload } from "@/lib/apk-upload.functions";

type ServerResult = Awaited<ReturnType<typeof verifyApkUpload>>;

/**
 * IT Console (full IT PIN): pick a new APK, check it in the browser, upload it
 * privately, let the server re-verify version, checksum and signer, and only
 * then replace the download card's file.
 */
export function ApkUploadPanel({ current, onPublished }: { current: ApkRelease; onPublished: () => void }) {
  const t = useT();
  const createSlot = useServerFn(createApkUploadSlot);
  const verify = useServerFn(verifyApkUpload);
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState("");
  const [attested, setAttested] = useState(false);
  const [local, setLocal] = useState<ApkInspection | null>(null);
  const [checks, setChecks] = useState<ApkCheck[] | null>(null);
  const [server, setServer] = useState<ServerResult | null>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "uploading" | "verifying" | "publishing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const opts = (sha: string) => ({
    expectedSha256: sha,
    approvedSigner: APPROVED_SIGNER_SHA256,
    packageName: current.packageName,
    currentVersionCode: current.versionCode,
  });

  const reset = () => {
    setLocal(null);
    setChecks(null);
    setServer(null);
    setUploadedPath(null);
    setError(null);
  };

  const pick = async (f: File | null) => {
    setFile(f);
    reset();
    if (!f) return;
    if (f.size > APK_MAX_BYTES) {
      setError(t({ bn: "ফাইলটি অনেক বড়।", en: "The file is too large." }));
      return;
    }
    setStage("reading");
    try {
      const inspection = await inspectApk(new Uint8Array(await f.arrayBuffer()));
      setLocal(inspection);
      setChecks(apkReleaseChecks(inspection, opts(expected)));
    } catch {
      setError(t({ bn: "ফাইলটি পড়া যায়নি।", en: "Could not read the file." }));
    } finally {
      setStage("idle");
    }
  };

  const onExpected = (v: string) => {
    setExpected(v);
    setServer(null);
    if (local) setChecks(apkReleaseChecks(local, opts(v)));
  };

  const localOk = Boolean(checks?.every((c) => c.ok));

  const run = async (publish: boolean) => {
    if (!file || !localOk) return;
    setError(null);
    const adminToken = getAdminToken();
    try {
      let path = uploadedPath;
      if (!path) {
        setStage("uploading");
        const slot = await createSlot({ data: { adminToken } });
        const { error: upErr } = await supabase.storage
          .from(slot.bucket)
          .uploadToSignedUrl(slot.path, slot.token, file, { contentType: "application/vnd.android.package-archive" });
        if (upErr) throw new Error(upErr.message);
        path = slot.path;
        setUploadedPath(path);
      }
      setStage(publish ? "publishing" : "verifying");
      const res = await verify({
        data: { adminToken, path, expectedSha256: expected.trim().toLowerCase(), builtByReleaseScript: attested, publish },
      });
      setServer(res);
      if (!res.passed) setUploadedPath(null); // server removed the rejected upload
      if (res.published) {
        setUploadedPath(null);
        onPublished();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /Full IT PIN/i.test(msg)
          ? t({ bn: "পূর্ণ IT PIN দিয়ে আনলক করুন।", en: "Unlock with the full IT PIN first." })
          : t({ bn: `আপলোড/যাচাই হয়নি: ${msg}`, en: `Upload or verification failed: ${msg}` }),
      );
    } finally {
      setStage("idle");
    }
  };

  const shownChecks = server?.checks ?? checks;
  const busy = stage !== "idle";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FileUp className="size-4 text-primary" />
        {t({ bn: "নতুন APK আপলোড ও যাচাই", en: "Upload & verify a new APK" })}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t({
          bn: "সংস্করণ, চেকসাম ও সাইনিং সার্টিফিকেট সব মিললে তবেই ডাউনলোড কার্ডে নতুন ফাইল আসবে। আগের রিলিজের তথ্য সংরক্ষিত থাকে। পূর্ণ IT PIN লাগবে।",
          en: "The download card only changes when version, checksum and signing certificate all pass. The previous release record is kept. Needs the full IT PIN.",
        })}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium">{t({ bn: "APK ফাইল", en: "APK file" })}</span>
          <Input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            disabled={busy}
            onChange={(e) => void pick(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium">{t({ bn: "রিলিজ রেকর্ডের SHA-256", en: "SHA-256 from the release record" })}</span>
          <Input
            value={expected}
            onChange={(e) => onExpected(e.target.value)}
            placeholder={t({ bn: ".sha256 ফাইল থেকে ৬৪ অক্ষর", en: "64 characters from the .sha256 file" })}
            className="font-mono"
            maxLength={80}
            disabled={busy}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={attested} onChange={(e) => setAttested(e.target.checked)} disabled={busy} />
        <span>
          {t({
            bn: "এই ফাইলটি সর্বশেষ কোড থেকে build-signed-apk বা \"Android official release\" দিয়ে তৈরি, এবং রিলিজ রেকর্ড আমার কাছে আছে।",
            en: "This file was built from the latest code by build-signed-apk or \"Android official release\", and I have its release record.",
          })}
        </span>
      </label>

      {local ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-muted/40 p-3 text-xs">
          <dt className="text-muted-foreground">{t({ bn: "সংস্করণ", en: "Version" })}</dt>
          <dd>{local.versionName ?? "—"} ({local.versionCode ?? "—"})</dd>
          <dt className="text-muted-foreground">{t({ bn: "প্যাকেজ", en: "Package" })}</dt>
          <dd className="break-all font-mono">{local.packageName ?? "—"}</dd>
          <dt className="text-muted-foreground">SHA-256</dt>
          <dd className="break-all font-mono">{local.sha256}</dd>
          <dt className="text-muted-foreground">{t({ bn: "সাইনার", en: "Signer" })}</dt>
          <dd className="break-all font-mono">
            {local.signerSha256s.length ? local.signerSha256s.map(formatFingerprint).join(" · ") : "—"}
          </dd>
        </dl>
      ) : null}

      {shownChecks ? (
        <ul className="space-y-1">
          {server ? (
            <li className="text-xs font-medium text-muted-foreground">
              {t({ bn: "সার্ভারের যাচাই", en: "Server verification" })}
            </li>
          ) : null}
          {shownChecks.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              {c.ok ? <CheckCircle2 className="size-3.5 text-primary" /> : <XCircle className="size-3.5 text-destructive" />}
              <span className={c.ok ? "" : "text-destructive"}>{t({ bn: c.bn, en: c.en })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {local?.problems.length ? <p className="text-xs text-destructive">{local.problems.join(" · ")}</p> : null}

      {server?.published ? (
        <p className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <ShieldCheck className="size-4 text-primary" />
          {t({
            bn: `যাচাই সম্পন্ন — ${server.file.versionName} (${server.file.versionCode}) এখন ডাউনলোড কার্ডে। সবাইকে দেওয়ার আগে একটি ফোনে Real phone test পাস করান।`,
            en: `Verified — ${server.file.versionName} (${server.file.versionCode}) is now on the download card. Pass the Real phone test on one phone before giving it to everyone.`,
          })}
        </p>
      ) : server && !server.passed ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
          {t({ bn: "সার্ভার যাচাইয়ে ফাইলটি বাতিল হয়েছে; ডাউনলোড কার্ড বদলায়নি।", en: "The server rejected this file; the download card was not changed." })}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!localOk || busy} onClick={() => void run(false)}>
          {stage === "uploading" || stage === "verifying" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {stage === "uploading"
            ? t({ bn: "আপলোড হচ্ছে…", en: "Uploading…" })
            : stage === "verifying"
              ? t({ bn: "সার্ভার যাচাই করছে…", en: "Server verifying…" })
              : t({ bn: "সার্ভারে যাচাই", en: "Verify on server" })}
        </Button>
        <Button size="sm" disabled={!server?.passed || server.published || busy} onClick={() => void run(true)}>
          {stage === "publishing" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {t({ bn: "ডাউনলোড কার্ডে দিন", en: "Put on download card" })}
        </Button>
      </div>
      {stage === "reading" ? (
        <p className="text-xs text-muted-foreground">{t({ bn: "ফাইল পড়া হচ্ছে…", en: "Reading the file…" })}</p>
      ) : null}
    </div>
  );
}
