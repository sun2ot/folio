import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openApp, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('手动填写与离线快照不请求外部头像，关闭联网后禁止获取头像', async ({ page }) => {
  const external: string[] = [];
  await page.route('https://**', async (route) => {
    external.push(route.request().url());
    await route.abort();
  });
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const editor = page.locator('details.repository-editor').first();
  await editor.locator('summary').click();
  await editor.getByLabel('显示仓库卡片').check();
  await editor.getByRole('textbox', { name: /GitHub 链接/ }).fill('sun2ot/folio');
  await editor.getByRole('button', { name: '读取离线仓库快照' }).click();
  await editor.getByRole('button', { name: /^sun2ot\/folio/ }).click();
  await expect(page.locator('#resume-pages .resume-repository')).toBeVisible();
  await expect(editor.getByRole('button', { name: '获取作者头像' })).toBeDisabled();
  await editor.getByRole('button', { name: '手动填写卡片' }).click();
  await expect(editor.getByRole('status')).toContainText('已保存');
  expect(external).toEqual([]);
});

test('侧栏版权入口指向仓库与作者博客', async ({ page }) => {
  const links = page.locator('.author-links a');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', 'https://github.com/sun2ot/folio');
  await expect(links.nth(0)).toHaveAccessibleName('GitHub 仓库，作者 sun2ot');
  await expect(links.nth(1)).toHaveAttribute('href', 'https://abdc.net.cn');
  await expect(links.nth(1)).toHaveAccessibleName('sun2ot 的博客 abdc.net.cn');
  await expect(page.locator('.author-links')).toHaveText('');
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份我的数据', exact: true }).click();
  expect((await backup).suggestedFilename()).toBe('folio-resume.json');
  for (const link of await links.all())
    expect(await link.getAttribute('rel')).toContain('noreferrer');
});

test('精选项目可添加离线 GitHub 仓库卡片，并随备份和导出离线保留', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const card = page.locator('#resume-pages [data-module="projects"] .resume-repository').first();
  await expect(card).toHaveCount(0);
  // 折叠时 details 内的控件不可见，按可见的 summary 文本定位再展开。
  const editor = page.locator('details.repository-editor').first();
  const summary = editor.locator('summary').filter({ hasText: 'GitHub 仓库卡片' });
  const open = async () => {
    // 卡片存在时 details 已默认展开，再点 summary 反而会折叠。
    if (!(await editor.evaluate((el: HTMLDetailsElement) => el.open))) await summary.click();
  };
  await open();
  await editor.getByLabel('显示仓库卡片').check();
  const help = editor.locator('.help-tip');
  await help.hover();
  // 需要外网时必须在界面上说明，并给出离线和代理替代方案。
  await expect(help.getByRole('tooltip')).toContainText('必须能访问 GitHub API');
  await expect(help.getByRole('tooltip')).toContainText('自定义 API 代理');
  await expect(help.getByRole('tooltip')).toContainText('离线仓库快照');
  await editor.getByLabel('允许联网搜索 / 刷新').check();
  await expect(editor.getByLabel('使用自定义 API 代理', { exact: true })).toBeVisible();
  await editor.getByLabel('使用自定义 API 代理', { exact: true }).check();
  await expect(editor.getByLabel('HTTPS 代理根地址')).toBeVisible();
  // 展示给用户的提示必须写明代理只接受根地址。
  await expect(editor.getByText(/只要根地址/)).toBeVisible();
  await editor.getByLabel('使用自定义 API 代理', { exact: true }).uncheck();
  const field = editor.getByRole('textbox', { name: /GitHub 链接/ });
  await field.fill('https://github.com/sun2ot/folio');
  await editor.getByRole('button', { name: '手动填写卡片' }).click();
  await editor.getByLabel('仓库简介').fill('纯前端、本地优先的简历工作室。');
  await editor.getByLabel('Star 数（留空不显示）').fill('128');
  await editor.getByLabel('主要语言').fill('TypeScript');
  await expect(card).toHaveAttribute('href', 'https://github.com/sun2ot/folio');
  await expect(card).toContainText('sun2ot');
  await expect(card).toContainText('纯前端、本地优先的简历工作室。');
  await expect(card).toContainText('★ 128 Star');
  await expect(card).toContainText('TypeScript');
  await expect(editor.locator('p.hint', { hasText: '手动填写' })).toBeVisible();
  // 未校验的地址不能悄悄变成安全链接。
  await field.fill('https://evil.test/sun2ot/folio');
  await editor.getByRole('button', { name: '手动填写卡片' }).click();
  await expect(editor.getByRole('status')).toContainText('请先输入完整的 GitHub 仓库地址');
  await expect(card).toHaveAttribute('href', 'https://github.com/sun2ot/folio');
  // 卡片随 JSON 备份往返，并写入离线 HTML。
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /JSON 数据备份/ }).click();
  const file = testInfo.outputPath('github-card.json');
  await (await backup).saveAs(file);
  const backupDoc = JSON.parse(await readFile(file, 'utf8'));
  const projects = backupDoc.modules.find((m: { field: string }) => m.field === 'projects');
  expect(projects.entries[0].github).toMatchObject({
    visible: true,
    snapshot: { owner: 'sun2ot', name: 'folio', stars: 128, language: 'TypeScript' },
  });
  await page.getByRole('button', { name: '导出简历' }).click();
  const html = page.waitForEvent('download');
  await page.getByRole('button', { name: /独立 HTML/ }).click();
  const htmlPath = testInfo.outputPath('github-card.html');
  await (await html).saveAs(htmlPath);
  expect(await readFile(htmlPath, 'utf8')).toContain('https://github.com/sun2ot/folio');
  await page.screenshot({ path: testInfo.outputPath('github-card.png'), fullPage: true });
  // 保存后刷新仍保留，并可关闭显示。
  await saved(page);
  await page.reload();
  await expect(card).toHaveAttribute('href', 'https://github.com/sun2ot/folio');
  // 刷新后编辑面板回到基本信息，需要重新选中模块再关闭卡片显示。
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await open();
  await editor.getByLabel('显示仓库卡片').uncheck();
  await expect(card).toHaveCount(0);
});
