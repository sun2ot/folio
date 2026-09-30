import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

type Package = {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

/** 发布包独立于 node_modules，必须随包提供运行时依赖的原始许可。 */
export function distributionLicenses(): Plugin {
  return {
    name: 'folio-distribution-licenses',
    apply: 'build',
    generateBundle() {
      const root = process.cwd();
      const app = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Package;
      const pending = Object.keys(app.dependencies ?? {}).map((name) => ({ name, from: root }));
      const seen = new Set<string>();
      const index = ['# 分发依赖许可', '', 'Folio: GPL-3.0-only，见根目录 LICENSE。', ''];
      this.emitFile({
        type: 'asset',
        fileName: 'LICENSE',
        source: readFileSync('LICENSE', 'utf8'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'SOURCE.txt',
        source:
          'Folio — Copyright (C) 2026 sun2ot\nGPL-3.0-only\n\n' +
          '对应源码：https://github.com/sun2ot/folio\n' +
          '每个官方 Release 附有 folio-source.tar.gz，包含该构建的源码、lockfile 和离线仓库快照。\n' +
          '重新分发修改版时请依照 LICENSE 提供对应源码、构建文件及修改说明。\n',
      });
      while (pending.length) {
        const { name, from } = pending.shift()!;
        const require = createRequire(resolve(from, 'package.json'));
        const location = require.resolve
          .paths(name)
          ?.find((path) => existsSync(resolve(path, name, 'package.json')));
        if (!location) throw new Error(`无法找到分发依赖 ${name} 的许可`);
        const directory = realpathSync(resolve(location, name));
        const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8')) as Package;
        const id = `${pkg.name}@${pkg.version}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const notices = readdirSync(directory).filter((file) =>
          /^(licen[sc]e|copying|notice)([._-]|$)/i.test(file),
        );
        if (!notices.length) throw new Error(`${id} 缺少原始许可文本，请补齐分发声明`);
        const prefix = id.replace(/[^\w.-]/g, '_');
        for (const file of notices) {
          const filename = `dependencies/${prefix}-${file}`;
          this.emitFile({
            type: 'asset',
            fileName: `licenses/${filename}`,
            source: readFileSync(resolve(directory, file)),
          });
          index.push(`- ${id} (${pkg.license ?? '见原文'})：[${file}](${filename})`);
        }
        const dependencies = { ...pkg.dependencies, ...pkg.optionalDependencies };
        for (const child of Object.keys(dependencies)) {
          const paths = createRequire(resolve(directory, 'package.json')).resolve.paths(child);
          if (paths?.some((path) => existsSync(resolve(path, child, 'package.json')))) {
            pending.push({ name: child, from: directory });
          } else if (pkg.dependencies?.[child] && !pkg.optionalDependencies?.[child]) {
            throw new Error(`${id} 缺少依赖 ${child}`);
          }
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/THIRD_PARTY.md',
        source: index.join('\n') + '\n',
      });
    },
  };
}
