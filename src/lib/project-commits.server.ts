import type { SyncCommit } from "@/lib/github-sync-compare";

declare const __PROJECT_COMMITS__: SyncCommit[] | null | undefined;
declare const __BUILD_STAMP__: string | undefined;

/**
 * The project's latest changes, captured from its own history when this version
 * was built. Server-only so commit details never ship in the browser bundle.
 */
export function projectCommits(): { commits: SyncCommit[] | null; capturedAt: string | null } {
  const commits = typeof __PROJECT_COMMITS__ !== "undefined" && Array.isArray(__PROJECT_COMMITS__) ? __PROJECT_COMMITS__ : null;
  const capturedAt = typeof __BUILD_STAMP__ === "string" ? __BUILD_STAMP__ : null;
  return { commits, capturedAt };
}
