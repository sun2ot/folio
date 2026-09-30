import { appendFileSync, readFileSync } from 'node:fs';
import { changelog } from '../src/changelog.ts';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
if (typeof version !== 'string' || !versionPattern.test(version)) {
  throw new Error('package.json 的版本号必须是正式的 major.minor.patch');
}
if (changelog[0]?.version !== version || changelog[0].retrospective) {
  throw new Error('更新日志首条必须对应 package.json 当前版本，且不能是历史补记');
}
const seen = new Set<string>();
for (const [index, entry] of changelog.entries()) {
  if (!versionPattern.test(entry.version) || seen.has(entry.version)) {
    throw new Error(`更新日志版本无效或重复：${entry.version}`);
  }
  seen.add(entry.version);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
    !entry.title ||
    !entry.changes.length ||
    entry.changes.some((group) => !group.items.length || group.items.some((item) => !item.trim()))
  ) {
    throw new Error(`更新日志内容不完整：${entry.version}`);
  }
  const previous = changelog[index - 1];
  if (previous) {
    const currentParts = entry.version.split('.').map(Number);
    const previousParts = previous.version.split('.').map(Number);
    const differing = previousParts.findIndex((part, i) => part !== currentParts[i]);
    if (
      differing < 0 ||
      previousParts[differing] < currentParts[differing] ||
      previous.date < entry.date
    ) {
      throw new Error('更新日志必须按版本和日期倒序排列');
    }
  }
}
if (process.argv.includes('--notes')) {
  const latest = changelog[0];
  process.stdout.write(
    [
      `# Folio v${version} · ${latest.title}`,
      '',
      latest.date,
      '',
      ...latest.changes.flatMap((group) => [
        `## ${group.label}`,
        '',
        ...group.items.map((item) => `- ${item}`),
        '',
      ]),
    ].join('\n'),
  );
} else {
  console.log(`版本与更新日志校验通过：v${version}（${changelog.length} 条记录）`);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
