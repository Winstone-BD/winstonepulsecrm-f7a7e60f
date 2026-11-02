import { describe, expect, it } from "vitest";
import { diagnosticsCsvCell } from "@/lib/load-diagnostics";

describe("diagnostics CSV formula neutralisation", () => {
  it.each([
    "=HYPERLINK(\"http://x\")",
    "+1+cmd",
    "-2+3",
    "@SUM(A1)",
    "  =cmd|' /C calc'!A0",
    "\t=1",
    "\n=1",
    "＝1+1",
    "＠SUM(A1)",
  ])("prefixes %j so it is read as text", (v) => {
    const cell = diagnosticsCsvCell(v);
    expect(cell.startsWith(`"'`)).toBe(true);
  });

  it("leaves ordinary messages unchanged and quotes embedded quotes", () => {
    expect(diagnosticsCsvCell("Failed to fetch \"chunk\"")).toBe(`"Failed to fetch ""chunk"""`);
    expect(diagnosticsCsvCell(null)).toBe(`""`);
    expect(diagnosticsCsvCell(42)).toBe(`"42"`);
  });
});
