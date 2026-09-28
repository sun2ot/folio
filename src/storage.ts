import { get, set } from 'idb-keyval';
import { documentSchema, type Resume } from './model';
const KEY = 'folio.resume.v1';
export async function loadResume(): Promise<Resume | undefined> {
  const value: unknown = await get(KEY);
  return value === undefined ? undefined : documentSchema.parse(value);
}
export async function saveResume(doc: Resume) {
  await set(KEY, doc);
}
export function parseImport(text: string): Resume {
  if (text.length > 30_000_000) throw new Error('数据文件不能超过 30 MB');
  return documentSchema.parse(JSON.parse(text));
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
/** Normalize uploads to raster PNG; reject SVG/remote resources and bound decoding. */
export async function readImage(file: File, qr = false): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5 MB');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 40_000_000)
      throw new Error('图片像素过大，请缩小至 4000 万像素以内');
    const size = qr ? 1000 : 1200,
      ratio = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * ratio),
      height = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = qr ? Math.max(width, height) : width;
    canvas.height = qr ? Math.max(width, height) : height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = !qr;
    if (qr) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
