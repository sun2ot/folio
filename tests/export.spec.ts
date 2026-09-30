import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { documentSchema, sample } from '../src/model';
import { floatingDocument } from './fixtures';
import { assertPDF } from './pdf';
import { openApp, importDocument, exportFile, withOfflineHTML } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('默认简历导出 A4 PDF，离线 HTML 包含字体图片且没有脚本', async ({ page }, info) => {
  const html = await exportFile(page, info, 'html', 'resume.html');
  const pdf = await exportFile(page, info, 'pdf', 'resume.pdf');
  await assertPDF(pdf, 1);
  await withOfflineHTML(page, html, async (offline) => {
    await expect(offline.locator('.resume-page')).toHaveCount(1);
    await expect(offline.locator('h1')).toHaveText(sample.profile.name);
    await expect(offline.locator('script')).toHaveCount(0);
    const avatar = offline.locator('.avatar-resource');
    await expect(avatar).toHaveAttribute('src', /^data:image\/png;base64,/);
    expect(
      await avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
    // fonts.check 在字体不存在时也可能为 true；要求内嵌字体实际处于已加载状态。
    expect(
      await offline.evaluate(() =>
        [...document.fonts].some(
          (font) => font.family.includes('Noto Sans SC') && font.status === 'loaded',
        ),
      ),
    ).toBe(true);
    await offline.screenshot({ path: info.outputPath('offline-html.png'), fullPage: true });
    const printed = info.outputPath('print.pdf');
    await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
    await assertPDF(printed, 1);
  });
});

test('无效导入保持当前文档，合法导入替换并显示正文', async ({ page }) => {
  const uploader = page.locator('input[accept=".json,application/json"]');
  await uploader.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...sample, version: 9 })),
  });
  await expect(page.getByRole('status')).toContainText('导入失败');
  await expect(page.getByLabel('姓名', { exact: true })).toHaveValue(sample.profile.name);
  const doc = documentSchema.parse({ ...sample, profile: { ...sample.profile, name: '导入验证' } });
  doc.modules[0].body = '导入后的**独立正文**';
  await importDocument(page, doc);
  await expect(page.locator('#resume-pages [data-module="summary"]')).toContainText(
    '导入后的独立正文',
  );
});

test('超长模块提示并阻止排版导出', async ({ page }) => {
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  await page
    .getByLabel('Markdown 正文')
    .fill(Array.from({ length: 100 }, (_, i) => `- 第 ${i} 项内容`).join('\n'));
  await expect(page.getByRole('alert')).toContainText('超出一页');
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /保真 PDF/ }).click();
  await expect(page.getByText('有模块超出一页，请拆分内容或减小字号后导出')).toBeVisible();
});

for (const [label, id] of [
  ['青序 清晰层次 · 现代留白', 'editorial'],
  ['书简 居中抬头 · 经典沉稳', 'classic'],
  ['构筑 灵活双栏 · 高效呈现', 'compact'],
] as const) {
  test(`${id} 的多页导出保留文字样式和第二页图片坐标`, async ({ page }, info) => {
    const doc = await floatingDocument(page);
    doc.profile.name = '导出验证';
    doc.profile.nameColor = '#2c466b';
    doc.profile.roleColor = '#7d4651';
    doc.profile.fields[0].color = '#2f6b4f';
    doc.theme.textColor = '#866339';
    doc.theme.font = 'inter';
    doc.modules[0].titleStyle.font = 'serif';
    doc.modules[0].bodyStyle.font = 'source';
    doc.pageDecoration.headerStyle = { color: '#7c191e', font: 'serif', size: 14 };
    doc.pageDecoration.footerStyle = { color: '#13393e', font: 'inter', size: 11 };
    doc.pageDecoration.pageNumberStyle = { color: '#420b2f', font: 'source', size: 12 };
    await importDocument(page, documentSchema.parse(doc));
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: label }).click();
    await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
    const json = await exportFile(page, info, 'json', 'styled.json');
    expect(JSON.parse(await readFile(json, 'utf8')).profile).toMatchObject({
      nameColor: '#2c466b',
      roleColor: '#7d4651',
      fields: expect.arrayContaining([expect.objectContaining({ id: 'phone', color: '#2f6b4f' })]),
    });
    const html = await exportFile(page, info, 'html', 'floating.html');
    const pdf = await exportFile(page, info, 'pdf', 'floating.pdf');
    const markers = [{ page: 2, x: 660, y: 940, color: [49, 91, 80] as const }];
    await assertPDF(pdf, 2, markers);
    await withOfflineHTML(page, html, async (offline) => {
      await expect(offline.locator('h1')).toHaveCSS('color', 'rgb(44, 70, 107)');
      await expect(offline.locator('.resume-role')).toHaveCSS('color', 'rgb(125, 70, 81)');
      await expect(offline.locator('.resume-contact-item').first()).toHaveCSS(
        'color',
        'rgb(47, 107, 79)',
      );
      for (const [selector, color, family, size] of [
        ['.resume-eyebrow', 'rgb(124, 25, 30)', 'Noto Serif SC', '14px'],
        ['.resume-footer-text', 'rgb(19, 57, 62)', 'Inter', '11px'],
        ['.resume-page-number', 'rgb(66, 11, 47)', 'Source Serif 4', '12px'],
      ]) {
        const text = offline.locator(selector).first();
        await expect(text).toHaveCSS('color', color);
        await expect(text).toHaveCSS('font-family', new RegExp(family));
        await expect(text).toHaveCSS('font-size', size);
      }
      await expect(offline.locator('[data-media][role="button"]')).toHaveCount(0);
      await expect(offline.locator('.resume-page').nth(1).locator('[data-media="qr"]')).toHaveCSS(
        'left',
        '600px',
      );
      const printed = info.outputPath('floating-print.pdf');
      await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
      await assertPDF(printed, 2, markers);
    });
    // 原生打印入口也必须使用临时 DOM 并在调用后清理。
    await page.evaluate(() => {
      window.print = () => {
        document.documentElement.dataset.printPages = String(
          document.querySelectorAll('.print-root .resume-page').length,
        );
      };
    });
    await page.getByRole('button', { name: '导出简历' }).click();
    await page.getByRole('button', { name: /打印 \/ 文字 PDF/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-pages', '2');
    await expect(page.locator('.print-root')).toHaveCount(0);
  });
}
