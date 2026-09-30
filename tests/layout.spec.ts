import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { sample } from '../src/model';
import { openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
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
      await page
        .getByLabel(
          `${id === 'experience' ? '工作经历' : id === 'projects' ? '项目' : '教育背景'}标题布局`,
          { exact: true },
        )
        .selectOption(layout);
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
    expect(await editor.evaluate((el) => el.clientHeight)).toBeLessThan(600);
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
  await expect(page.locator('#resume-pages .resume-contact-item svg')).toHaveCount(
    sample.profile.fields.length,
  );
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
  await page.getByLabel('教育背景标题布局').selectOption('left-center-right');
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
