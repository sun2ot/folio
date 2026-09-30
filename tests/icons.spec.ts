import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { documentSchema } from '../src/model';
import { openApp, exportFile, saved } from './helpers';

test('默认两种卡片完全离线，隐藏选择刷新后保留', async ({ page }, info) => {
  const requests: string[] = [];
  await page.route('https://**', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await openApp(page);
  const repository = page.locator('#resume-pages .resume-repository');
  const research = page.locator('#resume-pages .resume-research');
  await expect(repository).toContainText('atlas-workspace');
  await expect(repository).toContainText('虚构示例');
  await expect(research).toContainText('第二作者兼通讯作者');
  await expect(research).toContainText('SCI 二区');
  await expect(research).toContainText('已开源');
  await expect(research.locator('.research-status')).toHaveText('出版');
  await expect(research.locator('a')).toHaveAttribute(
    'href',
    'https://doi.org/10.1007/s10115-026-02735-z',
  );
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.locator('details.repository-editor').first().getByLabel('显示仓库卡片').uncheck();
  await page.locator('details.research-editor').nth(1).getByLabel('显示科研卡片').uncheck();
  await saved(page);
  await page.reload();
  await expect(repository).toHaveCount(0);
  await expect(research).toHaveCount(0);
  const backup = await exportFile(page, info, 'json', 'hidden-samples.json');
  const doc = documentSchema.parse(JSON.parse(await readFile(backup, 'utf8')));
  const entries = doc.modules.find((m) => m.kind === 'projects')!.entries;
  expect(entries[0].github.visible).toBe(false);
  expect(entries[1].research?.visible).toBe(false);
  expect(entries[1].research?.title).toContain('Diffusion-based');
  expect(requests).toEqual([]);
});

test('完整图标搜索、分页、无结果、真实滚轮及模块与信息字段选择', async ({ page }, info) => {
  const requests: string[] = [];
  await page.route('https://**', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await openApp(page);
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  const picker = page.getByRole('button', { name: /标题图标：/ });
  await picker.click();
  const dialog = page.getByRole('dialog', { name: '标题图标选择器' });
  const search = dialog.getByLabel('搜索图标');
  const menu = dialog.getByRole('listbox');
  await expect(search).toBeFocused();
  const box = (await menu.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await dialog.getByRole('button', { name: '下一页图标' }).click();
  await expect(dialog.locator('.icon-pagination')).toContainText('2 /');
  await search.fill('不存在的图标');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(dialog.getByText('未找到图标', { exact: false })).toBeVisible();
  await search.fill('lucide:Microscope');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await search.press('ArrowDown');
  await expect(menu.getByRole('option', { name: 'Microscope', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(picker).toHaveAccessibleName('标题图标：Microscope');
  await expect(picker).toBeFocused();
  await expect(page.locator('#resume-pages [data-module="summary"] h2 svg')).toHaveClass(
    /lucide-microscope/,
  );
  await picker.click();
  await search.fill('trend');
  await menu.getByRole('option', { name: '趋势', exact: true }).click();
  await expect(picker).toHaveAccessibleName('标题图标：趋势');
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await page.getByRole('button', { name: '第 1 项图标：电话', exact: true }).click();
  const infoDialog = page.getByRole('dialog', { name: '第 1 项图标选择器' });
  await infoDialog.getByLabel('搜索图标').fill('pencil');
  await infoDialog.getByRole('option', { name: '铅笔', exact: true }).click();
  await expect(page.getByRole('button', { name: '第 1 项图标：铅笔', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '第 1 项图标：铅笔', exact: true }).click();
  await infoDialog.getByLabel('搜索图标').fill('齿轮');
  await expect(infoDialog.getByRole('option', { name: '齿轮', exact: true })).toBeVisible();
  expect(await infoDialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('icons-mobile.png'), fullPage: true });
  await infoDialog.getByRole('option', { name: '齿轮', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '第 1 项图标：齿轮', exact: true })).toBeVisible();
  const json = await exportFile(page, info, 'json', 'icons.json');
  const doc = documentSchema.parse(JSON.parse(await readFile(json, 'utf8')));
  expect(doc.profile.fields[0].icon).toBe('gear');
  expect(doc.modules[0].icon).toBe('trend');
  expect(requests).toEqual([]);
});
