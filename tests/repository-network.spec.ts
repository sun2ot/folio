import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { documentSchema, sample } from '../src/model';
import { openApp, importDocument, exportFile } from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('取消已下载但仍在解码的头像，不让旧结果覆盖新仓库', async ({ page }, info) => {
  const doc = structuredClone(sample);
  doc.modules.find((module) => module.kind === 'projects')!.entries[0].github = {
    visible: true,
    snapshot: {
      owner: 'fixture',
      name: 'first',
      ownerId: 12345,
      description: '',
      language: '',
      stars: null,
      forks: null,
      avatar: '',
      fetchedAt: null,
    },
  };
  await importDocument(page, documentSchema.parse(doc));
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    canvas.getContext('2d')!.fillRect(0, 0, 32, 32);
    return [
      ...Uint8Array.from(atob(canvas.toDataURL().split(',')[1]), (char) => char.charCodeAt(0)),
    ];
  });
  await page.route('https://avatars.githubusercontent.com/u/12345*', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(image) }),
  );
  await page.evaluate(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (!this.src.startsWith('blob:')) return;
      document.documentElement.dataset.avatarDecoding = 'true';
      await new Promise<void>((resolve) => {
        Object.assign(window, { finishAvatar: resolve });
      });
    };
  });
  await page.getByRole('button', { name: '精选项目', exact: true }).click();
  const editor = page.locator('details.repository-editor').first();
  await editor.getByLabel('允许联网搜索 / 刷新').check();
  await editor.getByRole('button', { name: '获取作者头像' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-avatar-decoding', 'true');
  await editor.getByRole('textbox', { name: /GitHub 链接/ }).fill('fixture/second');
  await editor.getByRole('button', { name: '手动填写卡片' }).click();
  // 网络已经完成，AbortSignal 无法取消图片解码；保存逻辑必须拒绝这次旧结果。
  await page.evaluate(async () => {
    const finish = (window as Window & { finishAvatar?: () => void }).finishAvatar;
    if (!finish) throw new Error('头像解码尚未进入等待状态');
    finish();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await expect(editor.locator('.repository-summary')).toContainText('fixture/second');
  const json = await exportFile(page, info, 'json', 'latest-card.json');
  const backup = JSON.parse(await readFile(json, 'utf8'));
  const snapshot = backup.modules.find((module: { kind: string }) => module.kind === 'projects')
    .entries[0].github.snapshot;
  expect(snapshot).toMatchObject({ owner: 'fixture', name: 'second', avatar: '' });
});
