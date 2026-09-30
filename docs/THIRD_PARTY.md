# 第三方与字体

Folio 代码采用 GPL-3.0-only，项目许可证见根目录 LICENSE；Copyright (C) 2026 sun2ot。第三方代码不改写许可。依赖精确版本见 pnpm-lock.yaml。

`build/licenses.ts` 在生产构建时复制项目 LICENSE，生成 SOURCE.txt，并遍历已安装的运行时依赖及其传递依赖，把原始 LICENSE / LICENCE / COPYING / NOTICE 文本和索引写入 dist/licenses/。缺少许可文本时构建失败，避免只在文档中指向不会随静态包分发的 node_modules。可选依赖仅收集本次安装存在的包。

React、Marked、DOMPurify、html2canvas、jsPDF、idb-keyval、Zod、Lucide 等保留上游授权。PDF.js（Apache-2.0）与 @napi-rs/canvas（MIT）仅用于测试 PDF 页面渲染，不进入应用 JavaScript。Vite、TypeScript、Playwright 等构建与测试工具许可见各包，源码归档保留 lockfile 和获取这些工具的安装步骤。

官方发布同时附上 folio-source.tar.gz，包含对应提交的源码、构建文件、lockfile 及本次构建的离线快照。分发修改版本时，分发者应提供修改版本的对应源码与修改说明，不能把上游源码链接当作自己修改版的源码。

字体：Noto Sans SC / Noto Serif SC（Google/Adobe Noto 项目）、Inter（Rasmus Andersson）、Source Serif 4（Adobe）。从 Fontsource 包取得，采用 SIL Open Font License 1.1。对应许可副本在 public/licenses/，生产构建自动复制至 dist/licenses/。未修改原始字体文件，不对字体单独收费，不宣称拥有其名称。

简体中文字集为控制下载体积而选用上游已分发子集，粗斜体由浏览器合成。需要品牌指定字体时，自行核实许可、添加本地字体文件，并同步 fonts.ts、schema、选择器、嵌入导出与许可副本。
