/**
 * Owner-approved public signing certificate fingerprint (SHA-256) for
 * com.winstone.connect — the key that also signed v2.3. Public, not a secret.
 */
export const APPROVED_SIGNER_SHA256 = "2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d";

/**
 * The phone app file IT hands to agents (WhatsApp, pen drive, email or the
 * IT Console download). Facts below were read from the uploaded file itself
 * (v2 signature verified, one signer). Company-signed, but repackaged from the
 * 2.21-test code rather than built from the latest source with the release
 * script, so it is not yet the official release.
 */
export const APK_RELEASE = {
  bucket: "android-apk",
  file: "winstone-connect-2.21-release.apk",
  version: "2.21",
  versionCode: 32,
  packageName: "com.winstone.connect",
  sizeBytes: 19336016,
  sha256: "c5e1e5861bf384975086e6b206b17283348e3524d97ab0d5fb784942be394710",
  signerSha256: "2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d",
  server: "https://crm.winstonebd.com",
  companySigned: true,
  official: false,
  addedAt: "2026-11-01T21:20:00Z",
} as const;

/** Minutes a signed IT Console download link stays valid. */
export const APK_LINK_MINUTES = 60;
