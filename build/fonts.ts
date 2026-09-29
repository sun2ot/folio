import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

export function fontManifest(): Plugin {
  const require = createRequire(import.meta.url);
  return {
    name: 'folio-local-fonts',
    resolveId(id) {
      if (id === 'virtual:folio-fonts') return '\0folio-fonts';
    },
    load(id) {
      if (id !== '\0folio-fonts') return;
      const imports: string[] = [],
        faces: string[] = [];
      for (const font of ['noto-sans-sc', 'noto-serif-sc', 'inter', 'source-serif-4']) {
        const path = require.resolve(`@fontsource/${font}/400.css`);
        const css = readFileSync(path, 'utf8');
        for (const block of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
          const name = /font-family:\s*['"]([^'"]+)/.exec(block[1])?.[1];
          const file = /url\(([^)]+\.woff2)\)/.exec(block[1])?.[1];
          const range = /unicode-range:\s*([^;]+);/.exec(block[1])?.[1];
          if (!name || !file || !range) throw new Error(`Invalid font face in ${path}`);
          const variable = `font${imports.length}`;
          imports.push(
            `import ${variable} from ${JSON.stringify(resolve(dirname(path), file).replaceAll('\\', '/') + '?url')};`,
          );
          faces.push(
            `{name:${JSON.stringify(name)},range:${JSON.stringify(range)},url:${variable}}`,
          );
        }
      }
      return `${imports.join('\n')}\nexport default [${faces.join(',')}];`;
    },
  };
}
