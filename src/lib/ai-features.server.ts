/**
 * Winstone AI features: lead call-order suggestion, follow-up message drafts
 * and the HQ daily team summary. Every feature only proposes — the agent or
 * HQ confirms before anything is saved or sent. The AI never writes to the
 * database and never invents facts: prompts forbid it and answers are
 * filtered back to known record ids.
 */
import { aiChatJson } from "@/lib/ai-model.server";

export type RankedLead = { leadId: string; name: string; reason: string };

const COMMON = `You are "Winstone AI", the assistant inside Winstone Pulse, a real-estate sales CRM in Bangladesh.
Rules:
- Use only the data given to you. Never invent names, numbers, prices or facts.
- Money is Bangladeshi Taka (৳).
- Reply with strict JSON only, matching the requested shape.`;

/** Ranks an agent's open leads by likelihood to close, with a one-line reason each. */
export async function leadPriorityForAgent(agentId: string): Promise<{ items: RankedLead[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, company, status, notes, updated_at")
    .eq("assigned_to", agentId)
    .in("status", ["pending", "contacted", "follow_up"])
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  if (!leads?.length) return { items: [] };

  const evidence = leads.map((l) => ({
    lead_id: l.id,
    name: l.name,
    company: l.company,
    status: l.status,
    notes: (l.notes ?? "").slice(0, 200),
    last_touched: l.updated_at,
  }));

  const out = await aiChatJson<{ ranked?: { lead_id?: string; reason?: string }[] }>({
    system: `${COMMON}
Task: rank these sales leads by likelihood to close soon. Consider status, recency and notes.
Return at most 5, best first: {"ranked":[{"lead_id":"...","reason":"one short sentence"}]}`,
    user: JSON.stringify(evidence),
  });

  const known = new Map(leads.map((l) => [l.id, l.name] as const));
  const items: RankedLead[] = [];
  for (const row of out.ranked ?? []) {
    const id = row.lead_id ?? "";
    const name = known.get(id);
    if (!name || items.some((i) => i.leadId === id)) continue;
    items.push({ leadId: id, name, reason: (row.reason ?? "").trim() || "Suggested by AI" });
    if (items.length >= 5) break;
  }
  return { items };
}

/** Drafts a short follow-up message for one lead. The agent edits and sends it themselves. */
export async function draftLeadMessage(
  leadId: string,
  agentId: string,
  lang: "bn" | "en",
): Promise<{ draft: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, company, status, notes, assigned_to")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || lead.assigned_to !== agentId) throw new Error("This lead is not assigned to you");

  const { data: lastReport } = await supabaseAdmin
    .from("call_reports")
    .select("summary, note, category, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const evidence = {
    lead: {
      name: lead.name,
      company: lead.company,
      status: lead.status,
      notes: (lead.notes ?? "").slice(0, 300),
    },
    last_call: lastReport
      ? {
          summary: (lastReport.summary ?? "").slice(0, 300),
          note: (lastReport.note ?? "").slice(0, 300),
          at: lastReport.created_at,
        }
      : null,
  };

  const out = await aiChatJson<{ draft?: string }>({
    system: `${COMMON}
Task: write a short, polite WhatsApp follow-up message from the sales agent to this lead.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Maximum 4 sentences, no pressure tactics, no invented offers or prices.
Return: {"draft":"..."}`,
    user: JSON.stringify(evidence),
  });
  const draft = (out.draft ?? "").trim();
  if (!draft) throw new Error("The AI could not draft a message — please retry");
  return { draft };
}

export type TeamDayStats = {
  agent: string;
  reports: number;
  connected: number;
  talkMinutes: number;
};

/** HQ daily team summary: today's call activity per agent, summarised by AI. */
export async function teamDailySummary(
  lang: "bn" | "en",
): Promise<{ summary: string; stats: TeamDayStats[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { dhakaToday } = await import("@/lib/lead-pool.server");
  const today = dhakaToday();

  const since = `${today}T00:00:00+06:00`;
  const { data: reports, error } = await supabaseAdmin
    .from("call_reports")
    .select("agent_id, connected, duration_seconds, category, interest, summary")
    .gte("created_at", since)
    .limit(5000);
  if (error) throw new Error(error.message);

  const { data: fuEvents, error: fuErr } = await supabaseAdmin
    .from("follow_up_events")
    .select("agent_id, status, category, priority, customer_response, next_action, scheduled_at")
    .or(`created_at.gte.${since},scheduled_at.gte.${since}`)
    .lte("scheduled_at", `${today}T23:59:59+06:00`)
    .limit(2000);
  if (fuErr) throw new Error(fuErr.message);

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name");
  const names = new Map((profiles ?? []).map((p) => [p.id, p.name] as const));

  const byAgent = new Map<string, TeamDayStats>();
  const detail = new Map<
    string,
    { categories: Record<string, number>; interest: Record<string, number>; samples: string[]; followUps: Record<string, number>; nextActions: string[] }
  >();
  const d = (key: string) => {
    let v = detail.get(key);
    if (!v) {
      v = { categories: {}, interest: {}, samples: [], followUps: {}, nextActions: [] };
      detail.set(key, v);
    }
    return v;
  };
  const statRow = (key: string) =>
    byAgent.get(key) ??
    ({ agent: names.get(key) ?? "Unknown", reports: 0, connected: 0, talkMinutes: 0 } as TeamDayStats);

  for (const r of reports ?? []) {
    const key = r.agent_id ?? "unknown";
    const row = statRow(key);
    row.reports += 1;
    if (r.connected) row.connected += 1;
    row.talkMinutes += Math.round((r.duration_seconds ?? 0) / 60);
    byAgent.set(key, row);
    const x = d(key);
    if (r.category) x.categories[r.category] = (x.categories[r.category] ?? 0) + 1;
    if (r.interest) x.interest[r.interest] = (x.interest[r.interest] ?? 0) + 1;
    const s = (r.summary ?? "").trim();
    if (s && x.samples.length < 3) x.samples.push(s.slice(0, 160));
  }
  for (const f of fuEvents ?? []) {
    const key = f.agent_id ?? "unknown";
    if (!byAgent.has(key)) byAgent.set(key, statRow(key));
    const x = d(key);
    x.followUps[f.status] = (x.followUps[f.status] ?? 0) + 1;
    const n = (f.next_action ?? "").trim();
    if (n && x.nextActions.length < 3) x.nextActions.push(n.slice(0, 120));
  }
  const stats = [...byAgent.values()].sort((a, b) => b.reports - a.reports);
  if (!stats.length) return { summary: "", stats: [] };

  const evidence = [...byAgent.entries()].map(([key, s]) => {
    const x = d(key);
    return {
      agent: s.agent,
      call_reports: s.reports,
      connected: s.connected,
      talk_minutes: s.talkMinutes,
      report_categories: x.categories,
      customer_interest: x.interest,
      report_summaries: x.samples,
      follow_ups_today_by_status: x.followUps,
      follow_up_next_actions: x.nextActions,
    };
  });

  const out = await aiChatJson<{ summary?: string }>({
    system: `${COMMON}
Task: summarise today's sales-floor activity for the HQ authority, using ONLY the call reports and follow-up events provided.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Every number you mention must appear in the data. Do not guess reasons, deals, prices or customers not in the data.
- If something is not in the data, do not mention it.
- Maximum 6 short lines: overall picture, standout agent, who may need support (e.g. overdue/pending follow-ups), one coaching note drawn from the report summaries.
Return: {"summary":"..."}`,
    user: JSON.stringify({ date: today, agents: evidence }),
  });
  const summary = (out.summary ?? "").trim();
  if (!summary) throw new Error("The AI could not summarise today — please retry");
  return { summary, stats };
}

const clip = (s: string | null | undefined, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Call report assistant: turns the agent's rough note into a clean short note. Agent reviews before saving. */
export async function tidyReportNote(raw: string, lang: "bn" | "en"): Promise<{ note: string }> {
  const text = clip(raw, 1500);
  if (text.length < 5) throw new Error(lang === "bn" ? "আগে কয়েকটি কথা লিখুন বা বলুন" : "Write or speak a few words first");
  const out = await aiChatJson<{ note?: string }>({
    system: `${COMMON}
Task: rewrite the sales agent's rough call note into a clean, short call note.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Keep only what the agent wrote. Do not add budgets, projects, dates, promises or customer feelings that are not in the note.
- Remove filler words and repetition. At most 3 short sentences.
- Never include phone numbers.
Return: {"note":"..."}`,
    user: JSON.stringify({ rough_note: text }),
  });
  const note = clip(out.note, 600).replace(/\+?\d[\d\s-]{8,}\d/g, "").trim();
  if (!note) throw new Error(lang === "bn" ? "নোট সাজানো যায়নি — আবার চেষ্টা করুন" : "Could not tidy the note — please retry");
  return { note };
}

/** Next-step suggestion for one owned lead, from its own saved history only. */
export async function leadNextStep(leadId: string, agentId: string, lang: "bn" | "en"): Promise<{ nextStep: string; opener: string; basedOn: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads").select("id, status, notes, assigned_to").eq("id", leadId).maybeSingle();
  if (error) throw new Error("Lead unavailable");
  if (!lead || lead.assigned_to !== agentId) throw new Error("This lead is not assigned to you");
  const { data: reports, error: rErr } = await supabaseAdmin
    .from("call_reports").select("summary, note, category, connected, created_at")
    .eq("lead_id", leadId).not("submitted_at", "is", null)
    .order("created_at", { ascending: false }).limit(3);
  if (rErr) throw new Error("Lead history unavailable");
  const history = (reports ?? []).map((r) => ({
    at: r.created_at, category: r.category, connected: r.connected,
    summary: clip(r.summary, 300), note: clip(r.note, 300),
  }));
  const out = await aiChatJson<{ next_step?: string; opener?: string }>({
    system: `${COMMON}
Task: suggest the single best next action for this property lead and one opening line for the next call.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Base it only on the lead status, notes and past call reports given. If there is no history, suggest a polite first call.
- No invented projects, prices, offers or deadlines. No pressure tactics.
- next_step: one sentence. opener: one friendly sentence the agent can say.
Return: {"next_step":"...","opener":"..."}`,
    user: JSON.stringify({ status: lead.status, notes: clip(lead.notes, 400), past_calls: history }),
  });
  const nextStep = clip(out.next_step, 300);
  const opener = clip(out.opener, 300);
  if (!nextStep) throw new Error(lang === "bn" ? "পরামর্শ পাওয়া যায়নি — আবার চেষ্টা করুন" : "No suggestion — please retry");
  return { nextStep, opener, basedOn: history.length };
}

/** Plain-words explanation of one day's call-log match counts (aggregates only) for HQ / IT. */
export async function callLogMatchInsights(day: string, lang: "bn" | "en"): Promise<{ summary: string; actions: string[] }> {
  const { readCallLogMatchSummary } = await import("@/lib/call-log-match-summary.server");
  const { team, agents } = await readCallLogMatchSummary(day);
  const active = agents.filter((a) => a.matched + a.noAnswer + a.notMatched + a.noPhoneLog + a.failureTotal > 0);
  if (!active.length) {
    return { summary: lang === "bn" ? "এই দিনে কোনো কল সেভ হয়নি, তাই ব্যাখ্যা করার কিছু নেই।" : "No calls were saved on this day, so there is nothing to explain.", actions: [] };
  }
  const out = await aiChatJson<{ summary?: string; actions?: string[] }>({
    system: `${COMMON}
Task: explain a day's phone call-log match counts to the CRM's IT / HQ team in plain words.
Meaning of counts: matched = phone call log proved real talk; noAnswer = call log shows the call but nobody talked; notMatched = phone call not yet confirmed by the call log (often an old app or missing call-log permission); noPhoneLog = web-dialled call, no phone proof possible; failures = phone could not send data, by reason.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Use only the numbers given. Do not blame anyone; describe patterns and likely technical causes.
- summary: at most 3 sentences. actions: at most 3 short practical checks (e.g. update the app, check call-log permission, check internet).
Return: {"summary":"...","actions":["..."]}`,
    user: JSON.stringify({ day, team, agents: active.map(({ agentId: _id, ...rest }) => rest) }),
  });
  const summary = clip(out.summary, 700);
  if (!summary) throw new Error(lang === "bn" ? "ব্যাখ্যা পাওয়া যায়নি — আবার চেষ্টা করুন" : "No explanation — please retry");
  return { summary, actions: (Array.isArray(out.actions) ? out.actions : []).map((a) => clip(String(a), 200)).filter(Boolean).slice(0, 3) };
}
