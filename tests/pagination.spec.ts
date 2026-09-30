import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEntry, createModule, documentSchema, sample, type Module } from '../src/model';
import { openApp, importDocument, ready, exportFile, withOfflineHTML } from './helpers';
import { assertPDF } from './pdf';

function documentFor(
  modules: Module[],
  template: 'editorial' | 'classic' | 'compact' = 'editorial',
) {
  return documentSchema.parse({
    ...sample,
    profile: { ...sample.profile, name: '分页示例', fields: [], photo: '', role: '' },
    pageDecoration: { ...sample.pageDecoration, footerText: '分页示例' },
    theme: { ...sample.theme, template },
    modules,
  });
}

async function withinPages(page: import('@playwright/test').Page) {
  await ready(page);
  const heights = await page
    .locator('#resume-pages .resume-content')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).offsetHeight));
  for (const height of heights) expect(height).toBeLessThanOrEqual(994);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('完整经历条目利用前页余量，续页直接衔接正文，开关与备份保持一致', async ({ page }, info) => {
  const intro = createModule('text', 'intro');
  intro.title = '个人简介';
  intro.keepTogether = true;
  intro.body = Array.from(
    { length: 14 },
    (_, i) => `简介段落 ${i + 1}：用于验证页面剩余空间。`,
  ).join('\n\n');
  const jobs = createModule('experience', 'jobs');
  jobs.entries = Array.from({ length: 10 }, (_, i) => ({
    ...createEntry(),
    id: `job-${i + 1}`,
    organization: `示例单位 ${i + 1}`,
    role: '研究员',
    start: '2021',
    end: '2022',
    body: `- 负责第 ${i + 1} 项研究工作。\n- 完成成果整理与交流。`,
  }));
  const doc = documentFor([intro, jobs], 'classic');
  await importDocument(page, doc);
  const pages = page.locator('#resume-pages .resume-page');
  await expect(pages).toHaveCount(2);
  const firstCount = await pages.first().locator('[data-entry]').count();
  expect(firstCount).toBeGreaterThan(0);
  expect(firstCount).toBeLessThan(10);
  await expect(pages.nth(1).locator('[data-module="jobs"]')).toHaveAttribute(
    'data-continued',
    'true',
  );
  await expect(pages.nth(1).locator('[data-module="jobs"] h2')).toHaveCount(0);
  expect(
    await page
      .locator('#resume-pages [data-entry]')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-entry'))),
  ).toEqual(jobs.entries.map((entry) => entry.id));
  await withinPages(page);
  await page.getByRole('button', { name: '工作经历', exact: true }).click();
  await page.getByLabel('保持整个模块在同一页').check();
  await expect(pages.first().locator('[data-entry]')).toHaveCount(0);
  await expect(pages.nth(1).locator('[data-entry]')).toHaveCount(10);
  await page.getByLabel('保持整个模块在同一页').uncheck();
  await expect(pages.first().locator('[data-entry]')).toHaveCount(firstCount);
  const json = await exportFile(page, info, 'json', 'entries.json');
  const stored = documentSchema.parse(JSON.parse(await readFile(json, 'utf8')));
  expect(stored.modules[1].entries).toEqual(jobs.entries);
  const html = await exportFile(page, info, 'html', 'entries.html');
  await withOfflineHTML(page, html, async (offline) => {
    await expect(offline.locator('.resume-page').first().locator('[data-entry]')).toHaveCount(
      firstCount,
    );
    await expect(offline.locator('[data-entry]')).toHaveCount(10);
  });
  for (const [i, paper] of (await pages.all()).entries())
    await paper.screenshot({ path: info.outputPath(`entries-${i + 1}.png`) });
});

test('长有序列表自动分页，编号、嵌套项、引用链接和 PDF / 打印不丢失', async ({ page }, info) => {
  const text = createModule('text', 'long-list');
  text.title = '研究成果';
  text.bodyStyle.size = 14;
  text.body =
    '### 已完成成果\n\n' +
    Array.from(
      { length: 80 },
      (_, i) =>
        `${i + 1}. **成果 ${i + 1}**：研究工作与结果。${i === 0 ? ' [详细资料][paper]\n   - 嵌套甲\n   - 嵌套乙' : ''}`,
    ).join('\n') +
    '\n\n[paper]: https://example.test/paper';
  const doc = documentFor([text]);
  await importDocument(page, doc);
  const pages = page.locator('#resume-pages .resume-page');
  const count = await pages.count();
  expect(count).toBeGreaterThan(1);
  await expect(page.locator('#resume-pages .markdown > ol > li')).toHaveCount(80);
  const firstItems = await pages.first().locator('.markdown > ol > li').count();
  await expect(pages.nth(1).locator('.markdown > ol')).toHaveAttribute(
    'start',
    String(firstItems + 1),
  );
  await expect(pages.first().locator('.markdown > ol > li').first()).toContainText('嵌套乙');
  await expect(page.locator('#resume-pages .markdown h3')).toHaveCount(1);
  await expect(page.locator('#resume-pages .markdown a')).toHaveAttribute(
    'href',
    'https://example.test/paper',
  );
  await withinPages(page);
  const pdf = await exportFile(page, info, 'pdf', 'list.pdf');
  await assertPDF(pdf, count);
  const html = await exportFile(page, info, 'html', 'list.html');
  await withOfflineHTML(page, html, async (offline) => {
    await expect(offline.locator('.resume-page')).toHaveCount(count);
    await expect(offline.locator('.markdown > ol > li')).toHaveCount(80);
    await expect(offline.locator('.resume-page').nth(1).locator('.markdown > ol')).toHaveAttribute(
      'start',
      String(firstItems + 1),
    );
    const printed = info.outputPath('list-print.pdf');
    await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
    await assertPDF(printed, count);
  });
});

test('双栏各自续排，左栏结束后右栏保留原列位置', async ({ page }, info) => {
  const left = createModule('text', 'left');
  left.width = 'half';
  left.title = '基本能力';
  left.body = '- 左侧内容一\n- 左侧内容二';
  const right = createModule('text', 'right');
  right.width = 'half';
  right.title = '详细成果';
  right.bodyStyle.size = 14;
  right.body = Array.from({ length: 80 }, (_, i) => `- 右侧条目 ${i + 1}：研究与实践。`).join('\n');
  await importDocument(page, documentFor([left, right], 'compact'));
  const pages = page.locator('#resume-pages .resume-page');
  expect(await pages.count()).toBeGreaterThan(1);
  await expect(page.locator('#resume-pages [data-module="left"]')).toHaveCount(1);
  const continuation = pages.nth(1).locator('[data-module="right"]');
  await expect(continuation).toHaveAttribute('data-continued', 'true');
  await expect(continuation).toHaveCSS('grid-column-start', '2');
  await expect(page.locator('#resume-pages [data-module="right"] .markdown > ul > li')).toHaveCount(
    80,
  );
  await withinPages(page);
  await pages.nth(1).screenshot({ path: info.outputPath('right-continuation.png') });
});

test('单个段落比整页高时仍明确报错，禁止静默裁切导出', async ({ page }) => {
  const text = createModule('text', 'single-paragraph');
  text.body = Array.from({ length: 80 }, () => '同一段落中的强制换行。').join('\n');
  await importDocument(page, documentFor([text]));
  await expect(page.getByRole('alert')).toContainText('单段内容或条目');
  await page.getByRole('button', { name: '导出简历', exact: true }).click();
  await page.getByRole('button', { name: /保真 PDF/ }).click();
  await expect(page.getByText('有内容块超出一页，请拆分段落 / 条目或减小字号后导出')).toBeVisible();
});
