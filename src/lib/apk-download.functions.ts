import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { APK_LINK_MINUTES, APK_RELEASE } from "@/lib/apk-release";

/** HQ/IT PIN only: short-lived private download link for the agent phone app. Read-only. */
export const getApkDownloadLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(APK_RELEASE.bucket)
      .createSignedUrl(APK_RELEASE.file, APK_LINK_MINUTES * 60, { download: APK_RELEASE.file });
    if (error || !signed?.signedUrl) throw new Error("App file is not available right now");
    return { url: signed.signedUrl, expiresAt: new Date(Date.now() + APK_LINK_MINUTES * 60_000).toISOString() };
  });
