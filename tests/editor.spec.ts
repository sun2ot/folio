import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { icons, sample } from '../src/model';
import { iconLabels } from '../src/IconPicker';
import { openApp } from './helpers';

const iconLabelOf = (icon: (typeof icons)[number]) => iconLabels[icon];

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('品牌图标与默认头像、移除后刷新、显式恢复', async ({ page }) => {
  const logo = page.locator('.brand-mark');
  await expect(logo).toHaveAttribute('src', /folio\.svg$/);
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(
    true,
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /folio\.svg$/);
  const avatar = page.locator('#resume-pages .avatar-resource');
  await expect(avatar).toHaveAttribute('src', /^data:image\/png;base64,/);
  const original = await avatar.getAttribute('src');
  await page.getByRole('button', { name: '移除头像', exact: true }).click();
  await expect(avatar).toHaveCount(0);
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await page.reload();
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await expect(avatar).toHaveCount(0);
  await page.getByRole('button', { name: '使用默认头像', exact: true }).click();
  await expect(avatar).toHaveAttribute('src', original!);
});

test('按模块命名添加操作，日期地点同行，条目之间保留间距', async ({ page }) => {
  for (const [title, id, button, location] of [
    ['工作经历', 'experience', '添加工作经历', '工作地点'],
    ['精选项目', 'projects', '添加项目', '项目地点'],
    ['教育背景', 'education', '添加教育背景', '学校地点'],
  ]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('button', { name: button, exact: true })).toBeVisible();
    await page.getByLabel(location, { exact: true }).first().fill('上海');
    const heading = page.locator(`#resume-pages [data-module="${id}"] .entry-heading`).first();
    for (const layout of ['left-right', 'left-center-right']) {
      await page.getByLabel('经历标题布局').selectOption(layout);
      await expect(heading).toHaveClass(new RegExp(layout));
      await expect(heading.locator('.entry-meta')).toContainText(' · 上海');
      const size = await heading.evaluate((el) => ({
        height: (el as HTMLElement).offsetHeight,
        line: parseFloat(getComputedStyle(el.querySelector('.entry-main')!).lineHeight),
      }));
      expect(size.height).toBeLessThanOrEqual(Math.ceil(size.line) + 1);
    }
  }
  const spacing = await page.locator('#resume-pages [data-module="experience"]').evaluate((el) => {
    const first = el.querySelectorAll('.resume-entry')[0];
    const second = el.querySelectorAll('.resume-entry')[1];
    const heading = first.querySelector('.entry-heading')!.getBoundingClientRect();
    const body = first.querySelector('.markdown')!.getBoundingClientRect();
    return {
      inside: body.top - heading.bottom,
      between: second.getBoundingClientRect().top - body.bottom,
    };
  });
  expect(spacing.inside).toBeLessThan(8);
  expect(spacing.between).toBeGreaterThan(spacing.inside + 5);
});

test('短窗口中的各选项卡与多页预览可以独立滚动', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const editor = page.locator('.editor-panel');
  for (const tab of ['内容', '模板', '样式']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await editor.evaluate((el) => {
      el.scrollTop = 0;
    });
    const bounds = await editor.boundingBox();
    await page.mouse.move(bounds!.x + 8, bounds!.y + 100);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => editor.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await editor.evaluate((el) => el.clientHeight)).toBeLessThanOrEqual(522);
  }
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.getByLabel('在此模块前换页').check();
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
  const preview = page.locator('.preview-scroll');
  const bounds = await preview.boundingBox();
  const editorPosition = await editor.evaluate((el) => el.scrollTop);
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 100);
  await page.mouse.wheel(0, 1600);
  await expect.poll(() => preview.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
  expect(await editor.evaluate((el) => el.scrollTop)).toBe(editorPosition);
  await page.mouse.wheel(0, -2500);
  await expect.poll(() => preview.evaluate((el) => el.scrollTop)).toBe(0);
});

