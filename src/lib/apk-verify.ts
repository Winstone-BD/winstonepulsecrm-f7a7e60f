/**
 * Pure APK inspection (browser + Worker, no Node APIs): file SHA-256, the
 * manifest's package/versionName/versionCode, and the APK Signature Scheme
 * v3/v2 signer — with the signature and whole-file content digest actually
 * verified, so a copied certificate cannot pass as the company key.
 */

export const APK_MAX_BYTES = 60 * 1024 * 1024;

export type ApkInspection = {
  sizeBytes: number;
  sha256: string;
  packageName: string | null;
  versionName: string | null;
  versionCode: number | null;
  /** SHA-256 of each distinct signer certificate (DER), lowercase hex. */
  signerSha256s: string[];
  scheme: "v3" | "v2" | null;
  /** Signature over signed data and the chunked content digest both verified. */
  signatureVerified: boolean;
  problems: string[];
};

const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

const sha = async (alg: "SHA-256" | "SHA-512", data: Uint8Array) =>
  new Uint8Array(await crypto.subtle.digest(alg, data as BufferSource));

class Reader {
  constructor(public b: Uint8Array, public view = new DataView(b.buffer, b.byteOffset, b.byteLength)) {}
  u16(o: number) { return this.view.getUint16(o, true); }
  u32(o: number) { return this.view.getUint32(o, true); }
  u64(o: number) {
    const lo = this.view.getUint32(o, true);
    const hi = this.view.getUint32(o + 4, true);
    return hi * 2 ** 32 + lo;
  }
}

/** Split a uint32-length-prefixed sequence into its items. */
function lpSeq(b: Uint8Array): Uint8Array[] {
  const r = new Reader(b);
  const out: Uint8Array[] = [];
  let o = 0;
  while (o < b.length) {
    if (o + 4 > b.length) throw new Error("bad length prefix");
    const n = r.u32(o);
    if (o + 4 + n > b.length) throw new Error("bad length prefix");
    out.push(b.subarray(o + 4, o + 4 + n));
    o += 4 + n;
  }
  return out;
}

/** Read one uint32-length-prefixed item at offset; returns [item, nextOffset]. */
function lpAt(b: Uint8Array, o: number): [Uint8Array, number] {
  const n = new Reader(b).u32(o);
  if (o + 4 + n > b.length) throw new Error("bad length prefix");
  return [b.subarray(o + 4, o + 4 + n), o + 4 + n];
}

type Zip = { cdOffset: number; cdSize: number; eocdOffset: number };

