import { describe, expect, it } from 'vitest';
import {
  applyTemplate,
  createInfoField,
  createModule,
  documentSchema,
  moveModule,
  sample,
  fitPlacement,
  placementSchema,
  defaultDivider,
} from './model';
import { parseImport } from './storage';

describe('数据协议', () => {
  it('示例数据及备份无损往返', () => {
    expect(parseImport(JSON.stringify(sample))).toEqual(sample);
  });
  it('页眉、页脚和页码样式可选、独立保存，并校验颜色 / 字体 / 字号', () => {
    const styled = {
      ...sample,
      pageDecoration: {
        ...sample.pageDecoration,
        headerStyle: { color: '#7c191e', font: 'serif', size: 14 },
        footerStyle: { color: '', font: 'inter', size: 9 },
        pageNumberStyle: { color: '#003460', font: 'source', size: 30 },
      },
    };
    expect(parseImport(JSON.stringify(styled))).toEqual(styled);
    expect(applyTemplate(documentSchema.parse(styled), 'compact').pageDecoration).toEqual(
      styled.pageDecoration,
    );
    for (const key of ['headerStyle', 'footerStyle', 'pageNumberStyle']) {
      for (const style of [
        { color: 'red' },
        { font: 'remote-font' },
        { size: 8 },
        { size: 31 },
        { size: Infinity },
      ]) {
        expect(
          documentSchema.safeParse({
            ...sample,
            pageDecoration: { ...sample.pageDecoration, [key]: style },
          }).success,
        ).toBe(false);
      }
      expect(
        documentSchema.safeParse({
          ...sample,
          pageDecoration: { ...sample.pageDecoration, [key]: {} },
        }).success,
      ).toBe(true);
    }
  });
  it('分割线设置可往返、允许隐藏，切换模板保留覆盖并校验边界', () => {
    const styled = {
      ...sample,
      theme: {
        ...sample.theme,
        dividers: {
          header: { color: '#123456', width: 0 },
          section: { color: '', width: 2.5 },
          stripe: { width: 12 },
        },
      },
    };
    expect(parseImport(JSON.stringify(styled))).toEqual(styled);
    expect(applyTemplate(documentSchema.parse(styled), 'compact').theme.dividers).toEqual(
      styled.theme.dividers,
    );
    expect(defaultDivider('editorial', 'header').width).toBe(2);
    expect(defaultDivider('classic', 'header').width).toBe(1);
    expect(defaultDivider('compact', 'section').width).toBe(0);
    for (const width of [-1, 12.5, Infinity]) {
      expect(
        documentSchema.safeParse({
          ...sample,
          theme: {
            ...sample.theme,
            dividers: { header: { width } },
          },
        }).success,
      ).toBe(false);
    }
    expect(
      documentSchema.safeParse({
        ...sample,
        theme: {
          ...sample.theme,
          dividers: { footer: { color: 'red' } },
        },
      }).success,
    ).toBe(false);
  });
  it('新增颜色字段可省略，独立颜色往返并拒绝危险或不完整色值', () => {
    const styled = structuredClone(sample);
    styled.theme.titleColor = '#123456';
    styled.profile.roleColor = '#abcdef';
    styled.profile.fields[0].color = '#654321';
    expect(parseImport(JSON.stringify(styled))).toEqual(styled);
    delete styled.theme.titleColor;
    delete styled.profile.roleColor;
    delete styled.profile.fields[0].color;
    expect(parseImport(JSON.stringify(styled))).toEqual(styled);
    for (const value of ['#abc', 'red', '#123456;display:none', 'var(--accent)']) {
      expect(
        documentSchema.safeParse({
          ...sample,
          theme: { ...sample.theme, titleColor: value },
        }).success,
      ).toBe(false);
      expect(
        documentSchema.safeParse({
          ...sample,
          profile: { ...sample.profile, roleColor: value },
        }).success,
      ).toBe(false);
      expect(
        documentSchema.safeParse({
          ...sample,
          profile: { ...sample.profile, fields: [{ ...sample.profile.fields[0], color: value }] },
        }).success,
      ).toBe(false);
    }
  });
  it('拒绝未来版本、危险图片、重复 id 与字段', () => {
    expect(documentSchema.safeParse({ ...sample, version: 5 }).success).toBe(false);
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
      documentSchema.safeParse({ ...sample, theme: { ...sample.theme, textColor: 'red;}' } })
        .success,
    ).toBe(false);
  });
  it('基本信息字段可改名、换图标、增删排序，并校验重复 ID 与颜色', () => {
    const fields = sample.profile.fields;
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [{ ...fields[0], label: '任意自定义标签' }] },
      }).success,
    ).toBe(true);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [fields[0], fields[0]] },
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [{ ...fields[0], icon: 'phone' }] },
      }).success,
    ).toBe(true);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [{ ...fields[0], icon: 'nope' }] },
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [{ ...fields[0], label: '' }] },
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, fields: [{ ...fields[0], value: 'x'.repeat(201) }] },
      }).success,
    ).toBe(false);
    const custom = createInfoField({ label: '生日', icon: 'calendar' });
    expect(custom).toMatchObject({ label: '生日', icon: 'calendar', value: '' });
    expect(custom.id).toMatch(/^[\w-]{1,80}$/);
    expect(createInfoField().icon).toBe('star');
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, nameColor: '#123456' },
      }).success,
    ).toBe(true);
    expect(
      documentSchema.safeParse({
        ...sample,
        profile: { ...sample.profile, nameColor: '#12345' },
      }).success,
    ).toBe(false);
    const styled = {
      ...sample,
      modules: [
        {
          ...sample.modules[0],
          titleStyle: { font: 'sans', size: 15, color: '#2f6b4f' },
          bodyStyle: { font: 'sans', size: 12, color: 'not-a-color' },
        },
        ...sample.modules.slice(1),
      ],
    };
    expect(documentSchema.safeParse(styled).success).toBe(false);
    expect(
      documentSchema.safeParse({
        ...styled,
        modules: [
          {
            ...styled.modules[0],
            bodyStyle: { font: 'sans', size: 12, color: '' },
          },
          ...sample.modules.slice(1),
        ],
      }).success,
    ).toBe(true);
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