test('图标菜单可预览、键盘选择并同步到简历', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  const picker = page.getByRole('button', { name: /标题图标：/ });
  await picker.click();
  const menu = page.getByRole('listbox', { name: '标题图标选项' });
  // 图标集同时供模块标题与基本信息字段使用，新增预设图标会扩展这个列表。
  await expect(menu.getByRole('option')).toHaveCount(icons.length);
  for (const name of [
    '无图标',
    '个人',
    '工作',
    '教育',
    '代码',
    '荣誉',
    '链接',
    '星标',
    '电话',
    '邮箱',
    '网站',
    'GitHub',
    '日期',
    '政治面貌',
    '联系',
    '时间',
    '地点',
  ]) {
    await expect(
      menu.getByRole('option', { name, exact: true }).locator('svg').first(),
    ).toBeAttached();
  }
  await page.screenshot({ path: testInfo.outputPath('icon-picker.png') });
  await menu.getByRole('option', { name: '代码', exact: true }).click();
  await expect(picker).toHaveAccessibleName('标题图标：代码');
  await expect(page.locator('#resume-pages [data-module="summary"] h2 svg')).toHaveClass(
    /lucide-code-xml/,
  );
  await picker.press('ArrowDown');
  await expect(menu.getByRole('option', { name: '代码', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  // End 跳到图标集最后一项。
  await expect(picker).toHaveAccessibleName(`标题图标：${iconLabelOf(icons[icons.length - 1])}`);
  await picker.click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(picker).toBeFocused();
  await picker.click();
  await menu.getByRole('option', { name: '无图标', exact: true }).click();
  await expect(page.locator('#resume-pages [data-module="summary"] h2 svg')).toHaveCount(0);
});
test('编辑、保存、模板切换、模块增删和备份', async ({ page }) => {
  await page.getByLabel('姓名', { exact: true }).fill('张测试');
  await expect(page.locator('#resume-pages h1')).toHaveText('张测试');
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('姓名', { exact: true })).toHaveValue('张测试');
  await page.getByRole('button', { name: '模板', exact: true }).click();
  await page.getByRole('button', { name: '构筑 灵活双栏 · 高效呈现' }).click();
  await expect(page.locator('#resume-pages h1')).toHaveText('张测试');
  await expect(page.locator('#resume-pages .resume-row.split').first()).toBeVisible();
  await page.getByRole('button', { name: '添加模块', exact: true }).click();
  await expect(page.locator('.component-menu button')).toHaveCount(4);
  await page.getByRole('button', { name: '文本框', exact: true }).click();
  await page.getByLabel('Markdown 正文').fill('**==重点成果==**\n\n- 项目\n  - 子项目');
  await expect(page.locator('#resume-pages strong mark')).toHaveText('重点成果');
  await page.getByRole('button', { name: '删除此模块' }).click();
  await expect(page.locator('#resume-pages strong mark')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '备份我的数据' }).click();
  expect((await download).suggestedFilename()).toBe('folio-resume.json');
});
test('手动预览、拖动排序和分页', async ({ page }) => {
  await page.getByLabel('自动更新').uncheck();
  await page.getByLabel('姓名', { exact: true }).fill('手动预览');
  await expect(page.locator('#resume-pages h1')).toHaveText('伊云程');
  await page.getByRole('button', { name: /更新预览/ }).click();
  await expect(page.locator('#resume-pages h1')).toHaveText('手动预览');
  await page.getByLabel('自动更新').check();
  const summary = page
    .locator('.module-item')
    .filter({ has: page.getByRole('button', { name: '关于我', exact: true }) });
  const education = page
    .locator('.module-item')
    .filter({ has: page.getByRole('button', { name: '教育背景', exact: true }) });
  await summary.dragTo(education);
  await expect(page.locator('#resume-pages .resume-section').first()).toHaveAttribute(
    'data-module',
    'experience',
  );
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.getByLabel('在此模块前换页').check();
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
});
test('HTML 和 PDF 导出，字体与图片准备完成', async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
  await page.getByRole('button', { name: '导出简历' }).click();
  const html = page.waitForEvent('download');
  await page.getByRole('button', { name: /独立 HTML/ }).click();
  await (await html).saveAs(testInfo.outputPath('resume.html'));
  await page.getByRole('button', { name: '导出简历' }).click();
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: /保真 PDF/ }).click();
  const download = await pdf;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await download.saveAs(testInfo.outputPath('resume.pdf'));
  await expect(page.getByText('导出完成', { exact: true })).toBeVisible();
  const bytes = await readFile(testInfo.outputPath('resume.pdf'));
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10_000);
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  await offline.goto(pathToFileURL(testInfo.outputPath('resume.html')).href);
  await offline.evaluate(() => document.fonts.ready);
  await expect(offline.locator('.resume-page')).toHaveCount(1);
  await expect(offline.locator('h1')).toHaveText('伊云程');
  await expect(offline.locator('script')).toHaveCount(0);
  await expect(offline.locator('.avatar-resource')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  expect(
    await offline
      .locator('.avatar-resource')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  expect(await offline.evaluate(() => document.fonts.check('12px "Noto Sans SC"'))).toBe(true);
  await offline.screenshot({ path: testInfo.outputPath('offline-html.png'), fullPage: true });
  await offline.pdf({
    path: testInfo.outputPath('print.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
});
test('超长模块阻止导出', async ({ page }) => {
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  await page
    .getByLabel('Markdown 正文')
    .fill(Array.from({ length: 100 }, (_, i) => `- 第 ${i} 项内容`).join('\n'));
  await expect(page.getByRole('alert')).toContainText('超出一页');
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /保真 PDF/ }).click();
  await expect(page.getByText('有模块超出一页，请拆分内容或减小字号后导出')).toBeVisible();
});
test('头像取景与二维码上传随备份恢复', async ({ page }) => {
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 120;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#315b50';
    ctx.fillRect(0, 0, 80, 120);
    ctx.fillStyle = '#eadcaf';
    ctx.fillRect(80, 0, 80, 120);
    return c.toDataURL().split(',')[1];
  });
  const file = {
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  };
  await page.locator('.photo-editor input[type=file]').setInputFiles(file);
  await expect(page.locator('#resume-pages .avatar-picture')).toBeVisible();
  await page.getByRole('button', { name: '方形', exact: true }).click();
  await page.getByLabel('头像水平位置').fill('80');
  await expect(page.locator('#resume-pages .resume-avatar')).toHaveClass(/square/);
  await expect(page.locator('#resume-pages .avatar-picture')).toHaveCSS(
    'background-position',
    '80% 50%',
  );
  await page.getByRole('button', { name: '头像与二维码', exact: true }).click();
  await page.locator('.qr-upload input[type=file]').setInputFiles(file);
  await expect(page.locator('#resume-pages .resume-qr')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await page.reload();
  await expect(page.locator('#resume-pages .resume-qr')).toHaveCount(1);
  await expect(page.locator('#resume-pages .resume-avatar')).toHaveClass(/square/);
});