function findZip(b: Uint8Array): Zip {
  const r = new Reader(b);
  const min = Math.max(0, b.length - 22 - 65535);
  for (let o = b.length - 22; o >= min; o--) {
    if (r.u32(o) === 0x06054b50) {
      return { cdOffset: r.u32(o + 16), cdSize: r.u32(o + 12), eocdOffset: o };
    }
  }
  throw new Error("Not a ZIP/APK file");
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(b: Uint8Array, zip: Zip, name: string): Promise<Uint8Array | null> {
  const r = new Reader(b);
  let o = zip.cdOffset;
  const end = zip.cdOffset + zip.cdSize;
  const dec = new TextDecoder();
  while (o + 46 <= end && r.u32(o) === 0x02014b50) {
    const method = r.u16(o + 10);
    const comp = r.u32(o + 20);
    const nl = r.u16(o + 28), el = r.u16(o + 30), cl = r.u16(o + 32);
    const local = r.u32(o + 42);
    const entryName = dec.decode(b.subarray(o + 46, o + 46 + nl));
    if (entryName === name) {
      if (r.u32(local) !== 0x04034b50) throw new Error("bad local header");
      const start = local + 30 + r.u16(local + 26) + r.u16(local + 28);
      const data = b.subarray(start, start + comp);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error("unsupported compression");
    }
    o += 46 + nl + el + cl;
  }
  return null;
}

// ---- Binary AndroidManifest.xml ----

const ATTR_VERSION_CODE = 0x0101021b;
const ATTR_VERSION_NAME = 0x0101021c;

function parseManifest(x: Uint8Array): { packageName: string | null; versionName: string | null; versionCode: number | null } {
  const r = new Reader(x);
  let strings: string[] = [];
  let resIds: number[] = [];
  let o = r.u16(2); // skip XML header
  while (o + 8 <= x.length) {
    const type = r.u16(o), headerSize = r.u16(o + 2), size = r.u32(o + 4);
    if (size < 8) break;
    if (type === 0x0001) strings = readStringPool(x, o);
    else if (type === 0x0180) {
      resIds = [];
      for (let i = o + 8; i < o + size; i += 4) resIds.push(r.u32(i));
    } else if (type === 0x0102) {
      const name = strings[r.u32(o + 20)];
      if (name === "manifest") {
        const attrStart = r.u16(o + 24), attrSize = r.u16(o + 26), count = r.u16(o + 28);
        const base = o + headerSize + attrStart; // attrStart is relative to the element extension
        const res = { packageName: null as string | null, versionName: null as string | null, versionCode: null as number | null };
        for (let i = 0; i < count; i++) {
          const a = base + i * attrSize;
          const ni = r.u32(a + 4);
          const n = strings[ni] ?? "";
          const id = resIds[ni];
          const raw = r.u32(a + 8);
          const dataType = x[a + 15] ?? 0;
          const data = r.u32(a + 16);
          const str = raw !== 0xffffffff ? strings[raw] ?? null : dataType === 0x03 ? strings[data] ?? null : null;
          if (n === "package") res.packageName = str;
          else if (n === "versionCode" || id === ATTR_VERSION_CODE) res.versionCode = dataType >= 0x10 && dataType <= 0x1f ? data : str ? Number(str) : null;
          else if (n === "versionName" || id === ATTR_VERSION_NAME) res.versionName = str;
        }
        return res;
      }
    }
    o += size;
  }
  return { packageName: null, versionName: null, versionCode: null };
}

function readStringPool(x: Uint8Array, o: number): string[] {
  const r = new Reader(x);
  const headerSize = r.u16(o + 2);
  const count = r.u32(o + 8);
  const flags = r.u32(o + 16);
  const stringsStart = r.u32(o + 20);
  const utf8 = (flags & 0x100) !== 0;
  const out: string[] = [];
  const dec8 = new TextDecoder("utf-8");
  const dec16 = new TextDecoder("utf-16le");
  for (let i = 0; i < count; i++) {
    let p = o + stringsStart + r.u32(o + headerSize + i * 4);
    if (utf8) {
      p += (x[p] ?? 0) & 0x80 ? 2 : 1; // utf-16 length
      let len = x[p] ?? 0;
      if (len & 0x80) { len = ((len & 0x7f) << 8) | (x[p + 1] ?? 0); p += 2; } else p += 1;
      out.push(dec8.decode(x.subarray(p, p + len)));
    } else {
      let len = r.u16(p);
      if (len & 0x8000) { len = ((len & 0x7fff) << 16) | r.u16(p + 2); p += 4; } else p += 2;
      out.push(dec16.decode(x.subarray(p, p + len * 2)));
    }
  }
  return out;
}

// ---- APK Signature Scheme v2 / v3 ----

const BLOCK_V2 = 0x7109871a;
const BLOCK_V3 = 0xf05368c0;
const MAGIC = "APK Sig Block 42";

type Alg = { digest: "SHA-256" | "SHA-512"; kind: "rsa" | "pss" | "ec" };
const ALGS: Record<number, Alg> = {
  0x0101: { digest: "SHA-256", kind: "pss" },
  0x0102: { digest: "SHA-512", kind: "pss" },
  0x0103: { digest: "SHA-256", kind: "rsa" },
  0x0104: { digest: "SHA-512", kind: "rsa" },
  0x0201: { digest: "SHA-256", kind: "ec" },
  0x0202: { digest: "SHA-512", kind: "ec" },
};

function findSigningBlock(b: Uint8Array, zip: Zip): { start: number; pairs: Map<number, Uint8Array> } | null {
  const end = zip.cdOffset;
  if (end < 32) return null;
  if (new TextDecoder().decode(b.subarray(end - 16, end)) !== MAGIC) return null;
  const r = new Reader(b);
  const size = r.u64(end - 24);
  const start = end - size - 8;
  if (start < 0 || r.u64(start) !== size) throw new Error("bad signing block");
  const pairs = new Map<number, Uint8Array>();
  let o = start + 8;
  while (o < end - 24) {
    const len = r.u64(o);
    const id = r.u32(o + 8);
    pairs.set(id, b.subarray(o + 12, o + 8 + len));
    o += 8 + len;
  }
  return { start, pairs };
}

/** DER ECDSA signature → raw r||s for WebCrypto. */
function derToRaw(sig: Uint8Array, size: number): Uint8Array {
  let o = 2;
  const l1 = sig[1] ?? 0;
  if (l1 & 0x80) o = 2 + (l1 & 0x7f);
  const int = () => {
    if (sig[o] !== 0x02) throw new Error("bad ECDSA signature");
    const len = sig[o + 1] ?? 0;
    let v = sig.subarray(o + 2, o + 2 + len);
    o += 2 + len;
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  const rr = int(), ss = int();
  const out = new Uint8Array(size * 2);
  out.set(rr); out.set(ss, size);
  return out;
}

async function verifySig(alg: Alg, spki: Uint8Array, sig: Uint8Array, data: Uint8Array): Promise<boolean> {
  const key = spki as BufferSource;
  if (alg.kind === "ec") {
    for (const curve of ["P-256", "P-384", "P-521"] as const) {
      try {
        const k = await crypto.subtle.importKey("spki", key, { name: "ECDSA", namedCurve: curve }, false, ["verify"]);
        const size = curve === "P-256" ? 32 : curve === "P-384" ? 48 : 66;
        return await crypto.subtle.verify({ name: "ECDSA", hash: alg.digest }, k, derToRaw(sig, size) as BufferSource, data as BufferSource);
      } catch { /* try next curve */ }
    }
    return false;
  }
  const name = alg.kind === "pss" ? "RSA-PSS" : "RSASSA-PKCS1-v1_5";
  const k = await crypto.subtle.importKey("spki", key, { name, hash: alg.digest }, false, ["verify"]);
  const params = alg.kind === "pss" ? { name, saltLength: alg.digest === "SHA-256" ? 32 : 64 } : { name };
  return crypto.subtle.verify(params, k, sig as BufferSource, data as BufferSource);
}

/** The v2/v3 chunked content digest over everything except the signing block. */
async function contentDigest(b: Uint8Array, zip: Zip, blockStart: number, digest: "SHA-256" | "SHA-512"): Promise<Uint8Array> {
  const eocd = b.slice(zip.eocdOffset);
  new DataView(eocd.buffer).setUint32(16, blockStart, true); // cd offset as if no signing block
  const sections = [b.subarray(0, blockStart), b.subarray(zip.cdOffset, zip.cdOffset + zip.cdSize), eocd];
  const CHUNK = 1024 * 1024;
  const chunkDigests: Uint8Array[] = [];
  for (const s of sections) {
    for (let o = 0; o < s.length; o += CHUNK) {
      const part = s.subarray(o, Math.min(o + CHUNK, s.length));
      const buf = new Uint8Array(5 + part.length);
      buf[0] = 0xa5;
      new DataView(buf.buffer).setUint32(1, part.length, true);
      buf.set(part, 5);
      chunkDigests.push(await sha(digest, buf));
    }
  }
  const dl = chunkDigests[0]?.length ?? (digest === "SHA-256" ? 32 : 64);
  const top = new Uint8Array(5 + chunkDigests.length * dl);
  top[0] = 0x5a;
  new DataView(top.buffer).setUint32(1, chunkDigests.length, true);
  chunkDigests.forEach((d, i) => top.set(d, 5 + i * dl));
  return sha(digest, top);
}

const includes = (hay: Uint8Array, needle: Uint8Array) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

async function verifySigners(b: Uint8Array, zip: Zip, block: { start: number; pairs: Map<number, Uint8Array> }, problems: string[]) {
  const v3 = block.pairs.get(BLOCK_V3);
  const v2 = block.pairs.get(BLOCK_V2);
  const scheme = v3 ? "v3" : v2 ? "v2" : null;
  const value = v3 ?? v2;
  if (!scheme || !value) {
    problems.push("No APK Signature Scheme v2/v3 block");
    return { scheme: null, certs: [] as string[], ok: false };
  }
  const certs = new Set<string>();
  let ok = true;
  const signers = lpSeq(lpAt(value, 0)[0]);
  if (signers.length === 0) { problems.push("No signers"); ok = false; }
  for (const signer of signers) {
    let o = 0;
    const [signedData, n1] = lpAt(signer, o); o = n1;
    if (scheme === "v3") o += 8; // minSdk, maxSdk
    const [sigsBytes, n2] = lpAt(signer, o); o = n2;
    const [pubKey] = lpAt(signer, o);

    let p = 0;
    const [digestsBytes, d1] = lpAt(signedData, p); p = d1;
    const [certsBytes] = lpAt(signedData, p);
    const certList = lpSeq(certsBytes);
    if (certList.length === 0) { problems.push("Signer has no certificate"); ok = false; continue; }
    certs.add(hex(await sha("SHA-256", certList[0])));
    if (!includes(certList[0], pubKey)) { problems.push("Signer public key does not match its certificate"); ok = false; }

    const digests = new Map<number, Uint8Array>();
    for (const d of lpSeq(digestsBytes)) digests.set(new Reader(d).u32(0), lpAt(d, 4)[0]);

    let verifiedOne = false;
    for (const s of lpSeq(sigsBytes)) {
      const algId = new Reader(s).u32(0);
      const alg = ALGS[algId];
      if (!alg) continue;
      const sig = lpAt(s, 4)[0];
      if (!(await verifySig(alg, pubKey, sig, signedData))) { problems.push("Signature does not verify"); ok = false; continue; }
      const expected = digests.get(algId);
      if (!expected) { problems.push("Signed digest missing"); ok = false; continue; }
      const actual = await contentDigest(b, zip, block.start, alg.digest);
      if (hex(actual) !== hex(expected)) { problems.push("File contents changed after signing"); ok = false; continue; }
      verifiedOne = true;
      break;
    }
    if (!verifiedOne) { ok = false; if (!problems.length) problems.push("No supported signature algorithm"); }
  }
  return { scheme, certs: [...certs], ok };
}

export async function inspectApk(input: Uint8Array): Promise<ApkInspection> {
  const problems: string[] = [];
  const result: ApkInspection = {
    sizeBytes: input.length,
    sha256: hex(await sha("SHA-256", input)),
    packageName: null,
    versionName: null,
    versionCode: null,
    signerSha256s: [],
    scheme: null,
    signatureVerified: false,
    problems,
  };
  try {
    const zip = findZip(input);
    const manifest = await readEntry(input, zip, "AndroidManifest.xml");
    if (!manifest) problems.push("AndroidManifest.xml missing");
    else Object.assign(result, parseManifest(manifest));
    const block = findSigningBlock(input, zip);
    if (!block) problems.push("No APK Signing Block (v1-only or unsigned)");
    else {
      const s = await verifySigners(input, zip, block, problems);
      result.scheme = s.scheme;
      result.signerSha256s = s.certs;
      result.signatureVerified = s.ok;
    }
  } catch (err) {
    problems.push(err instanceof Error ? err.message : "Could not read the file");
  }
  return result;
}

export type ApkCheck = { id: string; ok: boolean; en: string; bn: string };

/** Every rule a new APK must pass before it can replace the IT Console download. */
export function apkReleaseChecks(
  i: ApkInspection,
  opts: { expectedSha256: string; approvedSigner: string; packageName: string; currentVersionCode: number },
): ApkCheck[] {
  const expected = opts.expectedSha256.trim().toLowerCase();
  return [
    {
      id: "size",
      ok: i.sizeBytes > 0 && i.sizeBytes <= APK_MAX_BYTES,
      en: `File size within ${APK_MAX_BYTES / 1024 / 1024} MB`,
      bn: `ফাইলের আকার ${APK_MAX_BYTES / 1024 / 1024} MB-এর মধ্যে`,
    },
    {
      id: "checksum",
      ok: /^[a-f0-9]{64}$/.test(expected) && expected === i.sha256,
      en: "SHA-256 matches the release record",
      bn: "SHA-256 রিলিজ রেকর্ডের সাথে মিলেছে",
    },
    {
      id: "package",
      ok: i.packageName === opts.packageName,
      en: `Package is ${opts.packageName}`,
      bn: `প্যাকেজ ${opts.packageName}`,
    },
    {
      id: "version",
      ok: i.versionCode !== null && i.versionCode > opts.currentVersionCode && Boolean(i.versionName),
      en: `Newer than the current download (build ${opts.currentVersionCode})`,
      bn: `বর্তমান ডাউনলোডের (বিল্ড ${opts.currentVersionCode}) চেয়ে নতুন`,
    },
    {
      id: "signature",
      ok: i.signatureVerified,
      en: "Signature and file contents verified",
      bn: "স্বাক্ষর ও ফাইলের বিষয়বস্তু যাচাই হয়েছে",
    },
    {
      id: "signer",
      ok: i.signerSha256s.length === 1 && i.signerSha256s[0] === opts.approvedSigner,
      en: "Signed only by the approved company key",
      bn: "শুধু অনুমোদিত কোম্পানি কী দিয়ে সাইন করা",
    },
  ];
}
