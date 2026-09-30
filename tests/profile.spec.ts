import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { sample } from '../src/model';
import { openApp, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('基本信息字段可改名、换图标、删除与插入', async ({ page }) => {
  const contact = page.locator('#resume-pages .resume-contact');
  // 示例把预设「出生日期」改成了「生日」，说明标签不是固定枚举。
  await expect(contact).toContainText('生日：1996.08');
  const birth = sample.profile.fields.findIndex((f) => f.id === 'birthDate');
  await page.getByLabel(`第 ${birth + 1} 项字段名称`).fill('出生年月');
  // 预览有 220ms 防抖，断言会自动等待重排完成。
  await expect(contact).toContainText('出生年月：1996.08');
  await expect(contact).not.toContainText('生日：');
  // 图标可换：换成旗帜后按钮的可访问名称同步变化。
  await page.getByLabel(`第 ${birth + 1} 项图标：日期`).click();
  await page.getByRole('option', { name: '政治面貌' }).click();
  await expect(page.getByLabel(`第 ${birth + 1} 项图标：政治面貌`)).toBeVisible();
  const items = page.locator('#resume-pages .resume-contact-item');
  const before = await items.count();
  await page.getByRole('button', { name: `删除第 ${birth + 1} 项信息字段` }).click();
  await expect(items).toHaveCount(before - 1);
  // 插入一个预设字段与一个空白字段。
  await page.getByRole('button', { name: '插入信息字段' }).click();
  await page.getByRole('button', { name: '民族', exact: true }).click();
  await page.getByLabel(`第 ${sample.profile.fields.length} 项字段内容`).fill('汉族');
  await expect(contact).toContainText('民族：汉族');
  await page.getByRole('button', { name: '插入信息字段' }).click();
  await page.getByRole('button', { name: '空白字段' }).click();
  const last = sample.profile.fields.length + 1;
  await page.getByLabel(`第 ${last} 项字段名称`).fill('期望城市');
  await page.getByLabel(`第 ${last} 项字段内容`).fill('杭州');
  await expect(contact).toContainText('期望城市：杭州');
  // 上移改变顺序：期望城市跑到「民族」之前（预览只渲染有内容的字段）。
  await page.getByRole('button', { name: `上移第 ${last} 项信息字段` }).click();
  await expect(items.filter({ hasText: '期望城市' })).toHaveCount(1);
  await expect
    .poll(async () => (await items.allInnerTexts()).join('|'))
    .toMatch(/期望城市：杭州\|民族：汉族/);
  await saved(page);
  await page.reload();
  // 删除、改名、换图标与插入的顺序结果都随文档保存。
  await expect(page.locator('#resume-pages .resume-contact')).not.toContainText('出生年月');
  await expect(page.locator('#resume-pages .resume-contact')).toContainText('期望城市：杭州');
  await expect(page.getByLabel(`第 ${last - 1} 项字段名称`)).toHaveValue('期望城市');
  await expect(page.getByLabel(`第 ${last} 项字段名称`)).toHaveValue('民族');
  await expect(page.getByLabel(`第 ${last - 1} 项图标：星标`)).toBeVisible();
});

test('标题与正文全局色独立，恢复继承时取色按钮与预览同步', async ({ page }) => {
  const name = page.locator('#resume-pages .resume-header h1');
  const title = page.locator('#resume-pages [data-module="projects"] h2');
  const body = page.locator('#resume-pages [data-module="projects"] .resume-body');
  const toRgb = (probe: string) =>
    page.evaluate((value) => {
      const el = document.createElement('span');
      el.style.color = value;
      document.body.append(el);
      const color = getComputedStyle(el).color;
      el.remove();
      return color;
    }, probe);
  // 默认三者都跟随主题色。
  const themeColor = await toRgb(sample.theme.textColor);
  await expect(name).toHaveCSS('color', themeColor);
  await expect(title).toHaveCSS('color', themeColor);
  await expect(body).toHaveCSS('color', themeColor);
  // 单独设置姓名颜色。
  await page.locator('.color-field input[aria-label="姓名颜色取色"]').fill('#101820');
  await expect(name).toHaveCSS('color', await toRgb('#101820'));
  await expect(title).toHaveCSS('color', themeColor);
  // 单独设置模块标题与正文颜色。
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.locator('.color-field input[aria-label="标题颜色取色"]').fill('#2f6b4f');
  await page.locator('.color-field input[aria-label="正文颜色取色"]').fill('#7d4651');
  await expect(title).toHaveCSS('color', await toRgb('#2f6b4f'));
  await expect(body).toHaveCSS('color', await toRgb('#7d4651'));
  // 其他模块不受影响。
  await expect(page.locator('#resume-pages [data-module="skills"] h2')).toHaveCSS(
    'color',
    themeColor,
  );
  // 全局主题色只影响未单独设置的模块。
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('全局标题颜色取色').fill('#2c466b');
  await page.getByLabel('全局正文颜色取色').fill('#866339');
  await expect(page.locator('#resume-pages [data-module="skills"] h2')).toHaveCSS(
    'color',
    await toRgb('#2c466b'),
  );
  await expect(name).toHaveCSS('color', await toRgb('#101820'));
  await expect(title).toHaveCSS('color', await toRgb('#2f6b4f'));
  await expect(page.locator('#resume-pages [data-module="skills"] .resume-body')).toHaveCSS(
    'color',
    await toRgb('#866339'),
  );
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  await page.getByRole('button', { name: '标题颜色恢复跟随全局' }).click();
  await page.getByRole('button', { name: '正文颜色恢复跟随全局' }).click();
  await expect(page.getByLabel('标题颜色取色', { exact: true })).toHaveValue('#2c466b');
  await expect(page.getByLabel('正文颜色取色', { exact: true })).toHaveValue('#866339');
  await expect(page.getByRole('button', { name: '标题颜色恢复跟随全局' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '正文颜色恢复跟随全局' })).toBeDisabled();
  await expect(title).toHaveCSS('color', await toRgb('#2c466b'));
  await expect(body).toHaveCSS('color', await toRgb('#866339'));
  // 恢复跟随全局。
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await page.getByRole('button', { name: '姓名颜色恢复跟随全局' }).click();
  await expect(name).toHaveCSS('color', await toRgb('#2c466b'));
  await expect(page.getByLabel('姓名颜色取色')).toHaveValue('#2c466b');
});

test('信息颜色按稳定 ID 保存，模板、JSON、离线 HTML、PDF 与打印保留颜色', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.getByLabel('求职意向颜色取色').fill('#7d4651');
  await page.getByLabel('第 1 项颜色取色', { exact: true }).fill('#2f6b4f');
  const contact = page
    .locator('#resume-pages .resume-contact-item')
    .filter({ hasText: '联系电话' });
  await expect(contact).toHaveCSS('color', 'rgb(47, 107, 79)');
  await expect(contact.locator('svg')).toHaveCSS('color', 'rgb(47, 107, 79)');
  await page.getByRole('button', { name: '下移第 1 项信息字段', exact: true }).click();
  await expect(page.getByLabel('第 2 项颜色取色', { exact: true })).toHaveValue('#2f6b4f');
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('全局标题颜色取色').fill('#2c466b');
  await page.getByLabel('全局正文颜色取色').fill('#866339');
  for (const template of [
    '书简 居中抬头 · 经典沉稳',
    '构筑 灵活双栏 · 高效呈现',
    '青序 清晰层次 · 现代留白',
  ]) {
    await page.getByRole('button', { name: '模板', exact: true }).click();
    await page.getByRole('button', { name: template }).click();
    await expect(contact).toHaveCSS('color', 'rgb(47, 107, 79)');
    await expect(page.locator('#resume-pages .resume-role')).toHaveCSS('color', 'rgb(125, 70, 81)');
    await expect(page.locator('#resume-pages h1')).toHaveCSS('color', 'rgb(44, 70, 107)');
  }
  await saved(page);
  await page.reload();
  await expect(page.getByLabel('第 2 项颜色取色', { exact: true })).toHaveValue('#2f6b4f');
  await expect(page.getByLabel('求职意向颜色取色')).toHaveValue('#7d4651');
  await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
  for (const [kind, file] of [
    ['JSON 数据备份', 'colors.json'],
    ['独立 HTML', 'colors.html'],
    ['保真 PDF', 'colors.pdf'],
  ]) {
    await page.getByRole('button', { name: '导出简历' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(kind) }).click();
    await (await download).saveAs(testInfo.outputPath(file));
  }
  const backup = JSON.parse(await readFile(testInfo.outputPath('colors.json'), 'utf8'));
  expect(backup.theme).toMatchObject({ titleColor: '#2c466b', textColor: '#866339' });
  expect(backup.profile.roleColor).toBe('#7d4651');
  expect(backup.profile.fields.find((field: { id: string }) => field.id === 'phone').color).toBe(
    '#2f6b4f',
  );
  await page.evaluate(() => {
    window.print = () => {
      const root = document.querySelector('.print-root')!;
      document.documentElement.dataset.printTitleColor = getComputedStyle(
        root.querySelector('h1')!,
      ).color;
      document.documentElement.dataset.printRoleColor = getComputedStyle(
        root.querySelector('.resume-role')!,
      ).color;
    };
  });
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /打印 \/ 文字 PDF/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-title-color', 'rgb(44, 70, 107)');
  await expect(page.locator('html')).toHaveAttribute('data-print-role-color', 'rgb(125, 70, 81)');
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  await offline.goto(pathToFileURL(testInfo.outputPath('colors.html')).href);
  await offline.evaluate(() => document.fonts.ready);
  await expect(offline.locator('h1')).toHaveCSS('color', 'rgb(44, 70, 107)');
  await expect(offline.locator('[data-module="summary"] .resume-body')).toHaveCSS(
    'color',
    'rgb(134, 99, 57)',
  );
  await expect(offline.locator('.resume-contact-item').filter({ hasText: '联系电话' })).toHaveCSS(
    'color',
    'rgb(47, 107, 79)',
  );
  await offline.screenshot({ path: testInfo.outputPath('colors-html.png'), fullPage: true });
  await offline.pdf({
    path: testInfo.outputPath('colors-print.pdf'),
    preferCSSPageSize: true,
    printBackground: true,
  });
});

