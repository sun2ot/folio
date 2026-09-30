import { expect, type Page, type TestInfo } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import type { Resume } from '../src/model';

export async function ready(page: Page) {
  await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
}

export async function openApp(page: Page, url = '/') {
  await page.goto(url);
  await saved(page);
  await ready(page);
}

/** 等待防抖保存完成，避免刷新时丢掉最后一次修改。 */
export async function saved(page: Page) {
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
}

export async function importDocument(page: Page, doc: Resume) {
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.getByRole('status').filter({ hasText: '已导入简历' })).toBeVisible();
  await expect(page.locator('#resume-pages h1')).toHaveText(doc.profile.name);
  await ready(page);
}

export async function exportFile(
  page: Page,
  info: TestInfo,
  kind: 'json' | 'html' | 'pdf',
  filename: string,
) {
  await page.getByRole('button', { name: '导出简历', exact: true }).click();
  await ready(page);
  const download = page.waitForEvent('download');
  const labels = { json: /JSON 数据备份/, html: /独立 HTML/, pdf: /保真 PDF/ };
  await page.getByRole('button', { name: labels[kind] }).click();
  const file = info.outputPath(filename);
  await (await download).saveAs(file);
  // 下载事件早于 finally 的界面解冻；后续操作必须等当前导出结束。
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('main.workspace')).not.toHaveAttribute('inert');
  return file;
}

export async function withOfflineHTML(
  page: Page,
  file: string,
  check: (page: Page) => Promise<void>,
) {
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  try {
    await offline.goto(pathToFileURL(file).href);
    await offline.evaluate(() => document.fonts.ready);
    await check(offline);
  } finally {
    await offline.close();
    await page.context().setOffline(false);
  }
}
