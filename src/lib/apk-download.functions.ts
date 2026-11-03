import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { APK_LINK_MINUTES } from "@/lib/apk-release";

const tokenInput = z.object({ adminToken: z.string().max(256).nullable().optional() });

const fileName = (path: string) => path.split("/").pop() ?? path;

/** HQ/IT PIN only: short-lived private download link for the agent phone app. Read-only. */
export const getApkDownloadLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenInput.parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { readCurrentApkRelease } = await import("@/lib/apk-release.server");
    const release = await readCurrentApkRelease();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(release.bucket)
      .createSignedUrl(release.file, APK_LINK_MINUTES * 60, { download: fileName(release.file) });
    if (error || !signed?.signedUrl) throw new Error("App file is not available right now");
    return { url: signed.signedUrl, expiresAt: new Date(Date.now() + APK_LINK_MINUTES * 60_000).toISOString() };
  });

/** HQ/IT PIN only: the facts of the file currently offered in the IT Console download. */
export const getCurrentApkRelease = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenInput.parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { readCurrentApkRelease } = await import("@/lib/apk-release.server");
    return readCurrentApkRelease();
  });
