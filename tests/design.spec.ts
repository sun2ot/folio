import { test, expect } from '@playwright/test';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('全局预设颜色独立并呈现选择结果', async ({ page }, testInfo) => {
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
});

test('三类模块标题布局和新增项目名称一致', async ({ page }) => {
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
