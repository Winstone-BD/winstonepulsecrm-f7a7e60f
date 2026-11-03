import { APK_RELEASE, type ApkRelease } from "@/lib/apk-release";

/** system_settings key holding the release IT verified in the console; absent → built-in APK_RELEASE. */
export const APK_RELEASE_SETTING = "android_apk_release";

export type StoredApkRelease = ApkRelease & {
  versionName?: string;
  verifiedAt?: string;
  scheme?: string | null;
  source?: "it_console_upload";
};

function isRelease(v: unknown): v is StoredApkRelease {
  const r = v as StoredApkRelease | null;
  return Boolean(r && typeof r.file === "string" && typeof r.sha256 === "string" && typeof r.versionCode === "number");
}

export async function readCurrentApkRelease(): Promise<StoredApkRelease> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("system_settings").select("value").eq("key", APK_RELEASE_SETTING).maybeSingle();
  if (error) throw new Error("Could not read the app release");
  return isRelease(data?.value) ? data.value : APK_RELEASE;
}

/** Replace the current release, first saving the previous one as a verified history row (never deleted). */
export async function writeCurrentApkRelease(next: StoredApkRelease): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const previous = await readCurrentApkRelease();
  const historyKey = `${APK_RELEASE_SETTING}_history:${new Date().toISOString()}`;
  const { error: backupError } = await supabaseAdmin.from("system_settings").insert({ key: historyKey, value: previous as never });
  if (backupError) throw new Error("Could not back up the previous release");
  const { data: backup, error: readError } = await supabaseAdmin.from("system_settings").select("value").eq("key", historyKey).single();
  if (readError || !isRelease(backup?.value) || backup.value.sha256 !== previous.sha256) throw new Error("Backup check failed");
  const { error } = await supabaseAdmin
    .from("system_settings")
    .upsert({ key: APK_RELEASE_SETTING, value: next as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Could not save the new release");
}
