/**
 * The phone app file IT hands to agents (WhatsApp, pen drive, email or the
 * IT Console download). Facts below were read from the uploaded file itself.
 * It is a TEST build (debug signer), not an official company-signed release.
 */
export const APK_RELEASE = {
  bucket: "android-apk",
  file: "winstone-connect-2.21-test.apk",
  version: "2.21-test",
  versionCode: 32,
  packageName: "com.winstone.connect.test",
  sizeBytes: 19421996,
  sha256: "d1e5162028aa7bdd670c70ffdb32183b891fd876bc039249968ca6f849c81008",
  server: "https://crm.winstonebd.com",
  official: false,
  addedAt: "2026-11-01T17:37:00Z",
} as const;

/** Minutes a signed IT Console download link stays valid. */
export const APK_LINK_MINUTES = 60;