for (const width of [1440, 1024, 390]) {
  test(`颜色控件布局稳定且字号完整，${width}px 屏幕滚轮可用`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: '精选项目', exact: true }).click();
    const picker = page.getByLabel('标题颜色取色', { exact: true });
    await picker.scrollIntoViewIfNeeded();
    const before = await picker.boundingBox();
    await picker.fill('#abcdef');
    const after = await picker.boundingBox();
    expect(after).toEqual(before);
    expect(after!.width).toBe(32);
    expect(after!.height).toBe(32);
    await expect(picker).toHaveCSS('border-radius', '50%');
    const reset = page.getByRole('button', { name: '标题颜色恢复跟随全局' });
    await expect(reset).toHaveCSS('border-top-width', '1px');
    await reset.click();
    await expect(reset).toBeDisabled();
    await expect(reset).toHaveCSS('color', 'rgb(160, 167, 156)');
    const size = page.getByLabel('标题字号', { exact: true });
    await size.selectOption('30');
    expect((await size.boundingBox())!.width).toBeGreaterThan(45);
    expect((await size.locator('..').boundingBox())!.width).toBe(70);
    expect((await size.boundingBox())!.height).toBe(40);
    const fontBox = (await page.getByLabel('标题字体', { exact: true }).boundingBox())!;
    const sizeBox = (await size.boundingBox())!;
    const colorBox = (await picker.boundingBox())!;
    expect(Math.abs(fontBox.y - sizeBox.y)).toBeLessThan(1);
    expect(Math.abs(sizeBox.y + 4 - colorBox.y)).toBeLessThan(1);
    await expect(size).toHaveValue('30');
    await size.selectOption('15');
    const editor = page.locator('.editor-panel');
    await editor.evaluate((el) => {
      el.scrollTop = 0;
    });
    const box = (await editor.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 130);
    await page.mouse.wheel(0, 1400);
    await expect.poll(() => editor.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await page.screenshot({
      path: testInfo.outputPath(`color-controls-${width}.png`),
      fullPage: true,
    });
    expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '基本信息', exact: true }).click();
    await page.getByLabel('姓名', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`profile-colors-${width}.png`),
      fullPage: true,
    });
    expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

