import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiBase,
  avatarURL,
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
      owner: { login: 'sun2ot', id: 12345 },
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
    expect(avatarURL(repository)).toBe('https://avatars.githubusercontent.com/u/12345?s=256');
    expect(() => avatarURL({ ownerId: -1 })).toThrow();
    expect(() => avatarURL({})).toThrow();
    expect(repositorySchema.safeParse({ ...repository, ownerId: '123/evil' }).success).toBe(false);
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
      owner: { login: 'sun2ot', id: 12345 },
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
