import type { Module } from './model';
export const PAGE_HEIGHT = 1122;
export const PAGE_WIDTH = 794;
export const CONTENT_HEIGHT = 994;
export type Row = Module[];
export function rowsFor(modules: Module[]): Row[] {
  const rows: Row[] = [];
  for (const m of modules.filter((m) => m.visible)) {
    const prev = rows.at(-1);
    if (!m.pageBreak && m.width === 'half' && prev?.length === 1 && prev[0].width === 'half')
      prev.push(m);
    else rows.push([m]);
  }
  return rows;
}
/** Never slice text across a raster page. Oversized rows are reported to the UI. */
export function paginate(rows: Row[], heights: number[], header: number, gap: number) {
  const pages: Row[][] = [[]];
  let used = header + gap;
  const oversized: string[] = [];
  rows.forEach((row, i) => {
    const h = heights[i] ?? 0;
    if (h > CONTENT_HEIGHT) oversized.push(...row.map((m) => m.title));
    if (
      (row[0].pageBreak || used + h > CONTENT_HEIGHT) &&
      (pages.at(-1)!.length > 0 || pages.length === 1)
    ) {
      pages.push([]);
      used = 0;
    }
    pages.at(-1)!.push(row);
    used += h + gap;
  });
  return { pages, oversized };
}
