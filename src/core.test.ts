import { describe, expect, it } from 'vitest';
import { markdown } from './markdown';
import {
  applyTemplate,
  createModule,
  documentSchema,
  moveModule,
  sample,
  fitPlacement,
  placementSchema,
} from './model';
import { CONTENT_HEIGHT, paginate, rowsFor } from './pagination';
import { parseImport } from './storage';

describe('安全 Markdown 与组合格式', () => {
  it('保留嵌套的加粗、斜体、高亮与行内代码', () => {
    expect(markdown('**==*成果*==**')).toContain('<strong><mark><em>成果</em></mark></strong>');
    expect(markdown('**`React`**')).toContain('<strong><code>React</code></strong>');
    expect(markdown('`==literal==`')).toContain('<code>==literal==</code>');
  });
  it('移除脚本、事件属性、远程图片和危险链接', () => {
    const html = markdown(
      '<script>alert(1)</script><img src="https://evil.test/a" onerror="alert(1)"><a href="javascript:alert(1)" style="color:red">link</a>',
    );
    expect(html).not.toMatch(/script|onerror|<img|style=/);
    expect(html).toContain('<a>link</a>');
  });
  it('多层有序和无序列表', () => {
    const html = markdown('1. 工作\n   - 子项\n   - 子项二\n2. 教育');
    expect(html).toContain('<ol>');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(4);
  });
});
describe('数据协议', () => {
  it('示例数据及备份无损往返', () => {
    expect(parseImport(JSON.stringify(sample))).toEqual(sample);
  });
  it('拒绝未来版本、危险图片、重复 id 与字段', () => {
    expect(documentSchema.safeParse({ ...sample, version: 3 }).success).toBe(false);
    expect(documentSchema.safeParse({ ...sample, version: 1 }).success).toBe(false);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, photo: 'https://evil.test/image.png' },
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...sample, modules: [sample.modules[0], sample.modules[0]] })
        .success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...sample, theme: { ...sample.theme, accent: 'red;}' } }).success,
    ).toBe(false);
  });
  it('切换模板保留全部内容，拖动只改变顺序', () => {
    const next = applyTemplate(sample, 'compact');
    expect(next.modules.map((m) => m.body)).toEqual(sample.modules.map((m) => m.body));
    expect(next.profile).toEqual(sample.profile);
    expect(next.media).toEqual(sample.media);
    expect(next.pageDecoration).toEqual(sample.pageDecoration);
    expect(next.modules.map((m) => m.entries)).toEqual(sample.modules.map((m) => m.entries));
    expect(moveModule(sample.modules, 'summary', 'projects').map((m) => m.id)).toEqual([
      'experience',
      'projects',
      'summary',
      'education',
      'skills',
    ]);
    expect(sample.modules[0].id).toBe('summary');
  });
  it('限制图片边界、页码与大小，拒绝远程二维码及旧组件', () => {
    const p = sample.media.photo;
    expect(placementSchema.safeParse({ ...p, left: 790 }).success).toBe(false);
    expect(placementSchema.safeParse({ ...p, page: 0 }).success).toBe(false);
    expect(fitPlacement({ ...p, left: -100, top: 1200, size: 400 })).toMatchObject({
      left: 0,
      top: 822,
      size: 300,
    });
    expect(
      documentSchema.safeParse({
        ...sample,
        media: { ...sample.media, qr: { ...sample.media.qr, image: 'https://example.test/a.png' } },
      }).success,
    ).toBe(false);
    for (const kind of ['qr', 'ordered', 'unordered', 'nested']) {
      expect(
        documentSchema.safeParse({ ...sample, modules: [{ ...sample.modules[0], kind }] }).success,
      ).toBe(false);
    }
  });
  it('结构化条目独立保存并校验重复 ID 和文本正文边界', () => {
    const module = createModule('education', 'new-school');
    expect(module.entries).toHaveLength(1);
    expect(
      documentSchema.safeParse({
        ...sample,
        modules: [{ ...module, entries: [module.entries[0], module.entries[0]] }],
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...sample, modules: [{ ...module, body: '不应隐藏的正文' }] })
        .success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...sample,
        modules: [{ ...module, entries: [{ ...module.entries[0], body: 'x'.repeat(30001) }] }],
      }).success,
    ).toBe(false);
  });
});
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
