import { test, expect, type Locator } from '@playwright/test';
import { documentSchema, sample, type Resume } from '../src/model';
import { exportFile, importDocument, openApp, saved, ready, withOfflineHTML } from './helpers';
import { assertPDF } from './pdf';

async function assertContactLayout(
  root: Locator,
  fields: Resume['profile']['fields'],
  singleLine: boolean,
) {
  const items = root.locator('.resume-contact-item');
  await expect(items).toHaveCount(fields.length);
  for (const [index, field] of fields.entries()) {
    const item = items.nth(index);
    await expect(item).toHaveText(`${field.label}：${field.value}`);
    const layout = await item.evaluate((el) => {
      const text = el.querySelector('span')!;
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
      const rects: DOMRect[] = [];
      // 导出 HTML 会合并文本节点，按实际字符测量可同时覆盖预览与离线文件。
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (let i = 0; i < node.textContent!.length; i++) {
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          rects.push(range.getBoundingClientRect());
        }
      }
      const bounds = el.getBoundingClientRect();
      const content = el.closest('.resume-content')!.getBoundingClientRect();
      return {
        firstLine: rects[0].top,
        lastLine: rects.at(-1)!.top,
        contained: rects.every(
          (rect) =>
            rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 &&
            rect.top >= bounds.top - 1 &&
            rect.bottom <= bounds.bottom + 1,
        ),
        withinContent: bounds.left >= content.left - 1 && bounds.right <= content.right + 1,
        iconWidth: el.querySelector('svg')?.getBoundingClientRect().width,
        scale: bounds.width / (el as HTMLElement).offsetWidth,
      };
    });
    expect(layout.contained, `${field.label} 的全部字符应留在字段内`).toBe(true);
    expect(layout.withinContent, '字段不得越过纸张正文区域').toBe(true);
    if (singleLine) {
      expect(Math.abs(layout.lastLine - layout.firstLine), '缩窄区域时字段仍保持一行').toBeLessThan(
        1,
      );
    } else if (field.id === 'wrap-email') {
      expect(layout.lastLine, '超过纸张容量的字段仍完整换行').toBeGreaterThan(layout.firstLine);
    }
    if (field.icon !== 'none') {
      expect(layout.iconWidth! / layout.scale, '换行时图标不缩小').toBeCloseTo(
        (field.size ?? 12) + 1,
        0,
      );
    }
  }
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

for (const template of ['editorial', 'classic', 'compact'] as const) {
  for (const columns of [1, 2, 3] as const) {
    test(`${template} ${columns} 列缩窄信息区域优先收紧间距，长字段与导出保持一行`, async ({
      page,
    }, info) => {
      const doc = documentSchema.parse({
        ...sample,
        name: '信息列宽验证',
        profile: {
          ...sample.profile,
          name: '信息列宽验证',
          photo: '',
          columns,
          infoWidth: 678,
          fields: [
            { id: 'wrap-phone', label: '联系电话', value: '13800000000', icon: 'phone' },
            {
              id: 'wrap-email',
              label: '电子邮箱',
              value: 'resumecontactcandidate012345@example.test',
              icon: 'mail',
              color: '#2f6b4f',
            },
            {
              id: 'wrap-age',
              label: '年龄',
              value: '23',
              icon: 'calendar',
            },
            {
              id: 'wrap-origin',
              label: '籍贯',
              value: '示例城市',
              icon: 'map',
            },
            { id: 'wrap-site', label: '网站', value: 'https://example.test', icon: 'globe' },
            { id: 'wrap-degree', label: '学历', value: '本科', icon: 'graduation' },
          ],
        },
        theme: { ...sample.theme, template },
        modules: [{ ...sample.modules[0], body: '收紧信息列间距，保持长字段完整显示。' }],
      });
      await importDocument(page, doc);
      const preview = page.locator('#resume-pages');
      await assertContactLayout(preview, doc.profile.fields, true);
      const columnGap = () =>
        preview.locator('.resume-contact').evaluate((grid) => {
          const items = grid.querySelectorAll('.resume-contact-item');
          return items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().right;
        });
      const wideGap = columns > 1 ? await columnGap() : 0;
      const width = page.getByRole('slider', { name: /信息区域宽度/ });
      await width.focus();
      await width.press('Home');
      await expect(width).toHaveValue('280');
      await expect(preview.locator('.resume-identity')).toHaveCSS('--info-width', '280px');
      await ready(page);
      await assertContactLayout(preview, doc.profile.fields, true);
      if (columns > 1) {
        expect(await columnGap(), '缩窄后列间距实际减小').toBeLessThan(wideGap - 1);
      }
      // 最长字段可撑开必要宽度，宽度滑块不会把它压进固定等宽列。
      expect(
        await preview.locator('.resume-identity').evaluate((el) => el.clientWidth),
      ).toBeGreaterThan(280);
      const heights = await page.evaluate(() => [
        (document.querySelector('.resume-measure .resume-header') as HTMLElement).offsetHeight,
        (document.querySelector('#resume-pages .resume-header') as HTMLElement).offsetHeight,
      ]);
      expect(heights[0]).toBe(heights[1]);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await preview.locator('.resume-page').screenshot({ path: info.outputPath('preview.png') });
      const pdf = await exportFile(page, info, 'pdf', 'profile.pdf');
      await assertPDF(pdf, 1);
      const html = await exportFile(page, info, 'html', 'profile.html');
      await withOfflineHTML(page, html, async (offline) => {
        await assertContactLayout(offline.locator('.resume-document'), doc.profile.fields, true);
        await offline
          .locator('.resume-page')
          .screenshot({ path: info.outputPath('offline-html.png') });
        await offline.emulateMedia({ media: 'print' });
        await assertContactLayout(offline.locator('.resume-document'), doc.profile.fields, true);
        const printed = info.outputPath('profile-print.pdf');
        await offline.pdf({ path: printed, preferCSSPageSize: true, printBackground: true });
        await assertPDF(printed, 1);
      });
      const extreme = documentSchema.parse({
        ...doc,
        profile: {
          ...doc.profile,
          infoWidth: 280,
          fields: [
            doc.profile.fields[0],
            { ...doc.profile.fields[1], value: `${'contact'.repeat(24)}@example.test`, size: 18 },
            {
              id: 'wrap-website',
              label: '个人网站',
              value: `https://example.test/${'pathsegment'.repeat(15)}`,
              icon: 'globe',
            },
            {
              id: 'wrap-custom',
              label: '自定义信息'.repeat(12),
              value: '联系方式'.repeat(50),
              icon: 'none',
            },
          ],
        },
      });
      await importDocument(page, extreme);
      await expect(preview.locator('.resume-contact-item').nth(1)).toHaveText(
        `电子邮箱：${extreme.profile.fields[1].value}`,
      );
      await ready(page);
      await assertContactLayout(preview, extreme.profile.fields, false);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await preview.locator('.resume-page').screenshot({ path: info.outputPath('extreme.png') });
    });
  }
}

