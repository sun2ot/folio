import { afterEach, describe, expect, it, vi } from 'vitest';
import { intersectsRange, neededFontFaces } from './fonts';
import {
  apiBase,
  repositoryKey,
  repositorySchema,
  requestRepositories,
  toRepository,
} from './repository';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('GitHub 仓库标识与卡片数据', () => {
  it('只接受 https 的 github.com 仓库地址或 owner/name', () => {
    expect(repositoryKey('sun2ot/folio')).toBe('sun2ot/folio');
    expect(repositoryKey(' https://github.com/sun2ot/folio/ ')).toBe('sun2ot/folio');
    expect(repositoryKey('https://github.com/sun2ot/folio.git')).toBe('sun2ot/folio');
    expect(repositoryKey('https://gist.github.com/sun2ot/1')).toBeNull();
    expect(repositoryKey('https://github.com/sun2ot/folio/issues')).toBeNull();
    expect(repositoryKey('http://github.com/sun2ot/folio')).toBeNull();
    expect(repositoryKey('git@github.com:sun2ot/folio.git')).toBeNull();
    expect(repositoryKey('https://evil.test/github.com/sun2ot/folio')).toBeNull();
    expect(repositoryKey('javascript:alert(1)')).toBeNull();
  });
  it('把 API 响应收敛成卡片字段并拒绝异常结构', () => {
    const repository = toRepository({
      owner: { login: 'sun2ot' },
      name: 'folio',
      description: null,
      stargazers_count: 12,
      forks_count: 2,
      language: null,
    });
    expect(repository).toMatchObject({ owner: 'sun2ot', name: 'folio', description: '' });
    expect(repository.stars).toBe(12);
    expect(repository.language).toBe('');
    expect(repository.fetchedAt).toEqual(expect.any(String));
    expect(repositorySchema.safeParse({ ...repository, stars: -1 }).success).toBe(false);
    expect(repositorySchema.safeParse({ ...repository, owner: 'bad owner' }).success).toBe(false);
    expect(() => toRepository({ name: 'folio' })).toThrow();
  });
  it('代理只接受干净的 HTTPS 根地址', () => {
    expect(apiBase('')).toBe('https://api.github.com/');
    expect(apiBase('https://gh.example.com/api/')).toBe('https://gh.example.com/api/');
    expect(() => apiBase('http://gh.example.com/')).toThrow();
    expect(() => apiBase('https://user:pass@gh.example.com/')).toThrow();
    expect(() => apiBase('https://gh.example.com/?token=1')).toThrow();
  });
  it('离线快照读取失败不缓存失败状态，可再次尝试', async () => {
    const { bundledRepositories } = await import('./repository');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    await expect(bundledRepositories()).rejects.toThrow('离线仓库快照读取失败');
    await expect(bundledRepositories()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('联网请求使用仓库路径，并在受限或输入非法时给出可操作提示', async () => {
    const payload = {
      owner: { login: 'sun2ot' },
      name: 'folio',
      description: null,
      stargazers_count: 3,
      forks_count: 0,
      language: 'TypeScript',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    const [repository] = await requestRepositories(
      'sun2ot/folio',
      'https://gh.example.com/',
      new AbortController().signal,
    );
    expect(repository.name).toBe('folio');
    expect(fetchMock.mock.calls[0][0]).toBe('https://gh.example.com/repos/sun2ot/folio');
    await expect(requestRepositories('folio', '', new AbortController().signal)).rejects.toThrow(
      'GitHub 请求受限',
    );
    await expect(requestRepositories('', '', new AbortController().signal)).rejects.toThrow(
      '请输入仓库地址',
    );
    await expect(
      requestRepositories('x'.repeat(201), '', new AbortController().signal),
    ).rejects.toThrow('200 字以内');
  });
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
