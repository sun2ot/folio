import { test, expect } from '@playwright/test';
import { openApp, exportFile, withOfflineHTML } from './helpers';

test('静态发布包包含项目、依赖许可和对应源码说明', async ({ request }) => {
  for (const [path, content] of [
    ['/LICENSE', 'GNU GENERAL PUBLIC LICENSE'],
    ['/SOURCE.txt', 'folio-source.tar.gz'],
    ['/licenses/THIRD_PARTY.md', 'react@'],
    ['/licenses/Inter-OFL.txt', 'SIL OPEN FONT LICENSE'],
  ]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(await response.text()).toContain(content);
  }
});

test('子路径部署能加载默认图片、字体和导出动态模块', async ({ page }, info) => {
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await openApp(page, 'http://127.0.0.1:4174/folio/');
  await expect(page.locator('#resume-pages .avatar-resource')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  const html = await exportFile(page, info, 'html', 'subpath.html');
  await withOfflineHTML(page, html, async (offline) => {
    await expect(offline.locator('.resume-page')).toHaveCount(1);
    await expect(offline.locator('h1')).not.toBeEmpty();
    expect(
      await offline.evaluate(() => [...document.fonts].some((face) => face.status === 'loaded')),
    ).toBe(true);
  });
  expect(failed).toEqual([]);
});
