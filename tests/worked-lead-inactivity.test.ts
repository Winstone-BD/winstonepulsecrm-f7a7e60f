import { describe, it, expect } from "vitest";
import { inactiveBusinessDays, workedLeadWarnings, isInactivityWorkEvent, type InactivityLead } from "@/lib/worked-lead-inactivity";

const lead: InactivityLead = { id: "lead-1", name: "Lead", assigned_to: "agent-1", assigned_agent_id: "agent-1", status: "pending", work_state: "pending" };
const assigned = [{ leadId: lead.id, agentId: "agent-1", at: "2026-10-20T03:00:00Z" }];
const work = [{ leadId: lead.id, agentId: "agent-1", at: "2026-10-29T04:00:00Z" }];
describe("worked pending lead inactivity", () => {
  it("warns at exactly seven business days, not six", () => {
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-05")).toHaveLength(0);
    const alerts = workedLeadWarnings([lead], work, assigned, "2026-11-07");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.idleDays).toBe(7);
  });
  it("Friday does not add inactivity", () => {
    expect(inactiveBusinessDays(work[0].at, "2026-11-05")).toBe(6);
    expect(inactiveBusinessDays(work[0].at, "2026-11-06")).toBe(6);
  });
  it("configured holidays do not count", () => {
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-07", ["2026-11-01"])).toHaveLength(0);
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-08", ["2026-11-01"])[0]?.idleDays).toBe(7);
  });
  it("uses Dhaka date for work near midnight", () => {
    expect(inactiveBusinessDays("2026-10-28T19:00:00Z", "2026-11-07")).toBe(7);
  });
  it("new work immediately removes the warning", () => {
    expect(workedLeadWarnings([lead], [...work, { ...work[0], at: "2026-11-08T04:00:00Z" }], assigned, "2026-11-08")).toHaveLength(0);
  });
  it("does not warn untouched or nonpending leads", () => {
    expect(workedLeadWarnings([lead], [], assigned, "2026-11-08")).toHaveLength(0);
    expect(workedLeadWarnings([{ ...lead, status: "closed" }], work, assigned, "2026-11-08")).toHaveLength(0);
  });
  it("agent sees only currently owned leads, authority sees all eligible ones", () => {
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-08", [], "agent-2")).toHaveLength(0);
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-08", [], "agent-1")).toHaveLength(1);
    expect(workedLeadWarnings([lead], work, assigned, "2026-11-08")).toHaveLength(1);
  });
  it("does not blame a new owner for prior-owner work", () => {
    expect(workedLeadWarnings([{ ...lead, assigned_to: "agent-2", assigned_agent_id: "agent-2" }], work, [{ ...assigned[0], agentId: "agent-2" }], "2026-11-08")).toHaveLength(0);
  });
  it("reassignment and missing assignment trail fail closed", () => {
    expect(workedLeadWarnings([lead], work, [{ ...assigned[0], at: "2026-11-01T03:00:00Z" }], "2026-11-08")).toHaveLength(0);
    expect(workedLeadWarnings([lead], work, [], "2026-11-08")).toHaveLength(0);
  });
  it("conflicting owner columns do not expose warnings", () => {
    expect(workedLeadWarnings([{ ...lead, assigned_agent_id: "agent-2" }], work, assigned, "2026-11-08")).toHaveLength(0);
  });
  it("warning/assignment events are not new work", () => {
    expect(isInactivityWorkEvent("neglect_warning")).toBe(false);
    expect(isInactivityWorkEvent("workday_moved")).toBe(false);
    expect(isInactivityWorkEvent("outcome_logged")).toBe(true);
  });
  it("only returns warnings without changing lead or history", () => {
    const before = JSON.stringify({ lead, work, assigned });
    const first = workedLeadWarnings([lead], work, assigned, "2026-11-08");
    expect(first[0]?.id).toBe(workedLeadWarnings([lead], work, assigned, "2026-11-08")[0]?.id);
    expect(JSON.stringify({ lead, work, assigned })).toBe(before);
  });
});