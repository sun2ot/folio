import { test, expect } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('页眉、页脚、页码继承全局，局部设置与重置独立，窄屏控件同排', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('全局字体', { exact: true }).selectOption('serif');
  await page.getByRole('button', { name: '全局正文颜色预设 螺子黛', exact: true }).click();
  const parts = [
    ['页眉', '.resume-eyebrow'],
    ['页脚', '.resume-footer-text'],
    ['页码', '.resume-page-number'],
  ];
  for (const [label, selector] of parts) {
    const el = page.locator(`#resume-pages ${selector}`).first();
    await expect(el).toHaveCSS('color', 'rgb(19, 57, 62)');
    await expect(el).toHaveCSS('font-family', /Noto Serif SC/);
    await expect(
      page.getByRole('button', { name: `${label}恢复默认样式`, exact: true }),
    ).toBeDisabled();
    await page.getByLabel(`${label}颜色取色`, { exact: true }).fill('#7c191e');
    await page.getByLabel(`${label}字体`, { exact: true }).selectOption('inter');
    await page.getByLabel(`${label}字号`, { exact: true }).selectOption('13');
    await expect(el).toHaveCSS('color', 'rgb(124, 25, 30)');
    const row = page
      .locator('.decoration-setting')
      .filter({ has: page.getByLabel(`${label}字体`, { exact: true }) });
    await row.scrollIntoViewIfNeeded();
    const positions = await row
      .locator('.typography-row > *')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(5);
    await page.getByRole('button', { name: `${label}颜色恢复跟随全局`, exact: true }).click();
    await expect(el).toHaveCSS('color', 'rgb(19, 57, 62)');
    await expect(el).toHaveCSS('font-family', /Inter/);
    await expect(el).toHaveCSS('font-size', '13px');
    await page.getByRole('button', { name: `${label}恢复默认样式`, exact: true }).click();
    await expect(el).toHaveCSS('font-family', /Noto Serif SC/);
    await expect(el).toHaveCSS('font-size', '9px');
  }
  await page.getByRole('button', { name: '全局正文颜色预设 帝释青', exact: true }).click();
  for (const [label, selector] of parts) {
    await expect(page.getByLabel(`${label}颜色取色`, { exact: true })).toHaveValue('#003460');
    await expect(page.locator(`#resume-pages ${selector}`).first()).toHaveCSS(
      'color',
      'rgb(0, 52, 96)',
    );
  }
  const panel = page.locator('.editor-panel');
  await panel.evaluate((el) => {
    el.scrollTop = 0;
  });
  const panelBox = (await panel.boundingBox())!;
  await page.mouse.move(panelBox.x + panelBox.width / 2, panelBox.y + 130);
  await page.mouse.wheel(0, 1200);
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('decoration-mobile.png'), fullPage: true });
  await page.getByLabel('显示页脚标识', { exact: true }).uncheck();
  await expect(page.locator('#resume-pages .resume-footer-text')).toHaveCount(0);
  await expect(page.locator('#resume-pages .resume-page-number').first()).toBeVisible();
  await page.getByLabel('显示页脚标识', { exact: true }).check();
  await page.getByLabel('显示页码', { exact: true }).uncheck();
  await expect(page.locator('#resume-pages .resume-page-number')).toHaveCount(0);
  await expect(page.locator('#resume-pages .resume-footer-text').first()).toBeVisible();
});
test('过大的页脚不会覆盖正文并静默导出，重置后恢复', async ({ page }) => {
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('页脚标识 / ID', { exact: true }).fill('很长的页脚内容'.repeat(12));
  await page.getByLabel('页脚字号', { exact: true }).selectOption('30');
  await expect(page.getByRole('alert')).toContainText('页脚 / 页码');
  await page.getByRole('button', { name: '导出简历', exact: true }).click();
  await page.getByRole('button', { name: /独立 HTML/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /超出/ })).toBeVisible();
  await page.getByRole('button', { name: '关闭导出', exact: true }).click();
  await page.getByRole('button', { name: '页脚恢复默认样式', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
