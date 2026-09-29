import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Github } from 'lucide-react';
import {
  avatarURL,
  bundledRepositories,
  repositoryKey,
  repositoryURL,
  requestRepositories,
  type Repository,
} from './repository';
import { fetchAvatar } from './storage';
import type { Entry } from './model';

export function RepositoryEditor({
  value,
  onChange,
}: {
  value: Entry['github'];
  onChange: (value: Entry['github']) => void;
}) {
  const [query, setQuery] = useState(
    value.snapshot ? `${value.snapshot.owner}/${value.snapshot.name}` : '',
  );
  const [online, setOnline] = useState(false),
    [useProxy, setUseProxy] = useState(false),
    [proxy, setProxy] = useState('');
  const [results, setResults] = useState<Repository[]>([]),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  function cancel() {
    active.current?.abort();
    active.current = null;
    setPending(false);
    setResults([]);
    setMessage('');
  }
  /** 头像只抓取一次并转成 data URL，之后卡片、备份与导出都离线可用。 */
  async function save(snapshot: Repository, note: string) {
    setResults([]);
    setMessage('正在保存卡片…');
    try {
      onChange({
        visible: true,
        snapshot: { ...snapshot, avatar: await fetchAvatar(avatarURL(snapshot)) },
      });
      setMessage(note);
    } catch {
      onChange({ visible: true, snapshot: { ...snapshot, avatar: '' } });
      setMessage(`${note}（作者头像未取到，已回退为图标）`);
    }
  }
  async function search(local: boolean) {
    cancel();
    const request = new AbortController();
    active.current = request;
    setPending(true);
    try {
      const rows = local
        ? (await bundledRepositories()).filter((repo) =>
            `${repo.owner}/${repo.name} ${repo.description}`
              .toLowerCase()
              .includes((repositoryKey(query) || query).trim().toLowerCase()),
          )
        : await requestRepositories(
            query,
            useProxy ? proxy : '',
            AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
          );
      if (request.signal.aborted) return;
      setResults(rows);
      setMessage(
        rows.length ? '选择仓库后保存为离线卡片。' : '没有匹配仓库，可手动填写或开启联网搜索。',
      );
    } catch (error) {
      if (!request.signal.aborted)
        setMessage(
          error instanceof Error && error.name !== 'TimeoutError'
            ? error.message
            : '请求超时，请检查网络或使用离线快照',
        );
    } finally {
      if (active.current === request) {
        active.current = null;
        setPending(false);
      }
    }
  }
  const help =
    '联网搜索 / 刷新必须能访问 GitHub API，只发送仓库标识或搜索关键词，不会上传简历内容。加速方式：① 用下方“自定义 API 代理”填写可信的 GitHub 镜像或反向代理根地址；② 直接点“读取离线仓库快照”，使用构建时预取的公开仓库；③ 手动填写名称、简介和 Star。卡片一旦保存就变为离线数据，预览、备份和导出都不再联网，Star 只是快照值。';
  return (
    <details className="repository-editor" open={value.visible || undefined}>
      <summary>
        <Github size={16} aria-hidden="true" /> GitHub 仓库卡片
      </summary>
      <label className="check-field">
        <input
          type="checkbox"
          checked={value.visible}
          onChange={(e) => {
            cancel();
            onChange({ ...value, visible: e.target.checked });
          }}
        />
        显示仓库卡片
      </label>
      {value.visible && (
        <>
          <label className="field">
            <span>GitHub 链接 / 用户名/仓库名 / 关键词</span>
            <input
              maxLength={200}
              value={query}
              placeholder="sun2ot/folio"
              onChange={(e) => {
                cancel();
                setQuery(e.target.value);
              }}
            />
          </label>
          <div className="repository-options">
            <label className="check-field">
              <input
                type="checkbox"
                checked={online}
                onChange={(e) => {
                  cancel();
                  setOnline(e.target.checked);
                }}
              />
              允许联网搜索 / 刷新
            </label>
            <span className="help-tip" tabIndex={0} aria-label={help}>
              <CircleHelp size={16} />
              <span role="tooltip">{help}</span>
            </span>
          </div>
          {online && (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={useProxy}
                  onChange={(e) => {
                    cancel();
                    setUseProxy(e.target.checked);
                  }}
                />
                使用自定义 API 代理
              </label>
              {useProxy && (
                <label className="field">
                  <span>HTTPS 代理根地址</span>
                  <input
                    type="url"
                    value={proxy}
                    maxLength={300}
                    placeholder="https://你的代理域名/github/"
                    onChange={(e) => {
                      cancel();
                      setProxy(e.target.value);
                    }}
                  />
                  <span className="hint">
                    用于国内网络加速，需兼容 GitHub REST API 并允许跨域；只要根地址，不要带 token
                    或查询参数。仅使用你信任的代理，它会收到仓库标识和关键词。本设置不会进入简历备份。
                  </span>
                </label>
              )}
            </>
          )}
          <div className="entry-actions">
            <button
              className="small-button"
              disabled={!online || pending || (useProxy && !proxy)}
              onClick={() => void search(false)}
            >
              搜索 / 刷新仓库
            </button>
            <button className="small-button" disabled={pending} onClick={() => void search(true)}>
              读取离线仓库快照
            </button>
            <button
              className="small-button"
              onClick={() => {
                cancel();
                const key = repositoryKey(query);
                if (!key)
                  return setMessage('离线填写请先输入完整的 GitHub 仓库地址或用户名/仓库名');
                const [owner, name] = key.split('/');
                void save(
                  {
                    owner,
                    name,
                    description: '',
                    stars: null,
                    forks: null,
                    language: '',
                    avatar: '',
                    fetchedAt: null,
                  },
                  '卡片已保存，可离线预览和导出。',
                );
              }}
            >
              手动填写卡片
            </button>
          </div>
          {(pending || message) && (
            <p className="hint" role="status">
              {pending ? '正在读取仓库…' : message}
            </p>
          )}
          <div className="repository-results">
            {results.map((repo) => (
              <button
                className="repository-result"
                key={repositoryURL(repo)}
                onClick={() => void save(repo, '仓库卡片已保存，可离线预览和导出。')}
              >
                <strong>
                  {repo.owner}/{repo.name}
                </strong>
                <span>{repo.description}</span>
                <span>★ {repo.stars ?? '—'}</span>
              </button>
            ))}
          </div>
          {value.snapshot && (
            <>
              <p className="hint repository-summary">
                {value.snapshot.avatar ? (
                  <img className="repository-avatar" src={value.snapshot.avatar} alt="" />
                ) : (
                  <Github size={14} aria-hidden="true" />
                )}
                {value.snapshot.owner}/{value.snapshot.name} ·{' '}
                {value.snapshot.fetchedAt
                  ? `快照：${value.snapshot.fetchedAt.slice(0, 10)}`
                  : '手动填写'}
              </p>
              <label className="field">
                <span>仓库简介</span>
                <textarea
                  maxLength={1000}
                  value={value.snapshot.description}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      snapshot: { ...value.snapshot!, description: e.target.value },
                    })
                  }
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Star 数（留空不显示）</span>
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    value={value.snapshot.stars ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        snapshot: {
                          ...value.snapshot!,
                          stars:
                            e.target.value === ''
                              ? null
                              : Math.max(0, Math.min(1_000_000_000, Math.round(+e.target.value))),
                        },
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>主要语言</span>
                  <input
                    maxLength={100}
                    value={value.snapshot.language}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        snapshot: { ...value.snapshot!, language: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <button
                className="text-button danger"
                onClick={() => onChange({ ...value, snapshot: null })}
              >
                清除仓库卡片
              </button>
            </>
          )}
        </>
      )}
    </details>
  );
}
