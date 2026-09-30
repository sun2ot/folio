import { test, expect } from '@playwright/test';
import { documentSchema, sample } from '../src/model';
import { openApp, importDocument, exportFile, withOfflineHTML, saved } from './helpers';

const parts = [
  ['基本信息分割线', '.resume-header', 'bottom'],
  ['模块标题分割线', '[data-module="summary"] h2', 'bottom'],
  ['正文分割线', '[data-module="summary"] hr', 'top'],
  ['页脚分割线', '.resume-footer', 'top'],
] as const;

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

for (const [label, id] of [
  ['青序 清晰层次 · 现代留白', 'editorial'],
  ['书简 居中抬头 · 经典沉稳', 'classic'],
  ['构筑 灵活双栏 · 高效呈现', 'compact'],
] as const) {
  test(`${id} 保留分割线覆盖，离线 HTML 使用精确粗细`, async ({ page }, info) => {
    const doc = structuredClone(sample);
    doc.profile.name = '分割线验证';
    doc.modules[0].body = '介绍\n\n---\n\n内容';
    doc.theme.dividers = Object.fromEntries(
      ['header', 'section', 'content', 'footer', 'stripe'].map((key) => [
        key,
        { color: '#61517c', width: key === 'stripe' ? 5 : 2 },
      ]),
    );
    await importDocument(page, documentSchema.parse(doc));
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: label }).click();
    for (const [, selector, side] of parts) {
      await expect(page.locator(`#resume-pages ${selector}`).first()).toHaveCSS(
        `border-${side}-color`,
        'rgb(97, 81, 124)',
      );
    }
    const html = await exportFile(page, info, 'html', `dividers-${id}.html`);
    await withOfflineHTML(page, html, async (offline) => {
      for (const [, selector, side] of parts) {
        await expect(offline.locator(selector).first()).toHaveCSS(`border-${side}-width`, '2px');
        await expect(offline.locator(selector).first()).toHaveCSS(
          `border-${side}-color`,
          'rgb(97, 81, 124)',
        );
      }
      if (id === 'compact')
        expect(
          await offline
            .locator('.resume-page')
            .first()
            .evaluate((el) => getComputedStyle(el, '::before').height),
        ).toBe('5px');
      await offline.screenshot({ path: info.outputPath(`dividers-${id}.png`), fullPage: true });
    });
  });
}

test('分割线可编辑、隐藏和重置，刷新后保留其他覆盖', async ({ page }) => {
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('基本信息分割线粗细').fill('3');
  await page.getByLabel('基本信息分割线颜色取色').fill('#61517c');
  await page.getByLabel('模块标题分割线粗细').fill('0');
  await expect(page.locator('#resume-pages [data-module="summary"] h2')).toHaveCSS(
    'border-bottom-width',
    '0px',
  );
  await page.getByRole('button', { name: '模块标题分割线恢复模板默认' }).click();
  await expect(page.getByRole('button', { name: '模块标题分割线恢复模板默认' })).toBeDisabled();
  await expect(page.getByLabel('模块标题分割线粗细')).toHaveValue('1');
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await expect(page.getByLabel('基本信息分割线粗细')).toHaveValue('3');
  await expect(page.getByLabel('基本信息分割线颜色取色')).toHaveValue('#61517c');
});
