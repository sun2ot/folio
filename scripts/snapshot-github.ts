import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { repositoryKey, toRepository } from '../src/repository.ts';

const list = z
  .array(z.string())
  .max(50)
  .parse(JSON.parse(await readFile(new URL('../github-repos.json', import.meta.url), 'utf8')));
const snapshots = [];
for (const input of list) {
  const key = repositoryKey(input);
  if (!key) throw new Error(`无效仓库标识：${input}`);
  const response = await fetch(`https://api.github.com/repos/${key}`, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`仓库快照读取失败：${key} (${response.status})`);
  snapshots.push(toRepository(await response.json()));
}
// Write only after every request succeeds; never leave a partially refreshed snapshot.
await writeFile(
  new URL('../public/github-repos.json', import.meta.url),
  JSON.stringify(snapshots, null, 2) + '\n',
);
console.log(`已预取 ${snapshots.length} 个公开仓库；构建产物可离线添加这些卡片。`);
