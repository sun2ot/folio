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

test('姓名、模块标题与正文颜色可分别定义，并可被全局主题色接管', async ({ page }) => {
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
  await page.getByLabel('自定义主题色').fill('#2c466b');
  await expect(page.locator('#resume-pages [data-module="skills"] h2')).toHaveCSS(
    'color',
    await toRgb('#2c466b'),
  );
  await expect(name).toHaveCSS('color', await toRgb('#101820'));
  await expect(title).toHaveCSS('color', await toRgb('#2f6b4f'));
  // 恢复跟随全局。
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await page.getByRole('button', { name: '姓名颜色恢复跟随全局' }).click();
  await expect(name).toHaveCSS('color', await toRgb('#2c466b'));
});

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
        owner: { login: 'sun2ot' },
        name: 'folio',
        description: '纯前端、本地优先的简历工作室。',
        stargazers_count: 128,
        forks_count: 6,
        language: 'TypeScript',
      }),
    }),
  );
  await page.route('https://github.com/*.png*', (route) =>
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
  await page.getByRole('button', { name: /备份我的数据/ }).click();
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
