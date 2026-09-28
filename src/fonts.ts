import sans from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2?url';
import serif from '@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-400-normal.woff2?url';
import inter from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import source from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2?url';
export const fontAssets = [
  { name: 'Noto Sans SC', url: sans },
  { name: 'Noto Serif SC', url: serif },
  { name: 'Inter', url: inter },
  { name: 'Source Serif 4', url: source },
];
export const fontCSS = fontAssets
  .map(
    (f) =>
      `@font-face{font-family:"${f.name}";font-style:normal;font-weight:400;font-display:swap;src:url("${f.url}") format("woff2")}`,
  )
  .join('\n');
export async function embeddedFontCSS() {
  const embedded = await Promise.all(
    fontAssets.map(async (f) => {
      const response = await fetch(f.url);
      if (!response.ok) throw new Error('字体加载失败，请重试');
      const blob = await response.blob();
      const url = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      return { ...f, url };
    }),
  );
  return embedded
    .map(
      (f) =>
        `@font-face{font-family:"${f.name}";font-weight:400;src:url("${f.url}") format("woff2")}`,
    )
    .join('\n');
}
