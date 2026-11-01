import { afterEach, describe, expect, it, vi } from "vitest";
import { compareWithGithub, parseGitLog, type SyncCommit } from "@/lib/github-sync-compare";

const scope = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: scope }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({
  inputValidator: (validate: (input: unknown) => unknown) => ({
    handler: (handler: (input: { data: unknown }) => unknown) => (data: unknown) => handler({ data: validate(data) }),
  }),
}) }));
import { getGithubSyncComparison } from "@/lib/github-status.functions";
const invoke = getGithubSyncComparison as unknown as (input: unknown) => Promise<unknown>;

const sha = (n: number) => n.toString(16).padStart(40, "0");
const c = (n: number): SyncCommit => ({ sha: sha(n), date: null, message: `change ${n}`, files: [] });

describe("GitHub sync comparison by exact change ID", () => {
  it("reports in sync when both latest changes match", () => {
    expect(compareWithGithub([c(3), c(2)], [c(3), c(2)]).state).toBe("in_sync");
  });
  it("lists project changes missing from GitHub", () => {
    const r = compareWithGithub([c(5), c(4), c(3)], [c(3), c(2)]);
    expect(r.state).toBe("project_ahead");
    expect(r.projectOnly.map((x) => x.sha)).toEqual([sha(5), sha(4)]);
    expect(r.commonSha).toBe(sha(3));
  });
  it("lists GitHub-only changes such as a direct upload", () => {
    const r = compareWithGithub([c(3), c(2)], [c(9), c(3)]);
    expect(r.state).toBe("github_ahead");
    expect(r.githubOnly.map((x) => x.sha)).toEqual([sha(9)]);
  });
  it("reports diverged when both sides have their own changes", () => {
    const r = compareWithGithub([c(5), c(3)], [c(9), c(3)]);
    expect(r.state).toBe("diverged");
    expect(r.projectOnly).toHaveLength(1);
    expect(r.githubOnly).toHaveLength(1);
  });
  it("never claims sync when the project list is missing", () => {
    expect(compareWithGithub(null, [c(1)]).state).toBe("project_unknown");
  });
  it("reports no shared change instead of guessing", () => {
    expect(compareWithGithub([c(5)], [c(9)]).state).toBe("no_common");
  });
  it("parses git log output and caps file names at 15", () => {
    const files = Array.from({ length: 20 }, (_, i) => `f${i}.ts`).join("\n");
    const out = parseGitLog(`\x1e${sha(1)}\x1f2026-11-01T00:00:00Z\x1fFix\n\n${files}\n\x1ebad\x1f\x1f\n`);
    expect(out).toHaveLength(1);
    expect(out[0]!.files).toHaveLength(15);
  });
});

describe("GitHub sync comparison access", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it.each([null, "hq", "leadhub"])("rejects %s scope before any GitHub read", async (value) => {
    scope.mockReturnValue(value);
    const transport = vi.fn();
    vi.stubGlobal("fetch", transport);
    await expect(invoke({ adminToken: null, repository: "trendfluxos-dev/winstonepulsecrm", branch: "main" })).rejects.toThrow("Full IT PIN required");
    expect(transport).not.toHaveBeenCalled();
  });
});
