import { get, set } from 'idb-keyval';
import { documentSchema, sample, type Resume } from './model';
const KEY = 'folio.resume.v4';
let defaultAvatar: Promise<string> | undefined;
export function loadDefaultAvatar(): Promise<string> {
  // Normalize once; saved documents and exports always carry an offline raster data URL.
  defaultAvatar ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}avatar.webp`);
    if (!response.ok) throw new Error('默认头像加载失败，请重试');
    return readImage(new File([await response.blob()], 'avatar.webp', { type: 'image/webp' }));
  })().catch((error) => {
    defaultAvatar = undefined;
    throw error;
  });
  return defaultAvatar;
}
export async function loadResume(): Promise<Resume | undefined> {
  const value: unknown = await get(KEY);
  return value === undefined
    ? documentSchema.parse({
        ...sample,
        profile: { ...sample.profile, photo: await loadDefaultAvatar() },
      })
    : documentSchema.parse(value);
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
export async function readImage(file: File, qr = false, max = qr ? 1000 : 1200): Promise<string> {
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
    const size = max,
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
const avatarCache = new Map<string, Promise<string>>();
/**
 * GitHub 头像只在用户主动查询仓库时抓取一次，随后以本地 data URL 存入卡片，
 * 这样预览、备份与所有导出都不需要再联网。
 */
export function fetchAvatar(url: string, signal?: AbortSignal): Promise<string> {
  let cached = avatarCache.get(url);
  if (!cached) {
    cached = (async () => {
      const response = await fetch(url, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('头像获取失败');
      const blob = await response.blob();
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
        throw new Error('头像格式不支持');
      if (blob.size > 2 * 1024 * 1024) throw new Error('头像文件过大');
      return readImage(new File([blob], 'avatar', { type: blob.type }), false, 256);
    })().catch((error) => {
      avatarCache.delete(url);
      throw error;
    });
    avatarCache.set(url, cached);
  }
  return cached;
}
