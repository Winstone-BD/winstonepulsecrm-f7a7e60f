import { describe, expect, it } from "vitest";
import { APPROVED_SIGNER_SHA256 } from "@/lib/apk-release";
import { apkReleaseChecks, type ApkInspection } from "@/lib/apk-verify";

const sha = "ab".repeat(32);
const good: ApkInspection = {
  sizeBytes: 19_000_000,
  sha256: sha,
  packageName: "com.winstone.connect",
  versionName: "2.22",
  versionCode: 33,
  signerSha256s: [APPROVED_SIGNER_SHA256],
  scheme: "v2",
  signatureVerified: true,
  problems: [],
};
const opts = { expectedSha256: sha, approvedSigner: APPROVED_SIGNER_SHA256, packageName: "com.winstone.connect", currentVersionCode: 32 };
const failed = (i: ApkInspection, o = opts) => apkReleaseChecks(i, o).filter((c) => !c.ok).map((c) => c.id);

describe("new APK upload checks before the download card changes", () => {
  it("a signed 2.22 (33) with the approved key and matching checksum passes every check", () => {
    expect(failed(good)).toEqual([]);
  });
  it("checksum must match the release record", () => {
    expect(failed(good, { ...opts, expectedSha256: "cd".repeat(32) })).toEqual(["checksum"]);
  });
  it("checksum match ignores case and spaces", () => {
    expect(failed(good, { ...opts, expectedSha256: `  ${sha.toUpperCase()} ` })).toEqual([]);
  });
  it("the test package is rejected", () => {
    expect(failed({ ...good, packageName: "com.winstone.connect.test" })).toEqual(["package"]);
  });
  it("same or older build than the current download is rejected", () => {
    expect(failed({ ...good, versionCode: 32 })).toEqual(["version"]);
    expect(failed({ ...good, versionCode: 14 })).toEqual(["version"]);
  });
  it("any other signing key is rejected", () => {
    expect(failed({ ...good, signerSha256s: ["00".repeat(32)] })).toEqual(["signer"]);
  });
  it("an extra second signer is rejected", () => {
    expect(failed({ ...good, signerSha256s: [APPROVED_SIGNER_SHA256, "00".repeat(32)] })).toEqual(["signer"]);
  });
  it("a file whose signature or contents do not verify is rejected", () => {
    expect(failed({ ...good, signatureVerified: false })).toEqual(["signature"]);
  });
  it("files over 60 MB are rejected", () => {
    expect(failed({ ...good, sizeBytes: 61 * 1024 * 1024 })).toEqual(["size"]);
  });
});
