import { test, expect } from '@playwright/test';
import { floatingDocument } from './fixtures';
import { openApp, importDocument, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('损坏图片上传失败时保留已有头像', async ({ page }) => {
  const avatar = page.locator('#resume-pages .avatar-resource');
  const original = await avatar.getAttribute('src');
  await page.locator('.photo-editor input[type=file]').setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a PNG'),
  });
  await expect(
    page.getByRole('status').filter({ hasText: /无法解码|cannot be decoded|source image/i }),
  ).toBeVisible();
  await expect(avatar).toHaveAttribute('src', original!);
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
test.describe('浮动图片', () => {
  test.beforeEach(async ({ page }) => {
    await importDocument(page, await floatingDocument(page));
    await expect(page.locator('#resume-pages .resume-page')).toHaveCount(2);
    await page.getByRole('button', { name: '头像与二维码', exact: true }).click();
  });

  test('缩放拖动、取消与键盘移动各自可撤销', async ({ page }) => {
    const avatar = page.getByRole('button', { name: '移动头像', exact: true });
    await avatar.scrollIntoViewIfNeeded();
    const rect = (await avatar.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 - 78, rect.y + rect.height / 2 + 39, {
      steps: 8,
    });
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
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(page.getByLabel('头像横坐标', { exact: true })).toHaveValue('636');
    await expect(page.getByLabel('头像纵坐标', { exact: true })).toHaveValue('60');
  });

  test('页码、隐藏和坐标边界保存后保持一致', async ({ page }) => {
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
    await saved(page);
    await page.reload();
    await expect(
      page.locator('#resume-pages .resume-page').nth(1).locator('[data-media="qr"]'),
    ).toHaveCSS('left', '600px');
  });

  test('缩小预览后可从第二页拖回第一页', async ({ page }) => {
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
  });
});
