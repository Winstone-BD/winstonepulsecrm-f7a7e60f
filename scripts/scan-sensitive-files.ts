/**
 * Read-only scan of tracked files and public downloads (including inside ZIPs)
 * for signing keys and secrets. Never writes, deletes or prints matched values.
 * Exit code 1 when anything is found. Run: bun scripts/scan-sensitive-files.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { checkContent, checkEnv, checkName, type Finding } from "./sensitive-scan-rules";

const MAX_TEXT = 2_000_000;
const SKIP = /(^|\/)(node_modules|\.git|dist|\.output|tests\/fixtures\/sensitive)\/|^tests\/sensitive-scan-rules\.test\.ts$/;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp[34]|webm|pdf|apk|aab|so|jar|class)$/i;

function tracked(): string[] {
  try {
    return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  } catch {
    return [];
  }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function scanBytes(label: string, bytes: Uint8Array, out: Finding[]) {
  out.push(...checkName(label));
  if (/\.zip$/i.test(label)) {
    try {
      const entries = unzipSync(bytes);
      for (const [name, data] of Object.entries(entries)) scanBytes(`${label}!${name}`, data, out);
    } catch {
      out.push({ file: label, rule: "ZIP could not be opened for inspection", severity: "medium" });
    }
    return;
  }
  if (BINARY.test(label) || bytes.length > MAX_TEXT) return;
  const text = new TextDecoder().decode(bytes);
  out.push(...checkContent(label, text), ...checkEnv(label, text));
}

const files = new Set([...tracked(), ...walk("public")]);
const findings: Finding[] = [];
let missing = 0;
for (const f of [...files].sort()) {
  if (SKIP.test(f)) continue;
  if (!existsSync(f)) { missing++; continue; }
  scanBytes(f, readFileSync(f), findings);
}

console.log(`Scanned ${files.size} files (tracked + public)${missing ? `; ${missing} tracked paths missing on disk` : ""}.`);
if (!findings.length) {
  console.log("No signing keys or secrets found.");
} else {
  for (const x of findings) console.log(`[${x.severity}] ${x.file} — ${x.rule}`);
  console.log(`${findings.length} finding(s). Nothing was changed.`);
  process.exitCode = 1;
}
