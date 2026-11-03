import type { AppwritePingResult } from "@/lib/appwrite-ping";

/**
 * One Appwrite `client.ping()` per app startup (page load).
 *
 * The first call starts the ping; every later call — re-renders, route changes,
 * React StrictMode double effects — reuses the same promise, so a page load
 * sends at most one startup request. Never throws: any failure (including the
 * SDK failing to load) resolves to a failed result so startup is never blocked.
 * Must be called from a browser effect, never at module scope or during SSR.
 */
type State = { status: "idle" } | { status: "running" } | { status: "done"; result: AppwritePingResult };

let state: State = { status: "idle" };
let startup: Promise<AppwritePingResult | null> | null = null;
let requests = 0;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

export function runAppwriteStartupPing(
  ping: () => Promise<AppwritePingResult> = async () => (await import("@/lib/appwrite-ping")).pingAppwrite(),
): Promise<AppwritePingResult | null> {
  if (startup) return startup;
  if (typeof window === "undefined") return Promise.resolve(null);
  requests += 1;
  set({ status: "running" });
  startup = Promise.resolve()
    .then(ping)
    .then((result) => {
      set({ status: "done", result });
      return result;
    })
    .catch(() => {
      // pingAppwrite already converts errors to results; this only covers a
      // failed chunk load. Startup stays healthy either way.
      set({ status: "idle" });
      return null;
    });
  return startup;
}

export function getAppwriteStartupState(): State {
  return state;
}

export function subscribeAppwriteStartup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How many startup pings this page load has sent (0 or 1). */
export function appwriteStartupRequestCount(): number {
  return requests;
}

/** Test-only reset. */
export function __resetAppwriteStartupForTests() {
  state = { status: "idle" };
  startup = null;
  requests = 0;
  listeners.clear();
}
