import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sample } from '../src/model';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
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
  await expect(menu.getByRole('option')).toHaveCount(8);
  for (const name of ['无图标', '个人', '工作', '教育', '代码', '荣誉', '链接', '星标']) {
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
  await expect(picker).toHaveAccessibleName('标题图标：星标');
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
  await page.getByRole('button', { name: '多层列表', exact: true }).click();
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
  await page.getByRole('button', { name: '添加模块', exact: true }).click();
  await page.getByRole('button', { name: '二维码', exact: true }).click();
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
