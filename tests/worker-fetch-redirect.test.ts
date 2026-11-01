import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The live Cloudflare Worker throws on fetch({ redirect: "error" }); only "follow" and "manual" exist there.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
describe("server fetch redirect mode", () => {
  it("never uses redirect: \"error\", which the live Worker rejects", () => {
    const offenders = files("src").filter((f) => /redirect:\s*["']error["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
