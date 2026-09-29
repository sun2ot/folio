import { expect, type Page } from '@playwright/test';

/**
 * 上一条用例可能仍在导出：导出期间编辑器面板是 inert 的，
 * 此时点击不会生效，而且预览也不会更新，因此先等导出结束、自动保存完成。
 */
export async function openApp(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => {
    const workspace = document.querySelector('main.workspace');
    return !!workspace && !workspace.hasAttribute('inert');
  });
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
  await expect(page.locator('.resume-document')).toHaveAttribute('data-ready', 'true');
}

/** 等待 500ms 防抖保存完成，避免紧接着刷新时丢掉最后一次修改。 */
export async function saved(page: Page) {
  await expect(page.getByText('已保存在此浏览器')).toBeVisible();
}
