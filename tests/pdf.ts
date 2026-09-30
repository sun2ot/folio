import { expect } from '@playwright/test';
import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

type Marker = { page: number; x: number; y: number; color: readonly [number, number, number] };
type Link = { page: number; url: string; left: number; top: number; width: number; height: number };

/** 读取并逐页渲染真实 PDF；文件头和下载成功无法发现空白页或第二页坐标偏移。 */
export async function assertPDF(
  file: string,
  pages: number,
  markers: Marker[] = [],
  links: Link[] = [],
) {
  const pdfRoot = new URL('../../', import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  const loading = getDocument({
    data: new Uint8Array(await readFile(file)),
    useSystemFonts: true,
    useWorkerFetch: false,
    standardFontDataUrl: fileURLToPath(new URL('standard_fonts/', pdfRoot)).replaceAll('\\', '/'),
    wasmUrl: fileURLToPath(new URL('wasm/', pdfRoot)).replaceAll('\\', '/'),
  });
  try {
    const pdf = await loading.promise;
    expect(pdf.numPages, file).toBe(pages);
    for (let n = 1; n <= pages; n++) {
      const page = await pdf.getPage(n);
      const original = page.getViewport({ scale: 1 });
      // Chromium 原生打印将 CSS 像素换算为 PDF 点时取整；容差约为 1 CSS px。
      expect(Math.abs((original.width * 25.4) / 72 - 210)).toBeLessThan(0.3);
      expect(Math.abs((original.height * 25.4) / 72 - 297)).toBeLessThan(0.3);
      const viewport = page.getViewport({ scale: 794 / original.width });
      const annotations = await page.getAnnotations();
      for (const link of links.filter((value) => value.page === n)) {
        const annotation = annotations.find(
          (value) => value.subtype === 'Link' && value.url === link.url,
        );
        expect(annotation, `第 ${n} 页应保留 ${link.url}`).toBeDefined();
        const [left, bottom, right, top] = annotation!.rect;
        const [x1, y1] = viewport.convertToViewportPoint(left, bottom);
        const [x2, y2] = viewport.convertToViewportPoint(right, top);
        for (const [actual, expected] of [
          [Math.min(x1, x2), link.left],
          [Math.min(y1, y2), link.top],
          [Math.abs(x2 - x1), link.width],
          [Math.abs(y2 - y1), link.height],
        ])
          expect(Math.abs(actual - expected), `第 ${n} 页链接图标位置`).toBeLessThan(2);
      }
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      // PDF.js 的声明使用浏览器类型，Node 端采用兼容的原生 Canvas 实现。
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      let ink = 0;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      // 排除纸张边缘、装饰色带和页脚，避免只有页码的空白正文也通过。
      for (let y = 54; y < 1048; y += 4) {
        for (let x = 58; x < 736; x += 4) {
          const offset = (y * canvas.width + x) * 4;
          if (Math.min(data[offset], data[offset + 1], data[offset + 2]) < 235) ink++;
        }
      }
      expect(ink, `${file} 第 ${n} 页正文应有可见内容`).toBeGreaterThan(20);
      for (const marker of markers.filter((point) => point.page === n)) {
        const x = Math.round((marker.x / 794) * canvas.width);
        const y = Math.round((marker.y / 1122) * canvas.height);
        const pixel = context.getImageData(x, y, 1, 1).data;
        for (let channel = 0; channel < 3; channel++) {
          expect(
            Math.abs(pixel[channel] - marker.color[channel]),
            `第 ${n} 页位置 (${marker.x}, ${marker.y})`,
          ).toBeLessThan(8);
        }
      }
      await writeFile(file.replace(/\.pdf$/, `-page-${n}.png`), canvas.toBuffer('image/png'));
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await loading.destroy();
  }
}
