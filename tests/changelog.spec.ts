import { test, expect } from '@playwright/test';
import packageMetadata from '../package.json' with { type: 'json' };
import { changelog } from '../src/changelog';
import { openApp } from './helpers';

const { version } = packageMetadata;

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`更新日志离线打开、倒序版本、键盘关闭与真实滚轮 ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openApp(page);
    await page.context().setOffline(true);
    const trigger = page.getByRole('button', { name: '更新日志', exact: true });
    await trigger.scrollIntoViewIfNeeded();
    await expect(page.getByLabel(`当前版本 v${version}`, { exact: true })).toBeVisible();
    const github = (await page
      .getByRole('link', { name: 'GitHub 仓库，作者 sun2ot' })
      .boundingBox())!;
    const blog = (await page
      .getByRole('link', { name: 'sun2ot 的博客 abdc.net.cn' })
      .boundingBox())!;
    const button = (await trigger.boundingBox())!;
    expect(button.x).toBeGreaterThan(blog.x);
    expect(blog.x).toBeGreaterThan(github.x);
    expect(button.y).toBe(blog.y);
    await page.screenshot({ path: testInfo.outputPath('changelog-entry.png'), fullPage: true });

    await trigger.focus();
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: '更新日志', exact: true });
    const close = dialog.getByRole('button', { name: '关闭更新日志' });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expect(dialog).toContainText(`当前版本 v${version}`);
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(
      changelog.map((entry) => `v${entry.version}`),
    );
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('版本记录')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    const content = dialog.getByLabel('版本记录');
    const box = (await content.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await page.mouse.wheel(0, -10000);
    await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('changelog-dialog.png') });
    const dimensions = await dialog.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      overflowing: el.scrollWidth > el.clientWidth,
    }));
    expect(dimensions.width).toBeLessThan(viewport.width);
    expect(dimensions.height).toBeLessThan(viewport.height);
    expect(dimensions.overflowing).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.press('Space');
    await close.click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}
