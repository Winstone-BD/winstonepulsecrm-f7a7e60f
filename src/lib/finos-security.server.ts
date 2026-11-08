import { requireAdminToken } from "./admin-gate.server";

/** Presence-only. Never return a key, fingerprint, length or matching details. */
export function finosSecurityStatus(token: string | null, config: { secret: string | undefined; enabled: boolean }) {
  requireAdminToken(token);
  return { keyConfigured: Boolean(config.secret), enabled: config.enabled };
}