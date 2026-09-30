import { describe, expect, it } from 'vitest';
import { createModule } from './model';
import { CONTENT_HEIGHT, paginate, rowsFor } from './pagination';

describe('分页', () => {
  const make = (id: string, half = false) => ({
    ...createModule('text', id),
    width: half ? ('half' as const) : ('full' as const),
  });
  it('相邻半宽模块组成双栏，隐藏模块不占空间', () => {
    expect(
      rowsFor([make('a', true), make('b', true), { ...make('c'), visible: false }]).map(
        (r) => r.length,
      ),
    ).toEqual([2]);
  });
  it('分页保持行完整', () => {
    const rows = rowsFor([make('a'), make('b')]);
    const result = paginate(rows, [500, 400], 160, 18);
    expect(result.pages.map((p) => p.flat().map((m) => m.id))).toEqual([['a'], ['b']]);
  });
  it('手动换页不会合并到前一双栏', () => {
    const rows = rowsFor([make('a', true), { ...make('b', true), pageBreak: true }]);
    expect(rows).toHaveLength(2);
    expect(paginate(rows, [100, 100], 100, 18).pages).toHaveLength(2);
  });
  it('检测超长模块，空简历仍保留个人信息页', () => {
    expect(paginate(rowsFor([make('a')]), [CONTENT_HEIGHT + 1], 120, 18).oversized).toEqual([
      '文本框',
    ]);
    expect(paginate([], [], 100, 18).pages).toEqual([[]]);
  });
});