test('导入校验、独立字体、三模板排版和多页导出', async ({ page }, testInfo) => {
  const uploader = page.locator('input[accept=".json,application/json"]');
  await uploader.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...sample, version: 9 })),
  });
  await expect(page.getByRole('status')).toContainText('导入失败');
  await expect(page.getByLabel('姓名', { exact: true })).toHaveValue('伊云程');
  const custom = structuredClone(sample);
  custom.profile.name = '导入验证';
  custom.modules[2].pageBreak = true;
  custom.modules[0].titleStyle.font = 'serif';
  custom.modules[0].bodyStyle.font = 'source';
  custom.modules[0].body =
    '**==*组合格式*==** 与 **`inline code`**\n\n1. English text\n   - 多层列表';
  custom.theme.font = 'inter';
  await uploader.setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(custom)),
  });
  await expect(page.locator('#resume-pages h1')).toHaveText('导入验证');
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
  await expect(page.locator('#resume-pages strong mark em')).toHaveText('组合格式');
  await page.getByRole('button', { name: '模板', exact: true }).click();
  for (const name of [
    '青序 清晰层次 · 现代留白',
    '书简 居中抬头 · 经典沉稳',
    '构筑 灵活双栏 · 高效呈现',
  ]) {
    await page.getByRole('button', { name }).click();
    const template = name.startsWith('青序')
      ? 'editorial'
      : name.startsWith('书简')
        ? 'classic'
        : 'compact';
    await expect(page.locator('.resume-document')).toHaveClass(new RegExp(`template-${template}`));
    await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#resume-pages h1')).toHaveText('导入验证');
    await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
    await page
      .locator('#resume-pages .resume-page')
      .first()
      .screenshot({ path: testInfo.outputPath(`${name.slice(0, 2)}.png`) });
  }
  await page.getByRole('button', { name: '导出简历' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /保真 PDF/ }).click();
  await (await downloaded).saveAs(testInfo.outputPath('two-pages.pdf'));
});

