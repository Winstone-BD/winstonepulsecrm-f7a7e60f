import type { Client } from "appwrite";

import { getAppwriteConfig, type AppwriteConfig } from "@/lib/appwrite-config";

/**
 * Typed Appwrite Web SDK client for the public connectivity check.
 *
 * Uses only the public endpoint + project id (never an API key or session).
 * The SDK is imported on demand so it stays out of the startup bundle and SSR;
 * call this only from browser code (effects / event handlers).
 */
export type AppwriteClientHandle = { client: Client; config: AppwriteConfig };

let cached: Promise<AppwriteClientHandle> | null = null;

export function getAppwriteClient(): Promise<AppwriteClientHandle> {
  if (!cached) {
    cached = import("appwrite")
      .then(({ Client: AppwriteClient }) => {
        const config = getAppwriteConfig();
        const client = new AppwriteClient().setEndpoint(config.endpoint).setProject(config.projectId);
        return { client, config };
      })
      .catch((err: unknown) => {
        cached = null; // allow a later retry if the SDK chunk failed to load
        throw err;
      });
  }
  return cached;
}
