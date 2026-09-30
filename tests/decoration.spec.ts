import { test, expect } from '@playwright/test';
import { openApp, importDocument, ready, exportFile, withOfflineHTML } from './helpers';
import { createModule, createEntry, documentSchema, sample } from '../src/model';
import { assertPDF } from './pdf';

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

for (const template of ['editorial', 'classic', 'compact'] as const) {
  test(`${template} 关闭页脚与页码后，专业技能上浮且导出使用回收的正文空间`, async ({
    page,
  }, info) => {
    const intro = createModule('text', 'intro');
    intro.title = '个人简介';
    intro.keepTogether = true;
    intro.body = Array.from(
      { length: 22 },
      (_, i) => `简介 ${i + 1}：用于验证关闭页脚后的正文空间。`,
    ).join('\n\n');
    const education = createModule('education', 'education');
    education.entries = [
      {
        ...createEntry(),
        id: 'school',
        organization: '示例大学',
        degree: '本科',
        major: '工业设计',
        start: '2016.09',
        end: '2020.06',
        body: '- 主修课程：交互设计、设计研究、产品设计。',
      },
    ];
    const skills = createModule('text', 'skills');
    skills.title = '专业技能';
    skills.keepTogether = true;
    skills.body =
      '- **设计**：用户研究 / 交互设计 / 视觉设计\n- **工具**：Figma / Sketch / Adobe Creative Suite\n- **技术**：HTML & CSS / React 基础 / 数据可视化';
    const doc = documentSchema.parse({
      ...sample,
      profile: { ...sample.profile, name: '底部空间示例', role: '', fields: [], photo: '' },
      theme: { ...sample.theme, template },
      modules: [intro, education, skills],
      pageDecoration: { ...sample.pageDecoration, footerText: '底部空间示例' },
    });
    await importDocument(page, doc);
    const pages = page.locator('#resume-pages .resume-page');
    await expect(pages).toHaveCount(2);
    await expect(pages.nth(1).locator('[data-module="skills"]')).toBeVisible();
    await expect(pages.first()).toHaveCSS('padding-bottom', '74px');
    await page.getByRole('button', { name: '样式', exact: true }).click();
    await page.getByLabel('显示页脚标识', { exact: true }).uncheck();
    await ready(page);
    await expect(pages).toHaveCount(2);
    await expect(pages.first()).toHaveCSS('padding-bottom', '74px');
    await page.getByLabel('显示页码', { exact: true }).uncheck();
    await expect(pages).toHaveCount(1);
    await expect(pages.first().locator('[data-module="skills"]')).toBeVisible();
    await expect(pages.first()).toHaveCSS('padding-bottom', '20px');
    await expect(page.locator('.resume-measure')).toHaveCSS('padding-bottom', '20px');
    await expect(page.locator('#resume-pages .resume-footer')).toHaveCount(0);
    const used = await pages
      .locator('.resume-content')
      .evaluate((element) => (element as HTMLElement).offsetHeight);
    expect(used).toBeGreaterThan(994);
    expect(used).toBeLessThanOrEqual(1048);
    await expect(page.getByRole('alert')).toHaveCount(0);
    const html = await exportFile(page, info, 'html', 'without-footer.html');
    const pdf = await exportFile(page, info, 'pdf', 'without-footer.pdf');
    await assertPDF(pdf, 1);
    await withOfflineHTML(page, html, async (offline) => {
      await expect(offline.locator('.resume-page')).toHaveCount(1);
      await expect(offline.locator('[data-module="skills"]')).toBeVisible();
      await expect(offline.locator('.resume-page')).toHaveCSS('padding-bottom', '20px');
      await expect(offline.locator('.resume-footer')).toHaveCount(0);
      await offline
        .locator('.resume-page')
        .screenshot({ path: info.outputPath('without-footer.png') });
      const printed = info.outputPath('without-footer-print.pdf');
      await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
      await assertPDF(printed, 1);
    });
    // 打印入口同样复制动态尺寸，不用旧的固定留白。
    await page.evaluate(() => {
      window.print = () => {
        const paper = document.querySelector('.print-root .resume-page')!;
        document.documentElement.dataset.printBottom = getComputedStyle(paper).paddingBottom;
      };
    });
    await page.getByRole('button', { name: '导出简历', exact: true }).click();
    await page.getByRole('button', { name: /打印 \/ 文字 PDF/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-bottom', '20px');
    await page.getByLabel('显示页码', { exact: true }).check();
    await expect(pages).toHaveCount(2);
    await expect(pages.first()).toHaveCSS('padding-bottom', '74px');
    await expect(pages.nth(1).locator('[data-module="skills"]')).toBeVisible();
  });
}
