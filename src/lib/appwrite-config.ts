/**
 * Public Appwrite project configuration for the IT connectivity test.
 *
 * These are public client identifiers (endpoint + project id), not credentials.
 * Never add an Appwrite API key here or anywhere in browser code. Appwrite is an
 * independent connectivity check only — the CRM's data, sign-in and workflows
 * stay on the existing backend and nothing is ever written to Appwrite.
 *
 * Optional overrides: VITE_APPWRITE_ENDPOINT / VITE_APPWRITE_PROJECT_ID.
 */
export const APPWRITE_DEFAULT_ENDPOINT = "https://sgp.cloud.appwrite.io/v1";
export const APPWRITE_DEFAULT_PROJECT_ID = "6ae998b2002b6305289c";
export const APPWRITE_PROJECT_NAME = "winstonebd";

export type AppwriteConfig = { endpoint: string; projectId: string; projectName: string };

const PROJECT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

/** Validate a candidate override; anything malformed falls back to the default. */
export function resolveAppwriteConfig(env: {
  VITE_APPWRITE_ENDPOINT?: string | undefined;
  VITE_APPWRITE_PROJECT_ID?: string | undefined;
}): AppwriteConfig {
  const rawEndpoint = env.VITE_APPWRITE_ENDPOINT?.trim();
  const rawProject = env.VITE_APPWRITE_PROJECT_ID?.trim();
  let endpoint = APPWRITE_DEFAULT_ENDPOINT;
  if (rawEndpoint) {
    try {
      const u = new URL(rawEndpoint);
      if (u.protocol === "https:") endpoint = rawEndpoint.replace(/\/+$/, "");
    } catch {
      /* keep default */
    }
  }
  const projectId = rawProject && PROJECT_ID_RE.test(rawProject) ? rawProject : APPWRITE_DEFAULT_PROJECT_ID;
  return { endpoint, projectId, projectName: APPWRITE_PROJECT_NAME };
}

export function getAppwriteConfig(): AppwriteConfig {
  return resolveAppwriteConfig({
    VITE_APPWRITE_ENDPOINT: import.meta.env["VITE_APPWRITE_ENDPOINT"] as string | undefined,
    VITE_APPWRITE_PROJECT_ID: import.meta.env["VITE_APPWRITE_PROJECT_ID"] as string | undefined,
  });
}