test('多字段图标、长链接与经历左右 / 左中右布局', async ({ page }, testInfo) => {
  for (const [i, field] of sample.profile.fields.entries()) {
    await page
      .getByLabel(`第 ${i + 1} 项字段内容`)
      .fill(
        field.id === 'website'
          ? 'https://portfolio.example.test/' + 'long-path-'.repeat(12)
          : `${field.label}示例`,
      );
  }
  await page.getByLabel('信息列数').selectOption('3');
  await expect(page.locator('#resume-pages .resume-contact-item svg')).toHaveCount(12);
  const contact = page.locator('#resume-pages .resume-contact');
  expect(await contact.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '教育背景', exact: true }).click();
  await page.getByLabel('学校', { exact: true }).fill('示例大学');
  await page.getByLabel('学历 / 学位').fill('硕士');
  await page.getByLabel('培养方式').fill('全日制');
  await page.getByLabel('专业', { exact: true }).fill('计算机技术');
  await page.getByLabel('开始时间').fill('2023.09');
  await page.getByLabel('结束时间').fill('2026.06');
  await page.getByLabel('第 1 条教育背景详情').fill('- **主修课程**：软件工程\n  - 数据结构');
  const section = page.locator('#resume-pages [data-module="education"]');
  await expect(section.locator('.entry-main')).toContainText('示例大学 · 硕士');
  await page.getByLabel('经历标题布局').selectOption('left-center-right');
  await expect(section.locator('.entry-main')).toHaveText('示例大学');
  await expect(section.locator('.entry-middle')).toContainText('计算机技术');
  await expect(section.locator('.entry-meta')).toContainText('2023.09 — 2026.06');
  await page.getByRole('button', { name: '添加教育背景', exact: true }).click();
  await page.getByLabel('学校', { exact: true }).nth(1).fill('第二大学');
  await page.getByRole('button', { name: '上移第 2 条教育背景' }).click();
  await expect(section.locator('.entry-main').first()).toHaveText('第二大学');
  await page.getByRole('button', { name: '删除第 1 条教育背景' }).click();
  await expect(section.locator('.resume-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '导出简历' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /独立 HTML/ }).click();
  await (await downloaded).saveAs(testInfo.outputPath('structured.html'));
  const offline = await page.context().newPage();
  await offline.goto(pathToFileURL(testInfo.outputPath('structured.html')).href);
  await offline.evaluate(() => document.fonts.ready);
  for (const [i, paper] of (await offline.locator('.resume-page').all()).entries()) {
    await paper.screenshot({ path: testInfo.outputPath(`structured-${i + 1}.png`) });
  }
});

test('浮动图片缩放拖动、跨页、键盘、隐藏、备份与导出', async ({ page }, testInfo) => {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#315b50';
    ctx.fillRect(20, 20, 80, 80);
    return canvas.toDataURL();
  });
  const doc = structuredClone(sample);
  doc.profile.photo = image;
  doc.media.qr.image = image;
  doc.media.qr.top = 880;
  doc.media.qr.left = 620;
  doc.modules[2].pageBreak = true;
  await page.locator('input[accept=".json,application/json"]').setInputFiles({
    name: 'media.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
  await page.getByRole('button', { name: '头像与二维码', exact: true }).click();
  const avatar = page.getByRole('button', { name: '移动头像', exact: true });
  await avatar.scrollIntoViewIfNeeded();
  const rect = (await avatar.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 - 78, rect.y + rect.height / 2 + 39, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByLabel('头像横坐标', { exact: true })).toHaveValue('536');
  await expect(page.getByLabel('头像纵坐标', { exact: true })).toHaveValue('110');
  const moved = (await avatar.boundingBox())!;
  await page.mouse.move(moved.x + 15, moved.y + 15);
  await page.mouse.down();
  await page.mouse.move(moved.x + 40, moved.y + 40);
  await avatar.dispatchEvent('pointercancel');
  await page.mouse.up();
  await expect(page.getByLabel('头像横坐标', { exact: true })).toHaveValue('536');
  await avatar.press('Shift+ArrowRight');
  await expect(page.getByLabel('头像横坐标', { exact: true })).toHaveValue('546');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('头像横坐标', { exact: true })).toHaveValue('536');
  await page.getByLabel('头像横坐标', { exact: true }).fill('636');
  await page.getByLabel('头像纵坐标', { exact: true }).fill('60');
  await page.getByLabel('二维码页码', { exact: true }).fill('3');
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(3);
  await page.getByLabel('显示二维码', { exact: true }).uncheck();
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
  await page.getByLabel('显示二维码', { exact: true }).check();
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(3);
  await page.getByLabel('二维码页码', { exact: true }).fill('2');
  await expect(
    page.locator('#resume-pages .resume-page').nth(1).locator('[data-media="qr"]'),
  ).toHaveCount(1);
  await page.getByLabel('显示二维码', { exact: true }).uncheck();
  await expect(page.locator('#resume-pages [data-media="qr"]')).toHaveCount(0);
  await page.getByLabel('显示二维码', { exact: true }).check();
  await page.getByLabel('二维码尺寸', { exact: true }).fill('120');
  await page.getByLabel('二维码横坐标', { exact: true }).fill('999');
  await expect(page.getByLabel('二维码横坐标', { exact: true })).toHaveValue('674');
  await page.getByLabel('二维码横坐标', { exact: true }).fill('600');
  // Drag from page 2 back onto page 1 at a reduced preview scale.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '缩小预览' }).click();
  await page.locator('.preview-scroll').evaluate((el) => {
    el.scrollTop = 0;
  });
  const qr = page.getByRole('button', { name: '移动二维码', exact: true });
  await qr.scrollIntoViewIfNeeded();
  const q = (await qr.boundingBox())!;
  const first = (await page.locator('#resume-pages .resume-page').first().boundingBox())!;
  await page.mouse.move(q.x + 10, q.y + 10);
  await page.mouse.down();
  await page.mouse.move(first.x + 230, first.y + 340, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel('二维码页码', { exact: true })).toHaveValue('1');
  await page.getByLabel('二维码页码', { exact: true }).fill('2');
  await page.getByLabel('二维码纵坐标', { exact: true }).fill('880');
  await page.getByLabel('二维码横坐标', { exact: true }).fill('600');
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await page.reload();
  await expect(
    page.locator('#resume-pages .resume-page').nth(1).locator('[data-media="qr"]'),
  ).toHaveCSS('left', '600px');
  for (const [name, filename] of [
    ['独立 HTML', 'floating.html'],
    ['保真 PDF', 'floating.pdf'],
  ]) {
    await page.getByRole('button', { name: '导出简历' }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await (await downloaded).saveAs(testInfo.outputPath(filename));
  }
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printPages = String(
        document.querySelectorAll('.print-root .resume-page').length,
      );
      document.documentElement.dataset.printImages = String(
        document.querySelectorAll('.print-root [data-media]').length,
      );
    };
  });
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /打印 \/ 文字 PDF/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-pages', '2');
  await expect(page.locator('html')).toHaveAttribute('data-print-images', '2');
  await expect(page.locator('.print-root')).toHaveCount(0);
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  await offline.goto(pathToFileURL(testInfo.outputPath('floating.html')).href);
  await offline.evaluate(() => document.fonts.ready);
  await expect(offline.locator('[data-media][role="button"]')).toHaveCount(0);
  await expect(offline.locator('.resume-page').nth(1).locator('[data-media="qr"]')).toHaveCSS(
    'left',
    '600px',
  );
  await offline.screenshot({ path: testInfo.outputPath('floating-html.png'), fullPage: true });
  await offline.pdf({
    path: testInfo.outputPath('floating-print.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test('页眉页脚可修改关闭，切换模板后保留', async ({ page }) => {
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('页眉内容', { exact: true }).fill('个人履历');
  await page.getByLabel('页脚标识 / ID', { exact: true }).fill('候选编号：DEMO-001');
  await page.getByLabel('页码格式', { exact: true }).fill('第 {page} 页 / 共 {pages} 页');
  await expect(page.locator('#resume-pages .resume-eyebrow')).toHaveText('个人履历');
  await expect(page.locator('#resume-pages .resume-footer')).toContainText('第 1 页 / 共 1 页');
  await page.getByRole('button', { name: '模板', exact: true }).click();
  await page.getByRole('button', { name: '书简 居中抬头 · 经典沉稳' }).click();
  await expect(page.locator('#resume-pages .resume-eyebrow')).toBeVisible();
  await page.getByRole('button', { name: '样式', exact: true }).click();
  for (const label of ['显示页眉', '显示页脚标识', '显示页码'])
    await page.getByLabel(label, { exact: true }).uncheck();
  await expect(page.locator('#resume-pages .resume-eyebrow')).toHaveCount(0);
  await expect(page.locator('#resume-pages .resume-footer')).toHaveCount(0);
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await page.reload();
  await expect(page.locator('#resume-pages .resume-footer')).toHaveCount(0);
});

test('窄屏编辑与预览滚轮、放大后的输入字号', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('姓名', { exact: true })).toHaveCSS('font-size', '14px');
  const editor = page.locator('.editor-panel');
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => editor.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.getByLabel('在此模块前换页').check();
  await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
  const preview = page.locator('.preview-scroll');
  await preview.scrollIntoViewIfNeeded();
  const p = (await preview.boundingBox())!;
  await page.mouse.move(p.x + 100, p.y + 100);
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => preview.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
