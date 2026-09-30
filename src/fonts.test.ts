import { afterEach, describe, expect, it, vi } from 'vitest';
import { intersectsRange, neededFontFaces } from './fonts';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('导出字体分片按需嵌入', () => {
  it('判断 Unicode 区间与文档字符是否相交', () => {
    expect(intersectsRange('U+4E00-9FFF', '简历')).toBe(true);
    expect(intersectsRange('U+4E00-9FFF', 'Resume')).toBe(false);
    expect(intersectsRange('U+0041-005A, U+0061-007A', 'a')).toBe(true);
    // `?` 是通配位：U+00?? 覆盖 0x00-0xFF，而不是被当成字面的 0x00-0x00FF 之外的值。
    expect(intersectsRange('U+00??', 'A')).toBe(true);
    expect(intersectsRange('U+00??', 'Ā')).toBe(false);
    expect(intersectsRange('', 'A')).toBe(false);
  });
  it('只为文档中出现的字体与字符收集分片，未使用的字体不嵌入', () => {
    // jsdom 不做真实的字体回退，显式声明计算后的字体栈让断言与浏览器语义一致。
    const stacks = new Map<Element, string>([[document.body, '"Noto Sans SC", sans-serif']]);
    const root = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = '作品集';
    stacks.set(heading, '"Source Serif 4", "Noto Serif SC", serif');
    const body = document.createElement('p');
    body.textContent = 'Folio 简历';
    stacks.set(body, '"Inter", "Noto Sans SC", sans-serif');
    root.append(heading, body);
    document.body.append(root);
    // 需要拦截 window 上的实现：模块内解析的是 window.getComputedStyle。
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element: Element) =>
        ({ fontFamily: stacks.get(element) ?? '' }) as unknown as CSSStyleDeclaration,
    );
    const faces = neededFontFaces(root);
    const families = new Set(faces.map((face) => face.name));
    expect(families).toContain('Noto Sans SC');
    expect(families).toContain('Inter');
    // 标题首选 Source Serif 4，但它没有中文字形，回退到思源宋体；
    // 因此两者都不需要整套分片，只挑选与文档字符相交的分片。
    expect(families).toContain('Noto Serif SC');
    expect(families).not.toContain('Source Serif 4');
    for (const face of faces) expect(face.url).toMatch(/\.woff2$/);
    // 只嵌入实际用到的少数分片，而不是整套思源字体（四个家族共 300+ 个分片）。
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThan(20);
  });
});
