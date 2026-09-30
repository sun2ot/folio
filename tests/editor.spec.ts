import { test, expect } from '@playwright/test';
import { icons } from '../src/model';
import { openApp } from './helpers';

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

test('图标菜单可预览、键盘选择并同步到简历', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '关于我', exact: true }).click();
  const picker = page.getByRole('button', { name: /标题图标：/ });
  await picker.click();
  const menu = page.getByRole('listbox', { name: '标题图标选项' });
  // 图标目录按页展示，不能为完整图标库一次创建全部 SVG。
  await expect(menu.getByRole('option')).toHaveCount(60);
  await expect(page.locator('.icon-pagination')).toContainText(`${icons.length} 个`);
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
  await expect(page.locator('#resume-pages [data-module="summary"] h2 svg')).toHaveCount(1);
  await picker.press('ArrowDown');
  await expect(menu.getByRole('option', { name: '代码', exact: true })).toBeFocused();
  const last = await menu.getByRole('option').last().getAttribute('aria-label');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  // End 跳到当前页最后一项。
  await expect(picker).toHaveAccessibleName(`标题图标：${last}`);
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
  await page.getByRole('button', { name: '导出简历' }).click();
  await page.getByRole('button', { name: /JSON 数据备份/ }).click();
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

test('页眉页脚可修改关闭，切换模板后保留', async ({ page }) => {
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('页眉内容', { exact: true }).fill('个人履历');
  await page.getByLabel('页脚标识 / ID', { exact: true }).fill('候选编号：DEMO-001');
  await page.getByLabel('页码格式', { exact: true }).fill('第 {page} 页 / 共 {pages} 页');
  await expect(page.locator('#resume-pages .resume-eyebrow')).toHaveText('个人履历');
  await expect(page.locator('#resume-pages .resume-footer').first()).toContainText(
    '第 1 页 / 共 2 页',
  );
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
