import { documentSchema, sample } from '../src/model';
import type { Page } from '@playwright/test';

/** 合成色块用于跨页图片定位，不含个人信息或真实二维码。 */
export async function floatingDocument(page: Page) {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 120;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 120, 120);
    context.fillStyle = '#315b50';
    context.fillRect(20, 20, 80, 80);
    return canvas.toDataURL();
  });
  const doc = structuredClone(sample);
  doc.profile.photo = image;
  doc.media.qr.image = image;
  doc.media.qr.page = 2;
  doc.media.qr.top = 880;
  doc.media.qr.left = 600;
  doc.media.qr.size = 120;
  doc.modules[2].pageBreak = true;
  return documentSchema.parse(doc);
}
