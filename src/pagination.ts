import type { Module, Resume } from './model';
export const PAGE_HEIGHT = 1122;
export const PAGE_WIDTH = 794;
export const PAGE_TOP_PADDING = 54;
export const PAGE_BOTTOM_PADDING = 20;
export const FOOTER_RESERVE = 54;
export const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_TOP_PADDING - PAGE_BOTTOM_PADDING - FOOTER_RESERVE;
/** 页脚与页码都关闭时，正文回收预留区；保留原来的纸张边缘安全距离。 */
export function pageGeometry(
  decoration: Pick<Resume['pageDecoration'], 'footerVisible' | 'pageNumberVisible'>,
) {
  const paddingBottom =
    PAGE_BOTTOM_PADDING +
    (decoration.footerVisible || decoration.pageNumberVisible ? FOOTER_RESERVE : 0);
  return { paddingBottom, contentHeight: PAGE_HEIGHT - PAGE_TOP_PADDING - paddingBottom };
}
export type PageModule = Module & {
  fragment?: { from: number; to: number; continued: boolean; column: number };
};
export type Row = PageModule[];
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
export type ContentMeasure = {
  counts: number[];
  height: (column: number, from: number, to: number) => number;
};

/** 只依赖测量输入，在完整内容块之间分页；双栏各自续排，保持原列和文档顺序。 */
export function paginate(
  rows: Row[],
  measures: ContentMeasure[],
  header: number,
  gap: number,
  contentHeight = CONTENT_HEIGHT,
) {
  const pages: Row[][] = [[]];
  const oversized: string[] = [];
  let used = header;
  const newPage = () => {
    pages.push([]);
    used = 0;
  };
  rows.forEach((row, rowIndex) => {
    const measure = measures[rowIndex];
    const counts = row.map((_, column) => measure.counts[column]);
    const limits = row.map((item, column) =>
      item.keepTogether || !counts[column] ? 1 : counts[column],
    );
    const positions = row.map(() => 0);
    const range = (column: number, from: number, to: number) =>
      row[column].keepTogether || !counts[column] ? [0, counts[column]] : [from, to];
    if (row[0].pageBreak && (pages.length === 1 || pages.at(-1)!.length)) newPage();
    while (positions.some((from, column) => from < limits[column])) {
      const spacing = used > 0 ? gap : 0;
      const available = contentHeight - used - spacing;
      const ends = positions.map((from, column) => {
        if (from >= limits[column]) return from;
        let low = from;
        let high = limits[column];
        // 长正文用二分查找，避免每尝试多放一个条目都从头测量。
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          const [start, end] = range(column, from, middle);
          if (measure.height(column, start, end) <= available) low = middle;
          else high = middle - 1;
        }
        return low;
      });
      if (ends.every((end, column) => end === positions[column])) {
        if (used > 0) {
          newPage();
          continue;
        }
        // 单块比整页还高时仍呈现并明确阻止导出，不截掉正文或进入死循环。
        ends.forEach((_, column) => {
          if (positions[column] < limits[column]) {
            ends[column] = positions[column] + 1;
            oversized.push(row[column].title);
          }
        });
      }
      const fragments: Row = [];
      let height = 0;
      ends.forEach((end, column) => {
        if (end === positions[column]) return;
        const [from, to] = range(column, positions[column], end);
        height = Math.max(height, measure.height(column, from, to));
        fragments.push({ ...row[column], fragment: { from, to, continued: from > 0, column } });
        positions[column] = end;
      });
      pages.at(-1)!.push(fragments);
      used += spacing + height;
      if (positions.some((from, column) => from < limits[column])) newPage();
    }
  });
  return { pages, oversized: [...new Set(oversized)] };
}
