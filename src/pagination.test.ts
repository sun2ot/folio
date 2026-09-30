import { describe, expect, it } from 'vitest';
import { createModule } from './model';
import { CONTENT_HEIGHT, paginate, rowsFor, pageGeometry, type Row } from './pagination';

describe('分页', () => {
  const make = (id: string, half = false) => ({
    ...createModule('text', id),
    width: half ? ('half' as const) : ('full' as const),
  });
  const whole = (rows: Row[], heights: number[]) =>
    rows.map((row, index) => ({
      counts: row.map(() => 1),
      height: () => heights[index],
    }));
  it('相邻半宽模块组成双栏，隐藏模块不占空间', () => {
    expect(
      rowsFor([make('a', true), make('b', true), { ...make('c'), visible: false }]).map(
        (r) => r.length,
      ),
    ).toEqual([2]);
  });
  it('分页保持行完整', () => {
    const rows = rowsFor([make('a'), make('b')]);
    const result = paginate(rows, whole(rows, [500, 400]), 160, 18);
    expect(result.pages.map((p) => p.flat().map((m) => m.id))).toEqual([['a'], ['b']]);
  });
  it('手动换页不会合并到前一双栏', () => {
    const rows = rowsFor([make('a', true), { ...make('b', true), pageBreak: true }]);
    expect(rows).toHaveLength(2);
    expect(paginate(rows, whole(rows, [100, 100]), 100, 18).pages).toHaveLength(2);
  });
  it('检测超长模块，空简历仍保留个人信息页', () => {
    const rows = rowsFor([make('a')]);
    expect(paginate(rows, whole(rows, [CONTENT_HEIGHT + 1]), 120, 18).oversized).toEqual([
      '文本框',
    ]);
    expect(paginate([], [], 100, 18).pages).toEqual([[]]);
  });
  it('在完整条目之间利用首页余量，续页不重复或跳过内容', () => {
    const module = createModule('projects', 'entries');
    const result = paginate(
      [[module]],
      [
        {
          counts: [3],
          height: (_, from, to) =>
            40 + (to - from) * 260 + (to - from - 1) * 16 + (from > 0 ? 12 : 0),
        },
      ],
      300,
      18,
    );
    expect(result.pages.map((page) => page[0][0].fragment)).toEqual([
      { from: 0, to: 2, continued: false, column: 0 },
      { from: 2, to: 3, continued: true, column: 0 },
    ]);
    expect(result.oversized).toEqual([]);
    expect(result.pages[0][0][0].entries).toBe(module.entries);
  });
  it('整模块不拆分选项仍整体换页，手动换页只应用于模块开始', () => {
    const module = { ...make('keep'), keepTogether: true };
    const measure = {
      counts: [3],
      height: (_: number, from: number, to: number) => 40 + (to - from) * 260,
    };
    const result = paginate([[module]], [measure], 300, 18);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toEqual([]);
    expect(result.pages[1][0][0].fragment).toMatchObject({ from: 0, to: 3 });
    const manual = paginate(
      [[{ ...module, keepTogether: false, pageBreak: true }]],
      [{ counts: [5], height: (_, from, to) => 40 + (to - from) * 260 }],
      100,
      18,
    );
    expect(manual.pages).toHaveLength(3);
    expect(manual.pages[0]).toEqual([]);
    expect(manual.pages[2][0][0].fragment?.continued).toBe(true);
  });
  it('双栏独立续排，只有右栏继续时保留右栏位置', () => {
    const rows = rowsFor([make('left', true), make('right', true)]);
    const result = paginate(
      rows,
      [
        {
          counts: [1, 9],
          height: (column, from, to) => (column === 0 ? 180 : 30 + (to - from) * 100),
        },
      ],
      250,
      18,
    );
    expect(result.pages[0][0].map((m) => m.fragment)).toEqual([
      { from: 0, to: 1, column: 0, continued: false },
      { from: 0, to: 6, column: 1, continued: false },
    ]);
    expect(result.pages[1][0][0].id).toBe('right');
    expect(result.pages[1][0][0].fragment).toMatchObject({
      from: 6,
      to: 9,
      column: 1,
      continued: true,
    });
  });
  it('空正文保留模块标题，单个过高内容块报错且不无限新建空页', () => {
    const result = paginate(
      [[make('empty')], [make('oversized')]],
      [
        { counts: [0], height: () => 40 },
        { counts: [2], height: (_, from, to) => (from === 0 ? (to - from) * 1100 : 100) },
      ],
      100,
      18,
    );
    expect(result.oversized).toEqual(['文本框']);
    expect(result.pages).toHaveLength(3);
    expect(result.pages[0][0][0].fragment).toMatchObject({ from: 0, to: 0 });
    expect(result.pages[2][0][0].fragment).toMatchObject({ from: 1, to: 2 });
  });
  it('边界按给定小数测量，恰好放下的片段不提前换页', () => {
    const module = make('exact');
    const result = paginate(
      [[module]],
      [{ counts: [1], height: () => CONTENT_HEIGHT - 100.25 - 18 }],
      100.25,
      18,
    );
    expect(result.pages).toHaveLength(1);
  });
  it('页脚与页码均关闭时回收预留高度，单独关闭不会占用仍显示的页脚', () => {
    expect(pageGeometry({ footerVisible: false, pageNumberVisible: false })).toEqual({
      paddingBottom: 20,
      contentHeight: 1048,
    });
    for (const [footerVisible, pageNumberVisible] of [
      [true, false],
      [false, true],
      [true, true],
    ]) {
      expect(pageGeometry({ footerVisible, pageNumberVisible })).toEqual({
        paddingBottom: 74,
        contentHeight: CONTENT_HEIGHT,
      });
    }
  });
  it('分页使用当前正文高度，无页脚时可以把下一模块放回前页', () => {
    const rows = rowsFor([make('education'), make('skills')]);
    const measures = whole(rows, [750, 145]);
    expect(paginate(rows, measures, 80, 18).pages).toHaveLength(2);
    expect(
      paginate(
        rows,
        measures,
        80,
        18,
        pageGeometry({ footerVisible: false, pageNumberVisible: false }).contentHeight,
      ).pages,
    ).toHaveLength(1);
  });
});
