/**
 * Pure comparison of the project's own change list (captured when this version
 * was built) with the commits on a GitHub branch. No network, no secrets.
 * Commit SHAs are compared exactly; nothing is inferred from dates or messages.
 */
export type SyncCommit = { sha: string; date: string | null; message: string; files: string[] };

export type SyncState =
  | "in_sync" // both sides end at the same change
  | "project_ahead" // project changes are not on GitHub yet
  | "github_ahead" // GitHub has changes the project does not have
  | "diverged" // both sides have changes the other lacks
  | "no_common" // no shared change inside the compared window
  | "project_unknown"; // this build carries no project change list

export type SyncComparison = {
  state: SyncState;
  commonSha: string | null;
  projectOnly: SyncCommit[];
  githubOnly: SyncCommit[];
  projectHead: string | null;
  githubHead: string | null;
};

const MAX_FILES = 15;

/** Parse `git log --format=%x1e%H%x1f%cI%x1f%s --name-only` output. */
export function parseGitLog(raw: string, limit = 40): SyncCommit[] {
  return raw
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, limit)
    .flatMap((block) => {
      const [header = "", ...rest] = block.split("\n");
      const [sha = "", date = "", message = ""] = header.split("\x1f");
      if (!/^[a-f0-9]{40}$/.test(sha)) return [];
      const files = rest.map((l) => l.trim()).filter(Boolean);
      return [{ sha, date: date || null, message: message.slice(0, 160), files: files.slice(0, MAX_FILES) }];
    });
}

/** Both lists are newest-first. */
export function compareWithGithub(project: SyncCommit[] | null, github: SyncCommit[]): SyncComparison {
  const githubHead = github[0]?.sha ?? null;
  if (!project || project.length === 0) {
    return { state: "project_unknown", commonSha: null, projectOnly: [], githubOnly: [], projectHead: null, githubHead };
  }
  const projectHead = project[0]!.sha;
  const githubShas = new Set(github.map((c) => c.sha));
  const projectShas = new Set(project.map((c) => c.sha));
  const commonIndex = project.findIndex((c) => githubShas.has(c.sha));
  if (commonIndex === -1) {
    return { state: "no_common", commonSha: null, projectOnly: project, githubOnly: github, projectHead, githubHead };
  }
  const commonSha = project[commonIndex]!.sha;
  const projectOnly = project.slice(0, commonIndex);
  const githubCut = github.findIndex((c) => projectShas.has(c.sha));
  const githubOnly = githubCut === -1 ? github : github.slice(0, githubCut);
  const state: SyncState =
    projectOnly.length === 0 && githubOnly.length === 0 ? "in_sync"
    : githubOnly.length === 0 ? "project_ahead"
    : projectOnly.length === 0 ? "github_ahead"
    : "diverged";
  return { state, commonSha, projectOnly, githubOnly, projectHead, githubHead };
}

/** Comparisons older than this are flagged as stale in the IT Console. */
export const SYNC_STALE_MINUTES = 10;

/** Pure: how old a check is; unknown/invalid times are never "fresh". */
export function checkAge(checkedAt: string | null, now: number): { minutes: number | null; stale: boolean } {
  const at = checkedAt ? Date.parse(checkedAt) : NaN;
  if (Number.isNaN(at)) return { minutes: null, stale: true };
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  return { minutes, stale: minutes >= SYNC_STALE_MINUTES };
}
