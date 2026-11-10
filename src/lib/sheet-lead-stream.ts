import { z } from "zod";
export const NEW_LEADS_SHEET = "134iFJzfH8uwoAzTiEaAsyJcdtQUqwxEExBTmWiCUzA0";
export const NEW_LEADS_TAB = "New Leads";
export const NEW_LEADS_SCHEDULE = "30 3,12 * * *";
const Row = z.object({ name: z.string().trim().min(1).max(200), phoneNumber: z.string().trim().min(5).max(80), company: z.string().trim().max(300), notes: z.string().trim().max(2000) });
export function parseNewLeadGrid(grid: unknown[][]) {
  if (grid.length > 5001) throw new Error("New Leads row limit exceeded");
  const headers = grid[0]?.map(v => String(v).trim()) ?? [];
  if (["Name", "Phone", "Company", "Notes"].some((v,i) => headers[i] !== v)) throw new Error("New Leads columns changed");
  let invalid = 0;
  const rows: z.infer<typeof Row>[] = [];
  for (const values of grid.slice(1)) {
    if (!values.some(v => String(v ?? "").trim())) continue;
    const parsed = Row.safeParse({ name: String(values[0] ?? ""), phoneNumber: String(values[1] ?? ""), company: String(values[2] ?? ""), notes: String(values[3] ?? "") });
    if (parsed.success) rows.push(parsed.data); else invalid++;
  }
  return { rows, invalid };
}