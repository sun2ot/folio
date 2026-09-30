import { describe, expect, it } from 'vitest';
import { createModule, documentSchema, sample, applyTemplate, moveModule } from './model';
import { parseImport } from './storage';
import { createResearch, researchSchema, researchURL } from './research';

describe('科研卡片', () => {
  it('DOI 与解析器地址归一化，普通 URL 保留路径、查询和片段', () => {
    for (const input of [
      '10.1234/example.1',
      ' doi: 10.1234/example.1 ',
      'https://doi.org/10.1234/example.1',
      'http://dx.doi.org/10.1234/example.1',
    ]) {
      expect(researchURL(input)).toBe('https://doi.org/10.1234/example.1');
    }
    expect(researchURL('10.1234/a(b)/c?d#e')).toBe('https://doi.org/10.1234/a(b)/c%3Fd%23e');
    expect(researchURL('https://doi.org/10.1234/c%3Fd%23e')).toBe(
      'https://doi.org/10.1234/c%3Fd%23e',
    );
    expect(researchURL('https://example.test/paper?id=1#abstract')).toBe(
      'https://example.test/paper?id=1#abstract',
    );
    expect(researchURL('http://example.test/paper')).toBe('http://example.test/paper');
  });
  it('拒绝脚本、凭据、非网页协议、控制字符及不完整 DOI', () => {
    for (const input of [
      '',
      'javascript:alert(1)',
      'data:text/html,test',
      'file:///tmp/test',
      '//example.test/paper',
      'https://user:secret@example.test/paper',
      'https://doi.org/invalid',
      'https://doi.org/10.1234/test?redirect=1',
      'https://doi.org/10.1234/%ZZ',
      '10.123/test',
      '10.1234/',
      'https://exa\nmple.test',
      '10.1234/a b',
    ]) {
      expect(researchURL(input), input).toBeNull();
      if (input)
        expect(researchSchema.safeParse({ ...createResearch(), link: input }).success, input).toBe(
          false,
        );
    }
  });
  it('四种成果与自定义标签可无损备份、排序与切换模板，省略科研卡片仍接受 v4', () => {
    const projects = createModule('projects', 'research-projects');
    projects.entries[0].research = {
      ...createResearch(),
      visible: true,
      kind: 'paper-en',
      title: 'Local-first Research · 本地研究',
      venue: 'Example Research Conference',
      authorOrder: '共同第一作者（1/5）',
      level: 'SCI Q1（JCR） · CCF-A',
      status: 'proofreading',
      openSource: 'open',
      link: '10.1234/example.1',
    };
    const doc = documentSchema.parse({ ...sample, modules: [projects, sample.modules[0]] });
    expect(parseImport(JSON.stringify(doc))).toEqual(doc);
    for (const template of ['editorial', 'classic', 'compact'] as const) {
      expect(applyTemplate(doc, template).modules[0].entries).toEqual(projects.entries);
    }
    expect(moveModule(doc.modules, projects.id, 'summary')[1].entries).toEqual(projects.entries);
    for (const kind of ['paper-en', 'paper-zh', 'fund', 'patent'] as const) {
      expect(researchSchema.parse({ ...projects.entries[0].research, kind }).kind).toBe(kind);
    }
    delete projects.entries[0].research;
    expect(
      parseImport(JSON.stringify({ ...sample, modules: [projects] })).modules[0].entries[0]
        .research,
    ).toBeUndefined();
  });
  it('校验长度与枚举边界，空值不强制显示开源、状态或链接', () => {
    const card = createResearch();
    expect(researchSchema.parse(card)).toEqual(card);
    for (const [field, max] of [
      ['title', 500],
      ['venue', 200],
      ['authorOrder', 200],
      ['level', 100],
    ] as const) {
      expect(researchSchema.safeParse({ ...card, [field]: '文'.repeat(max) }).success).toBe(true);
      expect(researchSchema.safeParse({ ...card, [field]: '文'.repeat(max + 1) }).success).toBe(
        false,
      );
    }
    for (const patch of [
      { kind: 'book' },
      { status: 'unknown' },
      { openSource: true },
      { link: 'https://example.test/' + 'a'.repeat(2000) },
    ]) {
      const projects = createModule('projects');
      expect(
        documentSchema.safeParse({
          ...sample,
          modules: [
            { ...projects, entries: [{ ...projects.entries[0], research: { ...card, ...patch } }] },
          ],
        }).success,
      ).toBe(false);
    }
  });
});
