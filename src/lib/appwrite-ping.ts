import { getAppwriteConfig, type AppwriteConfig } from "@/lib/appwrite-config";

/**
 * Real connectivity test against Appwrite using the official Web SDK's
 * `client.ping()` (GET {endpoint}/ping). No session, no API key, no data.
 * The SDK is loaded on demand so it never enters the initial bundle or SSR.
 */
export type AppwritePingFailureKind =
  | "unknown_origin"
  | "project_not_found"
  | "network"
  | "timeout"
  | "http"
  | "unexpected";

export type AppwritePingResult =
  | { ok: true; latencyMs: number; response: string; checkedAt: string; config: AppwriteConfig }
  | {
      ok: false;
      latencyMs: number;
      kind: AppwritePingFailureKind;
      code: number | null;
      type: string | null;
      message: string;
      checkedAt: string;
      config: AppwriteConfig;
    };

export const APPWRITE_PING_TIMEOUT_MS = 12_000;

type ErrLike = { name?: unknown; message?: unknown; code?: unknown; type?: unknown };

/** Map an SDK/browser error to a failure kind. Pure — unit tested. */
export function classifyAppwriteError(err: unknown): {
  kind: AppwritePingFailureKind;
  code: number | null;
  type: string | null;
  message: string;
} {
  const e = (err ?? {}) as ErrLike;
  const message = typeof e.message === "string" && e.message ? e.message.slice(0, 300) : String(err).slice(0, 300);
  const code = typeof e.code === "number" && e.code > 0 ? e.code : null;
  const type = typeof e.type === "string" && e.type ? e.type : null;
  if (e.name === "AppwritePingTimeout") return { kind: "timeout", code: null, type: null, message };
  if (type === "general_unknown_origin") return { kind: "unknown_origin", code, type, message };
  if (type === "project_not_found" || (code === 404 && /project/i.test(message))) {
    return { kind: "project_not_found", code, type, message };
  }
  if (code !== null) return { kind: "http", code, type, message };
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed|network/i.test(message)) {
    return { kind: "network", code: null, type, message };
  }
  return { kind: "unexpected", code: null, type, message };
}

/** A successful ping must be an actual response body from Appwrite ("Pong!"). */
export function isPongResponse(value: unknown): boolean {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  return /pong/i.test(text);
}

export async function pingAppwrite(): Promise<AppwritePingResult> {
  const config = getAppwriteConfig();
  const started = performance.now();
  const done = () => Math.round(performance.now() - started);
  try {
    const { Client } = await import("appwrite");
    const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const t = new Error(`No answer from Appwrite within ${APPWRITE_PING_TIMEOUT_MS / 1000}s`);
        t.name = "AppwritePingTimeout";
        reject(t);
      }, APPWRITE_PING_TIMEOUT_MS);
    });
    const response = await Promise.race([client.ping(), timeout]).finally(() => clearTimeout(timer));
    const latencyMs = done();
    const checkedAt = new Date().toISOString();
    if (!isPongResponse(response)) {
      return {
        ok: false,
        latencyMs,
        kind: "unexpected",
        code: null,
        type: null,
        message: "Appwrite answered, but not with the expected ping reply.",
        checkedAt,
        config,
      };
    }
    const text = typeof response === "string" ? response : JSON.stringify(response);
    return { ok: true, latencyMs, response: text.slice(0, 80), checkedAt, config };
  } catch (err) {
    return { ok: false, latencyMs: done(), ...classifyAppwriteError(err), checkedAt: new Date().toISOString(), config };
  }
}