test('仓库卡片使用作者头像，且不在简历上显示快照日期标记', async ({ page }, testInfo) => {
  const image = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#315b50';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#f8e8ab';
    ctx.fillRect(16, 16, 32, 32);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    );
    const buffer = await blob.arrayBuffer();
    return [...new Uint8Array(buffer)];
  });
  // 只拦截 GitHub，其余请求（本地字体分片）保持直连。
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        owner: {
          login: 'sun2ot',
          id: 12345,
          avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
        },
        name: 'folio',
        description: '纯前端、本地优先的简历工作室。',
        stargazers_count: 128,
        forks_count: 6,
        language: 'TypeScript',
      }),
    }),
  );
  await page.route('https://avatars.githubusercontent.com/u/12345*', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(image) }),
  );
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const editor = page.locator('details.repository-editor').first();
  await editor.locator('summary').filter({ hasText: 'GitHub 仓库卡片' }).click();
  await editor.getByLabel('显示仓库卡片').check();
  await editor.getByLabel('允许联网搜索 / 刷新').check();
  await editor.getByRole('textbox', { name: /GitHub 链接/ }).fill('sun2ot/folio');
  await editor.getByRole('button', { name: '搜索 / 刷新仓库' }).click();
  await editor.getByRole('button', { name: /sun2ot\/folio/ }).click();
  await expect(editor.getByRole('status')).toContainText('已保存');
  const card = page.locator('#resume-pages [data-module="projects"] .resume-repository').first();
  await expect(card).toContainText('★ 128 Star');
  const avatar = card.locator('img.repository-avatar');
  await expect(avatar).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(
    await avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  // 卡片上不再出现快照日期，改为作者头像 + 名称。
  await expect(card.locator('.repository-stats')).not.toContainText('快照');
  await expect(card.locator('.repository-stats')).not.toContainText('手动信息');
  await expect(card.locator('.repository-title')).toContainText('sun2ot');
  await page.screenshot({ path: testInfo.outputPath('repository-avatar.png'), fullPage: true });
  // 头像随备份与离线 HTML 一起带走，不需要再联网。
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /JSON 数据备份/ }).click();
  const json = testInfo.outputPath('avatar-card.json');
  await (await backup).saveAs(json);
  const doc = JSON.parse(await readFile(json, 'utf8'));
  const projects = doc.modules.find((m: { field: string }) => m.field === 'projects');
  expect(projects.entries[0].github.snapshot.avatar).toMatch(/^data:image\/png;base64,/);
  await page.getByRole('button', { name: '导出简历' }).click();
  const html = page.waitForEvent('download');
  await page.getByRole('button', { name: /独立 HTML/ }).click();
  const htmlPath = testInfo.outputPath('avatar-card.html');
  await (await html).saveAs(htmlPath);
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  await offline.goto(pathToFileURL(htmlPath).href);
  await expect(offline.locator('.resume-repository img.repository-avatar')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  await expect(offline.locator('.repository-stats')).not.toContainText('快照');
  await page.context().setOffline(false);
});
