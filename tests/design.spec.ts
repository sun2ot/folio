import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { openApp, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('全局预设颜色独立，模块名称与标题布局一致', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await expect(page.locator('.color-preset')).toHaveCount(14);
  const presets = [
    [
      '全局标题颜色',
      [
        ['#7c191e', '顺圣'],
        ['#c67915', '拓黄'],
        ['#b6a014', '苍黄'],
        ['#2a6e3f', '官绿'],
        ['#007175', '青雘'],
        ['#06436f', '蓝采和'],
        ['#422256', '凝夜紫'],
      ],
    ],
    [
      '全局正文颜色',
      [
        ['#000000', '黑色'],
        ['#003460', '帝释青'],
        ['#1e2732', '瑾瑜'],
        ['#31322c', '京元'],
        ['#422517', '青骊'],
        ['#13393e', '螺子黛'],
        ['#420b2f', '油紫'],
      ],
    ],
  ] as const;
  for (const [label, colors] of presets) {
    for (const [color, name] of colors) {
      const button = page.getByRole('button', { name: `${label}预设 ${name}`, exact: true });
      await expect(button).toHaveAttribute('title', name);
      await button.hover();
      await button.click();
      await expect(page.getByLabel(`${label}取色`)).toHaveValue(color);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
  }
  await page.getByRole('button', { name: '全局标题颜色预设 蓝采和', exact: true }).click();
  await page.getByRole('button', { name: '全局正文颜色预设 油紫', exact: true }).click();
  await expect(page.locator('#resume-pages h1')).toHaveCSS('color', 'rgb(6, 67, 111)');
  await expect(page.locator('#resume-pages .resume-body').first()).toHaveCSS(
    'color',
    'rgb(66, 11, 47)',
  );
  await page.screenshot({ path: testInfo.outputPath('style-presets.png'), fullPage: true });
  for (const [title, layout] of [
    ['工作经历', '工作经历标题布局'],
    ['精选项目', '项目标题布局'],
    ['教育背景', '教育背景标题布局'],
  ]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByLabel(layout, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '添加模块', exact: true }).click();
  await page
    .locator('.component-menu')
    .getByRole('button', { name: '精选项目', exact: true })
    .click();
  await expect(page.getByLabel('模块标题', { exact: true })).toHaveValue('精选项目');
});

test('三模板分割线覆盖、隐藏、重置与离线导出一致', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  await page.getByLabel('Markdown 正文').fill('介绍\n\n---\n\n内容');
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const repositoryEditor = page.locator('details.repository-editor').first();
  await repositoryEditor.locator('summary').click();
  await repositoryEditor.getByLabel('显示仓库卡片').check();
  await repositoryEditor.getByRole('textbox', { name: /GitHub 链接/ }).fill('sun2ot/folio');
  await repositoryEditor.getByRole('button', { name: '读取离线仓库快照' }).click();
  await repositoryEditor.getByRole('button', { name: /^sun2ot\/folio/ }).click();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByRole('button', { name: '全局正文颜色预设 帝释青', exact: true }).click();
  const decorationParts = [
    ['页眉', '.resume-eyebrow', '#7c191e', 'rgb(124, 25, 30)', 'serif', 'Noto Serif SC', '14'],
    ['页脚', '.resume-footer-text', '#13393e', 'rgb(19, 57, 62)', 'inter', 'Inter', '11'],
    ['页码', '.resume-page-number', '#420b2f', 'rgb(66, 11, 47)', 'source', 'Source Serif 4', '12'],
  ];
  for (const [label, , color, , font, , size] of decorationParts) {
    await page.getByLabel(`${label}颜色取色`, { exact: true }).fill(color);
    await page.getByLabel(`${label}字体`, { exact: true }).selectOption(font);
    await page.getByLabel(`${label}字号`, { exact: true }).selectOption(size);
  }
  const parts = [
    ['基本信息分割线', '.resume-header'],
    ['模块标题分割线', '[data-module="summary"] h2'],
    ['正文分割线', '[data-module="summary"] hr'],
    ['页脚分割线', '.resume-footer'],
  ];
  for (const [label] of parts) {
    await page.getByLabel(`${label}颜色取色`, { exact: true }).fill('#61517c');
    // 先改变默认值，明确写入覆盖；仅显示的模板默认粗细不应锁定后续模板。
    await page.getByLabel(`${label}粗细`, { exact: true }).fill('3');
    await page.getByLabel(`${label}粗细`, { exact: true }).fill('2');
  }
  const templates = [
    ['青序 清晰层次 · 现代留白', 'editorial'],
    ['书简 居中抬头 · 经典沉稳', 'classic'],
    ['构筑 灵活双栏 · 高效呈现', 'compact'],
  ];
  for (const [name, id] of templates) {
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name }).click();
    await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
    for (const [, selector, , color, , family, size] of decorationParts) {
      const el = page.locator(`#resume-pages ${selector}`).first();
      await expect(el).toHaveCSS('color', color);
      await expect(el).toHaveCSS('font-size', `${size}px`);
      await expect(el).toHaveCSS('font-family', new RegExp(family));
    }
    for (const selector of ['.repository-title strong', '.repository-title svg']) {
      await expect(page.locator(`#resume-pages ${selector}`)).toHaveCSS('color', 'rgb(0, 52, 96)');
    }
    for (const [label, selector] of parts) {
      const el = page.locator(`#resume-pages ${selector}`).first();
      const side = label === '正文分割线' || label === '页脚分割线' ? 'top' : 'bottom';
      // 预览的 CSS zoom 会将边框取整到设备像素；离线导出在下方检查精确的纸张尺寸。
      await expect
        .poll(() =>
          el.evaluate(
            (element, edge) =>
              Math.abs(
                parseFloat(getComputedStyle(element).getPropertyValue(`border-${edge}-width`)) - 2,
              ),
            side,
          ),
        )
        .toBeLessThan(1);
      await expect(el).toHaveCSS(`border-${side}-color`, 'rgb(97, 81, 124)');
    }
    if (id === 'compact') {
      await page.getByRole('button', { name: '样式', exact: true }).click();
      await page.getByLabel('顶部色带颜色取色').fill('#7d4651');
      await page.getByLabel('顶部色带粗细').fill('5');
      await expect
        .poll(() =>
          page
            .locator('#resume-pages .resume-page')
            .first()
            .evaluate((el) => Math.abs(parseFloat(getComputedStyle(el, '::before').height) - 5)),
        )
        .toBeLessThan(0.05);
    }
    for (const [kind, ext] of [
      ['独立 HTML', 'html'],
      ['保真 PDF', 'pdf'],
    ]) {
      await page.getByRole('button', { name: '导出简历' }).click();
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: new RegExp(kind) }).click();
      await (await downloaded).saveAs(testInfo.outputPath(`dividers-${id}.${ext}`));
    }
    const offline = await page.context().newPage();
    await page.context().setOffline(true);
    await offline.goto(pathToFileURL(testInfo.outputPath(`dividers-${id}.html`)).href);
    await offline.evaluate(() => document.fonts.ready);
    for (const [, selector, , color, , family, size] of decorationParts) {
      await expect(offline.locator(selector).first()).toHaveCSS('color', color);
      await expect(offline.locator(selector).first()).toHaveCSS('font-size', `${size}px`);
      await expect(offline.locator(selector).first()).toHaveCSS('font-family', new RegExp(family));
    }
    for (const selector of ['.repository-title strong', '.repository-title svg']) {
      await expect(offline.locator(selector)).toHaveCSS('color', 'rgb(0, 52, 96)');
    }
    if (id === 'compact') {
      expect(
        await offline
          .locator('.resume-page')
          .first()
          .evaluate((el) => getComputedStyle(el, '::before').height),
      ).toBe('5px');
    }
    for (const [label, selector] of parts) {
      const side = label === '正文分割线' || label === '页脚分割线' ? 'top' : 'bottom';
      await expect(offline.locator(selector).first()).toHaveCSS(`border-${side}-width`, '2px');
      await expect(offline.locator(selector).first()).toHaveCSS(
        `border-${side}-color`,
        'rgb(97, 81, 124)',
      );
    }
    await offline.screenshot({ path: testInfo.outputPath(`dividers-${id}.png`), fullPage: true });
    await offline.pdf({
      path: testInfo.outputPath(`dividers-${id}-print.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    });
    await offline.close();
    await page.context().setOffline(false);
  }
  await page.getByLabel('模块标题分割线粗细').fill('0');
  await expect(page.locator('#resume-pages [data-module="summary"] h2')).toHaveCSS(
    'border-bottom-width',
    '0px',
  );
  await page.getByRole('button', { name: '模块标题分割线恢复模板默认' }).click();
  await expect(page.getByLabel('模块标题分割线粗细')).toHaveValue('0');
  await expect(page.getByRole('button', { name: '模块标题分割线恢复模板默认' })).toBeDisabled();
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await expect(page.getByLabel('基本信息分割线粗细')).toHaveValue('2');
  await expect(page.getByLabel('基本信息分割线颜色取色')).toHaveValue('#61517c');
  await expect(page.getByLabel('顶部色带粗细')).toHaveValue('5');
  for (const [label, , color, , font, , size] of decorationParts) {
    await expect(page.getByLabel(`${label}颜色取色`, { exact: true })).toHaveValue(color);
    await expect(page.getByLabel(`${label}字体`, { exact: true })).toHaveValue(font);
    await expect(page.getByLabel(`${label}字号`, { exact: true })).toHaveValue(size);
  }
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
    await expect(page.getByLabel(`${label}字号`, { exact: true })).toHaveCSS('height', '40px');
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
