import resumeCSS from './resume.css?raw';
import { embeddedFontCSS } from './fonts';
import { download } from './storage';
import { CONTENT_HEIGHT, FOOTER_RESERVE } from './pagination';

function pagesRoot() {
  const root = document.querySelector('#resume-pages');
  if (!root || root.closest('[data-ready]')?.getAttribute('data-ready') !== 'true')
    throw new Error('正在排版，请稍后再导出');
  return root as HTMLElement;
}
async function prepare() {
  const deadline = performance.now() + 10_000;
  // Opening export refreshes manual/debounced previews. Wait for that layout commit.
  while (
    document.querySelector('#resume-pages')?.parentElement?.getAttribute('data-ready') !== 'true'
  ) {
    if (performance.now() > deadline) throw new Error('字体或排版尚未就绪，请检查资源后重试');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  const root = pagesRoot();
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map((img) => img.decode()));
  if (
    Array.from(root.querySelectorAll<HTMLElement>('.resume-content')).some(
      (el) =>
        el.offsetHeight >
        (parseFloat(getComputedStyle(el).getPropertyValue('--content-height')) || CONTENT_HEIGHT),
    )
  ) {
    throw new Error('内容超出页面，请拆分模块或减小字号后导出');
  }
  if (
    Array.from(root.querySelectorAll<HTMLElement>('.resume-footer')).some(
      (el) => el.offsetHeight > FOOTER_RESERVE,
    )
  ) {
    throw new Error('页脚 / 页码超出底部留白，请缩小字号或缩短内容后导出');
  }
  return root;
}
export function safeFilename(name: string) {
  return (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '我的简历').slice(0, 100);
}
function copyPages(root: HTMLElement) {
  const copy = root.cloneNode(true) as HTMLElement;
  // Export the document without the preview's keyboard/drag controls.
  copy.querySelectorAll('[data-media]').forEach((el) => {
    for (const attr of ['role', 'tabindex', 'title', 'aria-label']) el.removeAttribute(attr);
  });
  return copy;
}
export async function exportHTML(name: string) {
  const root = await prepare(),
    fonts = await embeddedFontCSS(root);
  const container = root.parentElement!.cloneNode(false) as HTMLElement;
  container.removeAttribute('data-ready');
  container.append(copyPages(root));
  const title = document.createElement('span');
  title.textContent = name;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title.innerHTML}</title><style>${fonts}\n${resumeCSS}\nbody{margin:0;background:#ededeb;padding:24px 0}.resume-page{max-width:none}@media print{body{padding:0}.resume-page{margin:0;box-shadow:none;break-after:page}.resume-page:last-child{break-after:auto}}</style></head><body>${container.outerHTML}</body></html>`;
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeFilename(name)}.html`);
}
/** Capture one A4 page at a time, limiting peak canvas memory and preserving the page boundaries. */
export async function exportPDF(name: string, progress: (value: string) => void) {
  const root = await prepare();
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  // Clone the exact preview DOM outside zoomed/scrolling ancestors. Resetting zoom
  // inside html2canvas's clone is too late: later-page capture offsets can drift.
  const staging = root.parentElement!.cloneNode(false) as HTMLElement;
  staging.style.position = 'absolute';
  staging.style.left = '-10000px';
  staging.style.top = '0';
  staging.style.width = '794px';
  staging.setAttribute('aria-hidden', 'true');
  const copy = copyPages(root);
  copy.removeAttribute('id');
  staging.append(copy);
  document.body.append(staging);
  try {
    await Promise.all(Array.from(staging.querySelectorAll('img')).map((img) => img.decode()));
    const pages = Array.from(staging.querySelectorAll<HTMLElement>('.resume-page'));
    for (let i = 0; i < pages.length; i++) {
      progress(`正在生成第 ${i + 1} / ${pages.length} 页…`);
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: false,
        width: 794,
        height: 1122,
        windowWidth: 1440,
        windowHeight: 1200,
      });
      if (i) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      canvas.width = 0;
      canvas.height = 0;
      // 栅格页面本身不保留超链接；用同一无缩放 DOM 的坐标补上图标和正文链接。
      const pageRect = pages[i].getBoundingClientRect();
      for (const link of pages[i].querySelectorAll<HTMLAnchorElement>('a[href]')) {
        if (!/^(https?:|mailto:|tel:)/i.test(link.href)) continue;
        for (const rect of link.getClientRects()) {
          const left = Math.max(rect.left, pageRect.left);
          const top = Math.max(rect.top, pageRect.top);
          const right = Math.min(rect.right, pageRect.right);
          const bottom = Math.min(rect.bottom, pageRect.bottom);
          if (right <= left || bottom <= top) continue;
          pdf.link(
            ((left - pageRect.left) / pageRect.width) * 210,
            ((top - pageRect.top) / pageRect.height) * 297,
            ((right - left) / pageRect.width) * 210,
            ((bottom - top) / pageRect.height) * 297,
            { url: link.href },
          );
        }
      }
    }
    pdf.setProperties({ title: name, creator: 'Folio Resume Studio' });
    pdf.save(`${safeFilename(name)}.pdf`);
  } finally {
    staging.remove();
  }
}
export async function printResume() {
  const root = await prepare();
  const host = document.createElement('div');
  host.className = 'print-root';
  const wrapper = root.parentElement!.cloneNode(false) as HTMLElement;
  wrapper.append(copyPages(root));
  host.append(wrapper);
  document.body.append(host);
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => img.decode()));
    window.print();
  } finally {
    host.remove();
  }
}