test('信息字段统一字号、单项覆盖与恢复继承，排序和刷新后保留', async ({ page }) => {
  const items = page.locator('#resume-pages .resume-contact-item');
  await page.getByRole('combobox', { name: '姓名字号', exact: true }).selectOption('32');
  await page.getByRole('combobox', { name: '求职意向字号', exact: true }).selectOption('16');
  await expect(page.locator('#resume-pages h1')).toHaveCSS('font-size', '32px');
  await expect(page.locator('#resume-pages .resume-role')).toHaveCSS('font-size', '16px');
  await page.getByLabel('信息字段默认字号').selectOption('14');
  await expect(items.first()).toHaveCSS('font-size', '14px');
  await page.getByLabel('第 1 项字段字号').selectOption('18');
  const phone = items.filter({ hasText: '联系电话' });
  await expect(phone).toHaveCSS('font-size', '18px');
  await expect(phone.locator('svg')).toHaveAttribute('width', '19');
  await expect(items.nth(1)).toHaveCSS('font-size', '14px');
  await ready(page);
  const heights = await page.evaluate(() => [
    (document.querySelector('.resume-measure .resume-header') as HTMLElement).offsetHeight,
    (document.querySelector('#resume-pages .resume-header') as HTMLElement).offsetHeight,
  ]);
  expect(heights[0]).toBe(heights[1]);
  await page.getByRole('button', { name: '下移第 1 项信息字段', exact: true }).click();
  await expect(page.getByLabel('第 2 项字段字号')).toHaveValue('18');
  await saved(page);
  await page.reload();
  await expect(page.getByRole('combobox', { name: '姓名字号', exact: true })).toHaveValue('32');
  await expect(page.getByRole('combobox', { name: '求职意向字号', exact: true })).toHaveValue('16');
  await expect(page.getByLabel('信息字段默认字号')).toHaveValue('14');
  await expect(page.getByLabel('第 2 项字段字号')).toHaveValue('18');
  await expect(phone).toHaveCSS('font-size', '18px');
  await page.getByLabel('第 2 项字段字号').selectOption('');
  await expect(phone).toHaveCSS('font-size', '14px');
  await page.getByLabel('信息字段默认字号').selectOption('12');
  await expect(phone).toHaveCSS('font-size', '12px');
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

test('信息颜色按稳定 ID 随排序、模板切换和刷新保存', async ({ page }) => {
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
    // 操作后不发生布局跳动，不锁定控件的设计尺寸或禁用态色值。
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
    const reset = page.getByRole('button', { name: '标题颜色恢复跟随全局' });
    await reset.click();
    await expect(reset).toBeDisabled();
    const size = page.getByLabel('标题字号', { exact: true });
    await size.selectOption('30');
    const fontBox = (await page.getByLabel('标题字体', { exact: true }).boundingBox())!;
    const sizeBox = (await size.boundingBox())!;
    const colorBox = (await picker.boundingBox())!;
    expect(Math.max(fontBox.y, sizeBox.y, colorBox.y)).toBeLessThan(
      Math.min(
        fontBox.y + fontBox.height,
        sizeBox.y + sizeBox.height,
        colorBox.y + colorBox.height,
      ),
    );
    expect(sizeBox.x + sizeBox.width).toBeLessThanOrEqual(colorBox.x);
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
