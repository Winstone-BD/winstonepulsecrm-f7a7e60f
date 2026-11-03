import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { APK_RELEASE, APPROVED_SIGNER_SHA256 } from "@/lib/apk-release";

const INCOMING = /^incoming\/[0-9a-f-]{36}\.apk$/;

async function requireFullIt(token: string | null | undefined) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (adminTokenScope(token) !== "full") throw new Error("Full IT PIN required");
}

/** Full IT PIN: a one-time signed upload slot in the private android-apk bucket (incoming/ only). */
export const createApkUploadSlot = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().max(256).nullable() }).strict().parse(i))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `incoming/${crypto.randomUUID()}.apk`;
    const { data: slot, error } = await supabaseAdmin.storage.from(APK_RELEASE.bucket).createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Could not prepare the upload");
    return { bucket: APK_RELEASE.bucket, path, token: slot.token };
  });

const verifyInput = z
  .object({
    adminToken: z.string().max(256).nullable(),
    path: z.string().regex(INCOMING),
    expectedSha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/),
    builtByReleaseScript: z.boolean(),
    publish: z.boolean(),
  })
  .strict();

/**
 * Full IT PIN: re-read the uploaded file on the server, verify checksum,
 * package, version and signature, and — only when every check passes and
 * publish is requested — make it the IT Console download.
 */
export const verifyApkUpload = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => verifyInput.parse(i))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inspectApk, apkReleaseChecks, APK_MAX_BYTES } = await import("@/lib/apk-verify");
    const { readCurrentApkRelease, writeCurrentApkRelease } = await import("@/lib/apk-release.server");
    const bucket = supabaseAdmin.storage.from(APK_RELEASE.bucket);

    const { data: blob, error } = await bucket.download(data.path);
    if (error || !blob) throw new Error("Uploaded file not found");
    if (blob.size > APK_MAX_BYTES) {
      await bucket.remove([data.path]);
      throw new Error("File is too large");
    }
    const inspection = await inspectApk(new Uint8Array(await blob.arrayBuffer()));
    const current = await readCurrentApkRelease();
    const checks = apkReleaseChecks(inspection, {
      expectedSha256: data.expectedSha256,
      approvedSigner: APPROVED_SIGNER_SHA256,
      packageName: APK_RELEASE.packageName,
      currentVersionCode: current.versionCode,
    });
    const passed = checks.every((c) => c.ok);
    const summary = {
      versionName: inspection.versionName,
      versionCode: inspection.versionCode,
      packageName: inspection.packageName,
      sha256: inspection.sha256,
      signerSha256s: inspection.signerSha256s,
      sizeBytes: inspection.sizeBytes,
    };
    if (!passed) {
      // A rejected upload never becomes a release; drop it so it cannot be published later.
      await bucket.remove([data.path]);
      return { passed: false, published: false, checks, file: summary };
    }
    if (!data.publish) return { passed: true, published: false, checks, file: summary };

    const version = inspection.versionName as string;
    const finalPath = `releases/winstone-connect-${version.replace(/[^0-9A-Za-z.-]/g, "_")}-${inspection.versionCode}-${inspection.sha256.slice(0, 12)}.apk`;
    const { error: copyError } = await bucket.copy(data.path, finalPath);
    if (copyError && !/exists/i.test(copyError.message)) throw new Error("Could not store the release file");
    const now = new Date().toISOString();
    await writeCurrentApkRelease({
      bucket: APK_RELEASE.bucket,
      file: finalPath,
      version,
      versionName: version,
      versionCode: inspection.versionCode as number,
      packageName: inspection.packageName as string,
      sizeBytes: inspection.sizeBytes,
      sha256: inspection.sha256,
      signerSha256: inspection.signerSha256s[0] as string,
      server: APK_RELEASE.server,
      companySigned: true,
      builtByReleaseScript: data.builtByReleaseScript,
      addedAt: now,
      verifiedAt: now,
      scheme: inspection.scheme,
      source: "it_console_upload",
    });
    await bucket.remove([data.path]);
    return { passed: true, published: true, checks, file: summary };
  });
