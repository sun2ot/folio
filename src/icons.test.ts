import { describe, expect, it } from 'vitest';
import { icons, iconMap, iconSchema, findIcons } from './icons';
import { documentSchema, sample } from './model';
import { parseImport } from './storage';

describe('本地图标目录', () => {
  it('原有键与新增快捷键都保留，库图标有稳定名称且有对应组件', () => {
    expect(icons).toEqual(
      expect.arrayContaining([
        'none',
        'user',
        'code',
        'map',
        'pencil',
        'trend',
        'gear',
        'lucide:Microscope',
      ]),
    );
    expect(new Set(icons).size).toBe(icons.length);
    for (const icon of icons) {
      expect(iconSchema.safeParse(icon).success, icon).toBe(true);
      if (icon !== 'none') expect(iconMap[icon], icon).toBeTruthy();
    }
  });
  it('英文 key、中文常用词与多关键词检索，无结果时不回退到其他图标', () => {
    expect(findIcons(' PENCIL ')).toContain('pencil');
    expect(findIcons('trend')).toContain('trend');
    expect(findIcons('gear')).toContain('gear');
    expect(findIcons('齿轮')).toEqual(expect.arrayContaining(['gear', 'lucide:Settings']));
    expect(findIcons('科研 microscope')).toContain('lucide:Microscope');
    expect(findIcons('不存在的图标')).toEqual([]);
  });
  it('未知键与原型属性不能进入文档，扩展图标随备份无损保存', () => {
    for (const icon of [
      'constructor',
      '__proto__',
      'lucide:Unknown',
      'https://icons.test/a.svg',
      '',
      null,
    ]) {
      expect(iconSchema.safeParse(icon).success).toBe(false);
      expect(
        documentSchema.safeParse({ ...sample, modules: [{ ...sample.modules[0], icon }] }).success,
      ).toBe(false);
    }
    const doc = structuredClone(sample);
    doc.modules[0].icon = 'lucide:Microscope';
    doc.profile.fields[0].icon = 'gear';
    expect(parseImport(JSON.stringify(doc))).toEqual(doc);
  });
});
