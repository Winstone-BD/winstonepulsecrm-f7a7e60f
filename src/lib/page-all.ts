/**
 * Reads the first 1,000-row page alone, then uses bounded parallel batches
 * only when more rows exist. Stops at the first short page, keeps
 * page order, and drops rows repeated across pages (by `id`) when inserts
 * shift the ordering between reads. Any page error fails the whole read so
 * totals are never silently truncated.
 */
export const PAGE_SIZE = 1000;
export const PAGE_CONCURRENCY = 3;
const MAX_PAGES = 200;

type PageResult<T> = { data: T[] | null; error: { message: string } | null | any };

export async function pageAllParallel<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: { pageSize?: number; concurrency?: number } = {},
): Promise<{ data: T[] | null; error: any }> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const conc = Math.max(1, opts.concurrency ?? PAGE_CONCURRENCY);
  const out: T[] = [];
  const seen = new Set<unknown>();
  for (let start = 0; start < MAX_PAGES;) {
    const batchSize = Math.min(start === 0 ? 1 : conc, MAX_PAGES - start);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, (_, i) => {
        const from = (start + i) * size;
        return fetchPage(from, from + size - 1);
      }),
    );
    // Validate every fetched page before treating a short page as completion.
    const failed = batch.find(r => r.error);
    if (failed) return { data: null, error: failed.error };
    for (const r of batch) {
      const rows = r.data ?? [];
      for (const row of rows) {
        const id = (row as { id?: unknown })?.id;
        if (id !== undefined) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        out.push(row);
      }
      if (rows.length < size) return { data: out, error: null };
    }
    start += batchSize;
  }
  return { data: null, error: { message: "Read exceeded the page safety limit" } };
}
