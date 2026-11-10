import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
export const Route = createFileRoute("/api/public/jobs/sheet-lead-intake")({ server: { handlers: { POST: async ({ request }) => {
  const denied = await authenticateCronRequest(request); if (denied) return denied;
  const raw = await request.text();
  if (raw.length > 256) return Response.json({ ok: false }, { status: 400 });
  try { const body = JSON.parse(raw); if (body.kind !== "new_leads" || Object.keys(body).length !== 1) throw new Error(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  try {
    const { runSheetLeadStream } = await import("@/lib/sheet-lead-stream.server");
    const dhaka = new Date(Date.now() + 6 * 3600000).toISOString();
    const result = await runSheetLeadStream(`${dhaka.slice(0,10)}:${Number(dhaka.slice(11,13)) < 12 ? "morning" : "evening"}`);
    return Response.json({ ok: true, ...result });
  } catch { return Response.json({ ok: false, code: "INTAKE_FAILED" }, { status: 502 }); }
} } } });