import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createEntry, createModule, documentSchema, sample, type Resume } from '../src/model';
import { createResearch } from '../src/research';
import { exportFile, importDocument, openApp, ready, saved, withOfflineHTML } from './helpers';
import { assertPDF } from './pdf';
import { emptyProjectCards } from './fixtures';

function researchDocument(template: Resume['theme']['template']) {
  const projects = createModule('projects', 'research-projects');
  projects.field = 'projects';
  projects.title = '科研成果';
  projects.pageBreak = true;
  projects.entries = [
    {
      ...createEntry(),
      id: 'english-paper',
      research: {
        ...createResearch(),
        visible: true,
        title: 'Local-first Systems for Collaborative Research',
        venue: 'Example Journal of Information Science',
        authorOrder: '第一作者（1/5）',
        level: 'SCI 一区',
        status: 'published',
        openSource: 'open',
        link: '10.1234/folio.example',
      },
    },
    {
      ...createEntry(),
      id: 'chinese-paper',
      research: {
        ...createResearch(),
        visible: true,
        kind: 'paper-zh',
        title: '面向跨学科研究的知识组织与协作方法',
        venue: '示例学术期刊',
        authorOrder: '共同第一作者',
        level: 'CCF-A · EI',
        status: 'revision',
        link: 'https://example.test/papers/chinese?view=abstract',
      },
    },
    {
      ...createEntry(),
      id: 'research-fund',
      research: {
        ...createResearch(),
        visible: true,
        kind: 'fund',
        title: '跨学科知识协同机制研究',
        venue: '示例科学基金',
        authorOrder: '项目负责人',
        level: '国家级',
        status: 'funded',
      },
    },
    {
      ...createEntry(),
      id: 'research-patent',
      research: {
        ...createResearch(),
        visible: true,
        kind: 'patent',
        title: '一种面向知识检索的信息处理方法',
        authorOrder: '第一发明人',
        level: '发明专利',
        status: 'granted',
        openSource: 'closed',
      },
    },
  ];
  return documentSchema.parse({
    ...sample,
    name: '科研成果示例',
    profile: { ...sample.profile, name: '科研成果示例', role: '研究人员 / Researcher', photo: '' },
    pageDecoration: { ...sample.pageDecoration, footerText: '科研成果示例' },
    theme: { ...sample.theme, template, textColor: '#38576b' },
    modules: [{ ...sample.modules[0], body: '关注知识组织、信息系统与跨学科研究。' }, projects],
  });
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('科研卡片编辑、可选信息、链接校验与保存，桌面和窄屏均可滚动', async ({ page }, info) => {
  await importDocument(page, emptyProjectCards());
  const external: string[] = [];
  await page.route('https://**', async (route) => {
    external.push(route.request().url());
    await route.abort();
  });
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const editor = page.locator('details.research-editor').first();
  await editor.locator('summary').click();
  await editor.getByLabel('显示科研卡片').check();
  const card = page.locator('#resume-pages .resume-research');
  await expect(card).toHaveCount(0);
  await editor.getByLabel('论文 / 基金 / 专利名称').fill('Research Methods · 研究方法');
  await editor.getByLabel('期刊 / 会议名称').fill('Example Research Conference');
  await editor.getByLabel('作者排序').fill('通讯作者');
  await editor.getByLabel('级别 / 类型标签').fill('SCI Q1（JCR）');
  await expect(card).toContainText('SCI Q1（JCR）');
  await expect(card.locator('.research-openness')).toHaveCount(0);
  await expect(card.locator('.research-link')).toHaveCount(0);
  for (const [value, label] of [
    ['published', '出版'],
    ['proofreading', '校稿'],
    ['revision', '反修'],
    ['review', '外审'],
    ['submitted', '投稿'],
  ]) {
    await editor.getByLabel('当前状态').selectOption(value);
    await expect(card.locator('.research-status')).toHaveText(label);
  }
  await editor.getByLabel('是否开源（可选）').selectOption('open');
  await expect(card.locator('.research-openness')).toHaveText('已开源');
  const linkInput = editor.getByLabel('DOI / 链接地址（可选）');
  await linkInput.fill('10.1234/example');
  const link = card.getByRole('link', { name: '查看成果：Research Methods · 研究方法' });
  await expect(link).toHaveAttribute('href', 'https://doi.org/10.1234/example');
  await expect(link).toHaveText('');
  await link.focus();
  await expect(link).toBeFocused();
  await linkInput.fill('javascript:alert(1)');
  await expect(linkInput).toHaveAttribute('aria-invalid', 'true');
  await expect(editor.getByRole('status')).toContainText('链接尚未保存');
  await expect(link).toHaveAttribute('href', 'https://doi.org/10.1234/example');
  await linkInput.fill('https://example.test/preprint');
  await expect(link).toHaveAttribute('href', 'https://example.test/preprint');
  await expect(card).not.toContainText('https://');
  await linkInput.fill('');
  await expect(link).toHaveCount(0);
  await editor.getByLabel('是否开源（可选）').selectOption('');
  await editor.getByLabel('当前状态').selectOption('');
  await editor.getByLabel('成果类别').selectOption('paper-zh');
  await editor.getByLabel('级别 / 类型标签').fill('核心 · CSSCI');
  await expect(card.locator('.research-tag')).toHaveText('核心 · CSSCI');
  await expect(card.locator('.research-status, .research-openness')).toHaveCount(0);
  const json = await exportFile(page, info, 'json', 'research-edited.json');
  const doc = documentSchema.parse(JSON.parse(await readFile(json, 'utf8')));
  const stored = doc.modules.find((m) => m.field === 'projects')!.entries[0].research;
  expect(stored).toMatchObject({
    title: 'Research Methods · 研究方法',
    kind: 'paper-zh',
    authorOrder: '通讯作者',
    level: '核心 · CSSCI',
    link: '',
    status: '',
    openSource: '',
  });
  await saved(page);
  await page.reload();
  await expect(card).toContainText('Research Methods · 研究方法');
  await importDocument(page, doc);
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await expect(editor.getByLabel('作者排序')).toHaveValue('通讯作者');
  for (const viewport of [
    { width: 1280, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const panel = page.locator('.editor-panel');
    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    const bounds = (await panel.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await editor.getByLabel('成果类别').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`editor-${viewport.width}.png`),
      fullPage: true,
    });
  }
  await editor.getByLabel('显示科研卡片').uncheck();
  await expect(card).toHaveCount(0);
  await editor.locator('summary').click();
  await editor.getByLabel('显示科研卡片').check();
  await expect(card).toContainText('Research Methods · 研究方法');
  expect(external).toEqual([]);
});

for (const template of ['editorial', 'classic', 'compact'] as const) {
  test(`${template} 科研成果保留颜色、图标链接与多页 PDF / HTML / 打印输出`, async ({
    page,
  }, info) => {
    const doc = researchDocument(template);
    await importDocument(page, doc);
    const cards = page.locator('#resume-pages .resume-research');
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toHaveCSS('color', 'rgb(56, 87, 107)');
    const projects = doc.modules[1];
    projects.bodyStyle.color = '#6b4658';
    await importDocument(page, doc);
    await expect(cards.first()).toHaveCSS('color', 'rgb(107, 70, 88)');
    await expect(cards.first().locator('.research-link')).toHaveCSS('color', 'rgb(107, 70, 88)');
    await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
    const expectedLinks = [
      'https://doi.org/10.1234/folio.example',
      'https://example.test/papers/chinese?view=abstract',
    ];
    const pdfLinks = await page
      .locator('#resume-pages .resume-page')
      .nth(1)
      .evaluate((paper) => {
        const bounds = paper.getBoundingClientRect();
        return [...paper.querySelectorAll<HTMLAnchorElement>('.research-link')].map((link) => {
          const rect = link.getBoundingClientRect();
          return {
            page: 2,
            url: link.href,
            left: ((rect.left - bounds.left) / bounds.width) * 794,
            top: ((rect.top - bounds.top) / bounds.height) * 1122,
            width: (rect.width / bounds.width) * 794,
            height: (rect.height / bounds.height) * 1122,
          };
        });
      });
    for (const [i, paper] of (await page.locator('#resume-pages .resume-page').all()).entries()) {
      await paper.screenshot({ path: info.outputPath(`preview-${i + 1}.png`) });
    }
    const pdf = await exportFile(page, info, 'pdf', 'research.pdf');
    await assertPDF(pdf, 2, [], pdfLinks);
    const json = await exportFile(page, info, 'json', 'research.json');
    expect(documentSchema.parse(JSON.parse(await readFile(json, 'utf8')))).toEqual(doc);
    const html = await exportFile(page, info, 'html', 'research.html');
    await withOfflineHTML(page, html, async (offline) => {
      const offlineCards = offline.locator('.resume-research');
      await expect(offlineCards).toHaveCount(4);
      await expect(offlineCards.first().locator('.research-link')).toHaveAttribute(
        'href',
        expectedLinks[0],
      );
      await expect(offlineCards.first().locator('.research-title')).toHaveCSS(
        'color',
        'rgb(107, 70, 88)',
      );
      await expect(offlineCards.nth(1)).toContainText('CCF-A · EI');
      await expect(offlineCards.nth(2).locator('.research-openness, .research-link')).toHaveCount(
        0,
      );
      await expect(offlineCards.nth(3)).toContainText('发明专利');
      await expect(offline.locator('script, img[src^="http"]')).toHaveCount(0);
      await offline
        .locator('.resume-page')
        .nth(1)
        .screenshot({ path: info.outputPath('offline-page-2.png') });
      const printed = info.outputPath('research-print.pdf');
      await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
      await assertPDF(printed, 2, [], pdfLinks);
    });
  });
}

test('半宽科研卡片长文本自然换行，与仓库卡片共存且不解析固定字段 HTML', async ({ page }, info) => {
  const doc = researchDocument('compact');
  const entry = doc.modules[1].entries[0];
  doc.modules[1].width = 'half';
  doc.modules[1].entries = [entry];
  entry.research!.title = 'CrossDisciplinary'.repeat(12) + ' <script>literal</script>';
  entry.research!.venue = 'Journal'.repeat(20);
  entry.research!.authorOrder = '共同第一作者'.repeat(20);
  entry.research!.level = '自定义标签'.repeat(16);
  entry.github = {
    visible: true,
    snapshot: {
      owner: 'example',
      name: 'research',
      description: '配套代码仓库',
      stars: null,
      forks: null,
      language: '',
      avatar: '',
      fetchedAt: null,
    },
  };
  await importDocument(page, documentSchema.parse(doc));
  const card = page.locator('#resume-pages .resume-research');
  await expect(card).toContainText('<script>literal</script>');
  await expect(card.locator('script')).toHaveCount(0);
  await expect(page.locator('#resume-pages .resume-repository')).toContainText('配套代码仓库');
  await ready(page);
  expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page
    .locator('#resume-pages .resume-page')
    .nth(1)
    .screenshot({ path: info.outputPath('half-width.png') });
});
