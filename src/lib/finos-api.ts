import { z } from "zod";
import { FINOS_PROJECT_ID } from "./finos-access";
import { hmacHex } from "./os-bridge";

export const FINOS_API_PATH = "/api/public/finos/summary";
export const finosSummaryInput = z.object({
  summaryType: z.enum(["financial", "work"]),
  from: z.string().date(), to: z.string().date(),
}).strict().refine((v) => {
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
  return days >= 0 && days < 31;
}, { message: "Choose at most 31 inclusive Dhaka days" });
export type FinosSummaryInput = z.infer<typeof finosSummaryInput>;

export function finosDateBounds(input: FinosSummaryInput) {
  return {
    start: new Date(`${input.from}T00:00:00+06:00`).toISOString(),
    end: new Date(Date.parse(`${input.to}T00:00:00+06:00`) + 86400000).toISOString(),
  };
}

/** Dedicated FinOS key only; OS bridge, agent tokens and browser sessions cannot authorize this API. */
export async function verifyFinosSignature(secret: string, request: Request, body: string, now = Date.now()) {
  const project = request.headers.get("x-finos-project");
  const stamp = request.headers.get("x-finos-timestamp");
  const signature = request.headers.get("x-finos-signature");
  if (project !== FINOS_PROJECT_ID || !stamp || !/^\d{10}$/.test(stamp) || Math.abs(now / 1000 - Number(stamp)) > 300) return false;
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${await hmacHex(secret, `POST\n${FINOS_API_PATH}\n${project}\n${stamp}\n${body}`)}`;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}