import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * HQ/IT (authority) read-only: per-phone recording readiness for every active
 * sales agent, built only from what each phone reported. No writes.
 */
export const listRecordingReadiness = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [agents, devices] = await Promise.all([
      db.from("profiles").select("id, name").eq("role", "agent").eq("is_active", true)
        .eq("approval_status", "approved").order("name").limit(500),
      db.from("agent_devices")
        .select("id, profile_id, manufacturer, model, app_version, android_version, last_seen_at, recording_mode, recording_consent, recording_consent_version, mic_permission, readiness_reported_at")
        .eq("platform", "android").is("revoked_at", null).order("last_seen_at", { ascending: false }).limit(2000),
    ]);
    if (agents.error || devices.error) throw new Error("Recording readiness unavailable; try again later");
    const { agentReadiness, deviceReadiness } = await import("@/lib/recording-readiness");
    const now = Date.now();
    const byAgent = new Map<string, NonNullable<typeof devices.data>>();
    for (const d of devices.data ?? []) {
      const list = byAgent.get(d.profile_id) ?? [];
      list.push(d);
      byAgent.set(d.profile_id, list);
    }
    const rows = (agents.data ?? []).map((a) => {
      const phones = byAgent.get(a.id) ?? [];
      return {
        agentId: a.id,
        agentName: a.name,
        status: agentReadiness(phones, now),
        phones: phones.map((p) => ({
          id: p.id,
          label: [p.manufacturer, p.model].filter(Boolean).join(" ") || "Android phone",
          appVersion: p.app_version,
          androidVersion: p.android_version,
          lastSeenAt: p.last_seen_at,
          reportedAt: p.readiness_reported_at,
          consent: p.recording_consent,
          mic: p.mic_permission,
          recorder: p.recording_mode,
          status: deviceReadiness(p, now),
        })),
      };
    });
    return { checkedAt: new Date(now).toISOString(), rows };
  });
