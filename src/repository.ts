import { z } from 'zod';

const owner = z.string().regex(/^[a-z\d][a-z\d-]{0,38}$/i);
const name = z
  .string()
  .regex(/^[a-z\d_.-]{1,100}$/i)
  .refine((s) => s !== '.' && s !== '..');
const ownerId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** 卡片只保存本地 PNG/JPEG/WebP 副本，避免远程地址进入简历数据。 */
const image = z
  .string()
  .max(600_000)
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    '头像必须是本地图片',
  );
export const repositorySchema = z.object({
  owner,
  ownerId: ownerId.optional(),
  name,
  description: z.string().max(1000),
  stars: z.number().int().min(0).max(1_000_000_000).nullable(),
  forks: z.number().int().min(0).max(1_000_000_000).nullable(),
  language: z.string().max(100),
  /** 作者头像的本地副本；联网抓取一次后随卡片离线保存。 */
  avatar: image,
  fetchedAt: z.iso.datetime().nullable(),
});
export type Repository = z.infer<typeof repositorySchema>;
export const repositoryAPI = z.object({
  owner: z.object({ login: owner, id: ownerId }),
  name,
  description: z.string().max(1000).nullable(),
  stargazers_count: z.number().int().nonnegative(),
  forks_count: z.number().int().nonnegative(),
  language: z.string().max(100).nullable(),
});
export function toRepository(value: unknown): Repository {
  const data = repositoryAPI.parse(value);
  return repositorySchema.parse({
    owner: data.owner.login,
    ownerId: data.owner.id,
    name: data.name,
    description: data.description || '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language || '',
    avatar: '',
    fetchedAt: new Date().toISOString(),
  });
}
export function repositoryKey(input: string): string | null {
  let key = input.trim();
  if (/^https?:/i.test(key)) {
    try {
      const url = new URL(key);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        return null;
      key = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch {
      return null;
    }
  }
  key = key.replace(/\.git$/, '');
  const parts = key.split('/');
  return parts.length === 2 && owner.safeParse(parts[0]).success && name.safeParse(parts[1]).success
    ? parts.join('/')
    : null;
}
export function repositoryURL(repo: Pick<Repository, 'owner' | 'name'>) {
  return `https://github.com/${repo.owner}/${repo.name}`;
}
/** 使用 API 校验后的作者 ID，避免用户名重定向与任意远程 URL 进入抓取路径。 */
export function avatarURL(repo: Pick<Repository, 'ownerId'>) {
  return `https://avatars.githubusercontent.com/u/${ownerId.parse(repo.ownerId)}?s=256`;
}
export function apiBase(proxy: string) {
  if (!proxy) return 'https://api.github.com/';
  const url = new URL(proxy);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('代理地址必须为不含密码、参数的 HTTPS 地址');
  return url.href.replace(/\/?$/, '/');
}
export async function requestRepositories(
  query: string,
  proxy: string,
  signal: AbortSignal,
): Promise<Repository[]> {
  const key = repositoryKey(query);
  if (!query.trim() || query.length > 200)
    throw new Error('请输入仓库地址、用户名/仓库名或 200 字以内的关键词');
  if (!key && /:\/\//.test(query))
    throw new Error(
      '只支持 https://github.com/用户名/仓库名；镜像或自建代理请在下方“允许联网”后填写代理根地址',
    );
  const path = key
    ? `repos/${key}`
    : `search/repositories?q=${encodeURIComponent(query.trim())}&per_page=5`;
  const response = await fetch(apiBase(proxy) + path, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? 'GitHub 请求受限，请稍后重试或使用离线快照'
        : response.status === 404
          ? '未找到公开仓库'
          : `仓库读取失败（${response.status}）`,
    );
  const text = await response.text();
  if (text.length > 500_000) throw new Error('仓库响应过大');
  const data: unknown = JSON.parse(text);
  return key
    ? [toRepository(data)]
    : z
        .object({ items: z.array(repositoryAPI).max(5) })
        .parse(data)
        .items.map(toRepository);
}
let bundled: Promise<Repository[]> | undefined;
export function bundledRepositories() {
  bundled ??= fetch(`${import.meta.env.BASE_URL}github-repos.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error('离线仓库快照读取失败');
      return z
        .array(repositorySchema)
        .max(50)
        .parse(await response.json());
    })
    .catch((error) => {
      bundled = undefined;
      throw error;
    });
  return bundled;
}
